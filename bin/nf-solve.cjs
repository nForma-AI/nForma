#!/usr/bin/env node
'use strict';
// bin/nf-solve.cjs
// Consistency solver orchestrator: sweeps Requirements->Formal->Tests->Code->Docs,
// computes a residual vector per layer transition, and auto-closes gaps.
//
// Layer transitions (8 forward + 3 reverse + 3 layer alignment + 5 evidence/maturity):
//   R->F: Requirements without formal model coverage
//   F->T: Formal invariants without test backing
//   C->F: Code constants diverging from formal specs
//   T->C: Failing unit tests
//   F->C: Failing formal verification checks
//   R->D: Requirements not documented in developer docs
//   D->C: Stale structural claims in docs (dead file paths, missing CLI commands, absent dependencies)
//   P->F: Acknowledged production debt entries diverging from formal model thresholds
// Reverse (discovery-only, human-gated):
//   C->R: Source modules in bin/hooks/ with no requirement tracing
//   T->R: Test files with no @req annotation or formal-test-sync mapping
//   D->R: Doc capability claims without requirement backing
// Layer alignment (cross-layer gate checks):
//   L1->L2: Wiring:Evidence alignment score
//   L2->L3: Wiring:Purpose alignment score
//   L3->TC: Wiring:Coverage alignment score
// Evidence & maturity:
//   F->G: Formal models at gate maturity 0 (not yet promoted through gates)
//   C->E: High-churn code files (git heatmap) lacking formal coverage
//   G->F: Failure scenarios in git history that formal models cannot explain (TLA+ drift)
//   F->F: Formal model self-consistency lint (fat, unbounded, or overly complex models)
//   F->H: Hazard model FMEA — state transitions with critical/high RPN scores
//
// Usage:
//   node bin/nf-solve.cjs                  # full sync, up to 3 iterations
//   node bin/nf-solve.cjs --report-only    # single sweep, no mutations
//   node bin/nf-solve.cjs --max-iterations=1
//   node bin/nf-solve.cjs --json           # machine-readable output
//   node bin/nf-solve.cjs --verbose        # pipe child stderr to parent stderr
//   node bin/nf-solve.cjs --fast           # skip F->C and T->C layers for sub-second iteration
//   node bin/nf-solve.cjs --skip-proximity  # skip proximity index rebuild (faster re-diagnostic)
//
// Requirements: QUICK-140

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { appendTrendEntry, readGateSummary } = require('./solve-trend-helpers.cjs');
const { LAYER_KEYS } = require('./layer-constants.cjs');
const { resolveGateScore } = require('./gate-score-utils.cjs');
const { updateVerdicts } = require('./oscillation-detector.cjs');
const { filterRequirementsByFocus } = require('./solve-focus-filter.cjs');
const { updatePredictivePower, formatPredictivePowerSummary } = require('./predictive-power.cjs');
const { detectNewlyBlocked } = require('./escalation-classifier.cjs');
const { CycleDetector } = require('./solve-cycle-detector.cjs');
const { measureHypotheses } = require('./hypothesis-measure.cjs')._pure;
const { loadHypothesisTransitions, computeLayerPriorityWeights } = require('./hypothesis-layer-map.cjs');
const { computeWaves } = require('./solve-wave-dag.cjs');

const TAG = '[nf-solve]';
let ROOT = process.cwd();
const SCRIPT_DIR = __dirname;
const DEFAULT_MAX_ITERATIONS = 3;

// ── Embedding fallback for proximity enrichment ──────────────────────────────
// When BFS finds no graph path from a node to a requirement, the embedding cache
// provides a semantic nearest-requirement fallback. Lazy-loaded, fail-open.
let _embedCache = null;
let _embedCacheLoaded = false;
let _embedReqKeys = null; // pre-filtered requirement keys for fast lookup

function loadEmbedCache() {
  if (_embedCacheLoaded) return _embedCache;
  _embedCacheLoaded = true;
  try {
    const cachePath = path.join(ROOT, '.planning', 'formal', 'embedding-cache.json');
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (data && data.vectors && data.schema_version === '1') {
      _embedCache = data;
      _embedReqKeys = Object.keys(data.vectors).filter(k => k.startsWith('requirement::'));
    }
  } catch { /* fail-open */ }
  return _embedCache;
}

/**
 * Find the nearest requirement to a node key using embedding cosine similarity.
 * Returns { nearest_req, similarity, proximity_context } or null if no cache.
 */
function embeddingNearestReq(nodeKey) {
  const cache = loadEmbedCache();
  if (!cache || !cache.vectors[nodeKey] || !_embedReqKeys) return null;

  const vec = cache.vectors[nodeKey];
  let bestSim = -1;
  let bestKey = null;
  const topN = []; // for proximity_context

  for (const rk of _embedReqKeys) {
    const rv = cache.vectors[rk];
    let dot = 0;
    for (let i = 0; i < vec.length; i++) dot += vec[i] * rv[i];
    topN.push({ key: rk, sim: dot });
    if (dot > bestSim) {
      bestSim = dot;
      bestKey = rk;
    }
  }

  if (!bestKey || bestSim < 0.3) return null;

  // Build proximity_context from top-5 matches
  topN.sort((a, b) => b.sim - a.sim);
  const proximity_context = topN.slice(0, 5).map(t => t.key);

  return {
    nearest_req: bestKey.replace('requirement::', ''),
    similarity: Math.round(bestSim * 1000) / 1000,
    proximity_context,
  };
}

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const reportOnly = args.includes('--report-only');
const jsonMode = args.includes('--json');
const verboseMode = args.includes('--verbose');
const fastMode = args.includes('--fast');
const skipProximity = args.includes('--skip-proximity');
const skipTests = args.includes('--skip-tests');

// Parse --project-root (overrides CWD-based ROOT for cross-repo usage)
for (const arg of args) {
  if (arg.startsWith('--project-root=')) {
    ROOT = path.resolve(arg.slice('--project-root='.length));
  }
}

let maxIterations = DEFAULT_MAX_ITERATIONS;
for (const arg of args) {
  if (arg.startsWith('--max-iterations=')) {
    const val = parseInt(arg.slice('--max-iterations='.length), 10);
    if (!isNaN(val) && val >= 1 && val <= 10) {
      maxIterations = val;
    }
  }
}

// Parse --focus flag for topic-scoped diagnostic sweeps
let focusPhrase = null;
for (const arg of args) {
  if (arg.startsWith('--focus=')) {
    focusPhrase = arg.slice('--focus='.length).replace(/^["']|["']$/g, '');
  }
}

const focusSet = focusPhrase
  ? filterRequirementsByFocus(focusPhrase, { root: ROOT })
  : null;

if (focusSet) {
  process.stderr.write(TAG + ' Focus filter active: ' + focusPhrase + ' (' + focusSet.size + ' requirements matched)\n');
}

// ── Helper: spawnTool ────────────────────────────────────────────────────────

/**
 * Spawns a child process with error handling and optional stderr piping.
 * Returns { ok: boolean, stdout: string, stderr: string }.
 */
function spawnTool(script, args, opts = {}) {
  const scriptPath = path.join(SCRIPT_DIR, path.basename(script));
  // Auto-forward --project-root to child script
  const childArgs = [...args];
  if (!childArgs.some(a => a.startsWith('--project-root='))) {
    childArgs.push('--project-root=' + ROOT);
  }
  const defaultStdio = verboseMode ? ['pipe', 'pipe', 'inherit'] : 'pipe';
  const spawnOpts = {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: opts.timeout || 120000,
    stdio: opts.stdio || defaultStdio,
    maxBuffer: opts.maxBuffer || 10 * 1024 * 1024,
  };

  try {
    const result = spawnSync(process.execPath, [scriptPath, ...childArgs], spawnOpts);
    if (result.error) {
      return {
        ok: false,
        stdout: '',
        stderr: result.error.message,
      };
    }
    return {
      ok: result.status === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  } catch (err) {
    return {
      ok: false,
      stdout: '',
      stderr: err.message,
    };
  }
}

// ── P->F layer imports ──────────────────────────────────────────────────────

const { sweepPtoF } = require('./sweepPtoF.cjs');
const { autoClosePtoF } = require('./autoClosePtoF.cjs');

// ── Doc discovery helpers ────────────────────────────────────────────────────

/**
 * Simple wildcard matcher for patterns like "**\/*.md" and "README.md".
 * Supports: ** (any path segment), * (any filename segment), literal match.
 */
function matchWildcard(pattern, filePath) {
  const normPath = filePath.replace(/\\/g, '/');
  const normPattern = pattern.replace(/\\/g, '/');

  if (!normPattern.includes('*')) {
    return normPath === normPattern || normPath.endsWith('/' + normPattern);
  }

  let regex = normPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*/g, '[^/]*');
  regex = '^(' + regex + ')$';

  return new RegExp(regex).test(normPath);
}

/**
 * Recursively walk a directory, returning files up to maxDepth levels.
 */
function walkDir(dir, maxDepth, currentDepth) {
  if (currentDepth === undefined) currentDepth = 0;
  if (maxDepth === undefined) maxDepth = 10;
  if (currentDepth > maxDepth) return [];

  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const sub = walkDir(fullPath, maxDepth, currentDepth + 1);
      for (const s of sub) results.push(s);
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Detect uninitialized git submodules that overlap with doc paths.
 * Returns array of { submodule, docKey } warnings.
 */
function detectUninitializedSubmodules(docPaths) {
  const gitmodulesPath = path.join(ROOT, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) return [];

  const warnings = [];
  try {
    const content = fs.readFileSync(gitmodulesPath, 'utf8');
    const submodules = [];
    const re = /\[submodule\s+"([^"]+)"\][\s\S]*?path\s*=\s*(.+)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      submodules.push({ name: m[1].trim(), path: m[2].trim() });
    }

    for (const sub of submodules) {
      const subAbsPath = path.join(ROOT, sub.path);
      const isInitialized = fs.existsSync(subAbsPath) &&
        fs.readdirSync(subAbsPath).length > 0;

      for (const [docKey, docPath] of Object.entries(docPaths)) {
        const docNorm = docPath.replace(/\/$/, '');
        if (sub.path === docNorm || sub.path.startsWith(docNorm + '/') || docNorm.startsWith(sub.path + '/')) {
          if (!isInitialized) {
            warnings.push({ submodule: sub.path, docKey, name: sub.name });
          }
        }
      }
    }
  } catch (e) {
    // .gitmodules parse error — fail-open
  }
  return warnings;
}

/**
 * Discover documentation files based on:
 *   1. .planning/polyrepo.json docs field (preferred — knows user vs developer vs examples)
 *   2. .planning/config.json docs_paths (legacy)
 *   3. Fallback patterns: README.md, docs/ (recursive .md)
 * Returns array of { absPath, category } where category is 'user'|'developer'|'examples'|'unknown'.
 */
function discoverDocFiles() {
  let docPatterns = [
    { pattern: 'README.md', category: 'user' },
    { pattern: 'docs/**/*.md', category: 'unknown' },
  ];
  let markerDocs = null;

  // Prefer polyrepo marker docs field
  const markerPath = path.join(ROOT, '.planning', 'polyrepo.json');
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (marker.docs && typeof marker.docs === 'object') {
      markerDocs = marker.docs;
      const patterns = [];
      for (const [key, docPath] of Object.entries(marker.docs)) {
        if (typeof docPath !== 'string') continue;
        if (docPath.endsWith('/')) {
          patterns.push({ pattern: docPath + '**/*.md', category: key });
        } else {
          patterns.push({ pattern: docPath, category: key });
        }
      }
      if (patterns.length > 0) {
        patterns.unshift({ pattern: 'README.md', category: 'user' });
        // Sort: exact paths first, then deeper globs before shallower ones
        patterns.sort((a, b) => {
          const aGlob = a.pattern.includes('*') ? 1 : 0;
          const bGlob = b.pattern.includes('*') ? 1 : 0;
          if (aGlob !== bGlob) return aGlob - bGlob; // exact paths first
          const aDepth = a.pattern.split('/').length;
          const bDepth = b.pattern.split('/').length;
          return bDepth - aDepth; // deeper globs first
        });
        docPatterns = patterns;
      }

      // Check for uninitialized submodules overlapping doc paths
      const subWarnings = detectUninitializedSubmodules(marker.docs);
      for (const w of subWarnings) {
        console.error(
          `[nf-solve] WARNING: docs.${w.docKey} overlaps submodule "${w.name}" ` +
          `(${w.submodule}) which is not initialized. Run: git submodule update --init ${w.submodule}`
        );
      }
    }
  } catch (e) {
    // No marker or malformed — fall through to config.json
  }

  // Fall back to config.json docs_paths if marker didn't provide patterns
  if (!markerDocs) {
    const configPath = path.join(ROOT, '.planning', 'config.json');
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Array.isArray(configData.docs_paths) && configData.docs_paths.length > 0) {
        docPatterns = configData.docs_paths.map(p => ({ pattern: p, category: 'unknown' }));
      }
    } catch (e) {
      // Use defaults
    }
  }

  const found = new Map();

  for (const { pattern, category } of docPatterns) {
    if (pattern.includes('*')) {
      const parts = pattern.replace(/\\/g, '/').split('/');
      let baseDir = ROOT;
      for (const part of parts) {
        if (part.includes('*')) break;
        baseDir = path.join(baseDir, part);
      }
      if (!fs.existsSync(baseDir)) continue;

      const allFiles = walkDir(baseDir, 10, 0);
      for (const f of allFiles) {
        const relative = path.relative(ROOT, f).replace(/\\/g, '/');
        if (matchWildcard(pattern, relative)) {
          if (!found.has(f)) found.set(f, category);
        }
      }
    } else {
      const fullPath = path.join(ROOT, pattern);
      if (fs.existsSync(fullPath)) {
        if (!found.has(fullPath)) found.set(fullPath, category);
      }
    }
  }

  return Array.from(found.entries()).map(([absPath, category]) => ({ absPath, category }));
}

// ── Keyword extraction ──────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'this', 'that', 'with', 'from', 'into', 'each', 'when',
  'must', 'should', 'will', 'have', 'been', 'does', 'also', 'used',
  'using', 'only', 'such', 'both', 'than', 'some', 'more', 'most',
  'very', 'other', 'about', 'which', 'their', 'would', 'could',
  'there', 'where', 'these', 'those', 'after', 'before', 'being',
  'through', 'during', 'between', 'without', 'within', 'against',
  'under', 'above', 'below',
]);

/**
 * Extract keywords from text for fuzzy matching.
 * Strips backtick-wrapped fragments, stopwords, and short tokens.
 * Returns unique lowercase tokens.
 */
function extractKeywords(text) {
  let cleaned = text.replace(/`[^`]*`/g, ' ');
  const tokens = cleaned.split(/[\s,;:.()\[\]{}<>!?"']+/);

  const seen = new Set();
  const result = [];

  for (const raw of tokens) {
    const token = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (token.length < 4) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }

  return result;
}

// ── Structural claims extraction ─────────────────────────────────────────────

/**
 * Extract structural claims (file paths, CLI commands, dependencies) from doc content.
 * Skips fenced code blocks, Example/Template headings, template variables,
 * home directory paths, and code expressions.
 * Returns array of { line, type, value, doc_file }.
 */
function extractStructuralClaims(docContent, filePath) {
  const lines = docContent.split('\n');
  const claims = [];
  let inFencedBlock = false;
  let skipSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (inFencedBlock) continue;

    // Track headings - skip Example/Template sections
    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      const headingText = headingMatch[1].toLowerCase();
      skipSection = headingText.includes('example') || headingText.includes('template');
      continue;
    }
    if (skipSection) continue;

    // Find backtick-wrapped values
    const backtickPattern = /`([^`]+)`/g;
    let match;
    while ((match = backtickPattern.exec(line)) !== null) {
      const value = match[1].trim();
      if (value.length < 4) continue;

      // Filter: template variables
      if (value.includes('{') || value.includes('}')) continue;

      // Filter: home directory paths
      if (value.startsWith('~/')) continue;

      // Filter: code expressions (operators)
      if (/[+=>]|&&|\|\|/.test(value)) continue;

      // Classify the claim
      let type = null;

      // CLI command: starts with node, npx, npm
      if (/^(node|npx|npm)\s+/.test(value)) {
        type = 'cli_command';
      }
      // File path: contains / with extension, or starts with .
      else if ((value.includes('/') && /\.\w+$/.test(value)) || (value.startsWith('.') && /\.\w+$/.test(value))) {
        if (value.startsWith('/')) continue;
        type = 'file_path';
      }
      // Dependency: npm-style package name (lowercase, optional @scope/)
      // Must be scoped (@scope/name) or contain a hyphen to qualify.
      // Single bare words in docs are almost always concept references, not deps.
      // Structural filters only — no prefix-based filters (would reject real pkgs like run-sequence).
      // sweepDtoC cross-references against package.json for the actual broken check.
      else if (/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(value) && !value.includes('/')) {
        const isDep =
          !value.includes('.') &&                               // config keys (quorum.active), filenames (nf-solve.cjs)
          !value.includes('_') &&                               // snake_case identifiers (fail_mode, stop_hook_active)
          !value.startsWith('mcp__') &&                         // MCP tool references
          !['true','false','undefined','null','none','pass'].includes(value) && // JS/JSON keywords
          (value.startsWith('@') || value.includes('-'));        // must be scoped or hyphenated (bare words are not deps)
        if (isDep) type = 'dependency';
      }

      if (type) {
        claims.push({
          line: i + 1,
          type: type,
          value: value,
          doc_file: filePath,
        });
      }
    }
  }

  return claims;
}

// ── Preflight bootstrap ──────────────────────────────────────────────────────

/**
 * Auto-creates .planning/formal/ subdirectories if missing on first run.
 * Called at the top of main() before the iteration loop.
 */
function preflight() {
  // Guard: validate ROOT looks like a project root before creating directories.
  // Prevents creating .planning/ inside bin/ or other wrong locations when
  // subagents run with incorrect cwd.
  const rootMarkers = ['package.json', '.planning', 'CLAUDE.md'].map(m => path.join(ROOT, m));
  const hasMarker = rootMarkers.some(m => fs.existsSync(m));
  if (!hasMarker) {
    process.stderr.write(
      '[nf-solve] WARNING: ROOT does not look like a project root ' +
      '(no package.json, .planning/, or CLAUDE.md at ' + ROOT + '). ' +
      'Skipping directory creation. Pass --project-root= to specify the correct path.\n'
    );
    return;
  }

  const formalDir = path.join(ROOT, '.planning', 'formal');
  const subdirs = ['tla', 'alloy', 'generated-stubs'];
  let created = false;

  if (!fs.existsSync(formalDir)) {
    fs.mkdirSync(formalDir, { recursive: true });
    created = true;
  }

  for (const sub of subdirs) {
    const subPath = path.join(formalDir, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
      created = true;
    }
  }

  // Seed model-registry.json if missing
  const registryPath = path.join(formalDir, 'model-registry.json');
  if (!fs.existsSync(registryPath)) {
    try {
      fs.writeFileSync(registryPath, JSON.stringify({ models: [], search_dirs: [] }, null, 2) + '\n');
      created = true;
    } catch (e) {
      // fail-open
    }
  }

  if (created) {
    process.stderr.write(TAG + ' Bootstrapped formal infrastructure\n');
  }

  // Check formal tool installation (install-formal-tools.cjs)
  try {
    const { resolveTlaJar, resolveAlloyJar } = require('./resolve-formal-tools.cjs');
    if (!resolveTlaJar(ROOT) || !resolveAlloyJar(ROOT)) {
      process.stderr.write(TAG + ' Formal tools missing — running install-formal-tools.cjs\n');
      spawnTool('bin/install-formal-tools.cjs', []);
    }
  } catch (e) {
    // fail-open: tools install is best-effort
  }

  // Refresh PRISM constants from scoreboard (export-prism-constants.cjs)
  try {
    const scoreboardPath = path.join(ROOT, '.planning', 'quorum-scoreboard.json');
    if (fs.existsSync(scoreboardPath)) {
      const prismResult = spawnTool('bin/export-prism-constants.cjs', []);
      if (!prismResult.ok) {
        process.stderr.write(TAG + ' WARNING: export-prism-constants.cjs failed; PRISM constants may be stale\n');
      }
    }
  } catch (e) {
    // fail-open: PRISM constants refresh is best-effort
  }

  // Rebuild proximity index (formal-proximity.cjs)
  if (skipProximity) {
    process.stderr.write(TAG + ' Skipping proximity index rebuild (--skip-proximity)\n');
  } else {
    try {
      const specDir = path.join(ROOT, '.planning', 'formal', 'spec');
      if (fs.existsSync(specDir)) {
        process.stderr.write(TAG + ' Rebuilding proximity index\n');
        const proxResult = spawnTool('bin/formal-proximity.cjs', []);
        if (!proxResult.ok) {
          process.stderr.write(TAG + ' WARNING: formal-proximity.cjs failed; proximity index may be stale\n');
        }
      }
    } catch (e) {
      // fail-open: proximity index rebuild is best-effort
    }
  }
}

// ── Layer transition sweeps ──────────────────────────────────────────────────

/**
 * Triage requirements by formalizability.
 * Scores each requirement into HIGH/MEDIUM/LOW/SKIP priority buckets.
 * @param {Array} requirements - Array of requirement objects with text/description fields
 * @returns {{ high: string[], medium: string[], low: string[], skip: string[] }}
 */
function triageRequirements(requirements) {
  const HIGH_KEYWORDS = ['shall', 'must', 'invariant', 'constraint'];
  const MEDIUM_KEYWORDS = ['should', 'verify', 'ensure', 'validate', 'check'];
  const LOW_KEYWORDS = ['may', 'could', 'consider', 'nice-to-have'];
  const SKIP_KEYWORDS = ['deferred', 'out-of-scope', 'deprecated'];

  const result = { high: [], medium: [], low: [], skip: [] };

  for (const req of requirements) {
    const id = req.id || req.requirement_id || '';
    if (!id) continue;

    const text = (req.text || req.description || '').toLowerCase();

    // Check formalizability field override
    if (req.formalizability === 'high') {
      result.high.push(id);
      continue;
    }

    // Priority order: SKIP > HIGH > MEDIUM > LOW
    if (SKIP_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(text))) {
      result.skip.push(id);
    } else if (HIGH_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(text))) {
      result.high.push(id);
    } else if (MEDIUM_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(text))) {
      result.medium.push(id);
    } else if (LOW_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(text))) {
      result.low.push(id);
    } else {
      result.low.push(id); // default to low if no keywords match
    }
  }

  return result;
}

/**
 * R->F: Requirements to Formal coverage.
 * Returns { residual: N, detail: {...} }
 */
function sweepRtoF() {
  const result = spawnTool('bin/generate-traceability-matrix.cjs', [
    '--json',
    '--quiet',
  ]);

  if (!result.ok) {
    return {
      residual: -1,
      detail: {
        error: result.stderr || 'generate-traceability-matrix.cjs failed',
      },
    };
  }

  try {
    const matrix = JSON.parse(result.stdout);
    const coverage = matrix.coverage_summary || {};
    const uncovered = coverage.uncovered_requirements || [];
    const total = coverage.total_requirements || 0;
    const covered = coverage.covered_requirements || 0;
    const percentage = total > 0 ? ((covered / total) * 100).toFixed(1) : 0;

    // Triage uncovered requirements by formalizability
    // Load full requirements to get text for keyword matching
    const reqPath = path.join(ROOT, '.planning', 'formal', 'requirements.json');
    let uncoveredReqs = [];
    try {
      const reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
      let allReqs = [];
      if (Array.isArray(reqData)) {
        allReqs = reqData;
      } else if (reqData.requirements && Array.isArray(reqData.requirements)) {
        allReqs = reqData.requirements;
      } else if (reqData.groups && Array.isArray(reqData.groups)) {
        for (const group of reqData.groups) {
          if (group.requirements && Array.isArray(group.requirements)) {
            for (const r of group.requirements) allReqs.push(r);
          }
        }
      }
      const uncoveredSet = new Set(uncovered);
      uncoveredReqs = allReqs.filter(r => uncoveredSet.has(r.id || r.requirement_id || ''));
    } catch (e) {
      // Can't load requirements — skip triage
    }

    // Apply focus filter if active
    if (focusSet) {
      uncoveredReqs = uncoveredReqs.filter(r => focusSet.has(r.id || r.requirement_id || ''));
    }

    const triage = triageRequirements(uncoveredReqs);
    const highIds = triage.high;
    const mediumIds = triage.medium;
    const priority_batch = highIds.concat(mediumIds).slice(0, 15);

    return {
      residual: uncovered.length,
      detail: {
        uncovered_requirements: uncovered,
        total: total,
        covered: covered,
        percentage: percentage,
        triage: {
          high: triage.high.length,
          medium: triage.medium.length,
          low: triage.low.length,
          skip: triage.skip.length,
        },
        priority_batch: priority_batch,
      },
    };
  } catch (err) {
    return {
      residual: -1,
      detail: { error: 'Failed to parse traceability matrix: ' + err.message },
    };
  }
}

/**
 * Cache for formal-test-sync.cjs --json --report-only result.
 */
let formalTestSyncCache = null;

/**
 * Helper to load and cache formal-test-sync result.
 */
function loadFormalTestSync() {
  if (formalTestSyncCache) return formalTestSyncCache;

  const result = spawnTool('bin/formal-test-sync.cjs', [
    '--json',
    '--report-only',
  ]);

  if (!result.ok) {
    formalTestSyncCache = null;
    return null;
  }

  try {
    formalTestSyncCache = JSON.parse(result.stdout);
    return formalTestSyncCache;
  } catch (err) {
    formalTestSyncCache = null;
    return null;
  }
}

/**
 * Cache for code-trace-index.json result.
 */
let codeTraceIndexCache = null;

/**
 * Helper to load and cache code-trace index.
 * Returns null on missing or parse error (graceful degradation).
 */
function loadCodeTraceIndex() {
  if (codeTraceIndexCache) return codeTraceIndexCache;

  const indexPath = path.join(ROOT, '.planning', 'formal', 'code-trace-index.json');
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    codeTraceIndexCache = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return codeTraceIndexCache;
  } catch (err) {
    return null;
  }
}

/**
 * Rebuild code-trace index from recipes and scopes.
 * Called before each computeResidual to ensure fresh data.
 */
function rebuildCodeTraceIndex() {
  codeTraceIndexCache = null;  // Clear cache

  try {
    const { buildIndex } = require('./build-code-trace.cjs');
    const index = buildIndex(ROOT);
    codeTraceIndexCache = index;
    return index;
  } catch (err) {
    return null;
  }
}

/**
 * F->T: Formal to Tests coverage.
 * Returns { residual: N, detail: {...} }
 */
function sweepFtoT() {
  const syncData = loadFormalTestSync();

  if (!syncData) {
    return {
      residual: -1,
      detail: { error: 'formal-test-sync.cjs failed' },
    };
  }

  const gaps = syncData.coverage_gaps || {};
  const stats = gaps.stats || {};
  let gapCount = stats.gap_count || 0;
  let gapsList = gaps.gaps || [];

  // Apply focus filter if active
  if (focusSet) {
    gapsList = gapsList.filter(g => focusSet.has(g.requirement_id || g));
    gapCount = gapsList.length;
  }

  return {
    residual: gapCount,
    detail: {
      gap_count: gapCount,
      formal_covered: stats.formal_covered || 0,
      test_covered: stats.test_covered || 0,
      gaps: gapsList.map((g) => g.requirement_id || g),
    },
  };
}

/**
 * C->F: Code constants to Formal constants.
 * Returns { residual: N, detail: {...} }
 */
function sweepCtoF() {
  const syncData = loadFormalTestSync();

  if (!syncData) {
    return {
      residual: -1,
      detail: { error: 'formal-test-sync.cjs failed' },
    };
  }

  const validation = syncData.constants_validation || [];
  const mismatches = validation.filter((entry) => {
    return (
      entry.match === false &&
      entry.intentional_divergence !== true &&
      entry.config_path !== null
    );
  });

  // Enrich mismatches with proximity graph data (fail-open)
  let enrichedMismatches = mismatches.map((m) => ({
    constant: m.constant,
    source: m.source,
    formal_value: m.formal_value,
    config_value: m.config_value,
  }));

  try {
    const indexPath = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
    if (fs.existsSync(indexPath) && mismatches.length > 0) {
      const { reach } = require('./formal-query.cjs');
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

      enrichedMismatches = mismatches.map((m) => {
        const entry = {
          constant: m.constant,
          source: m.source,
          formal_value: m.formal_value,
          config_value: m.config_value,
        };

        const constKey = 'constant::' + m.constant;
        if (index.nodes && index.nodes[constKey]) {
          const filter = ['invariant', 'requirement', 'formal_model'];
          const reachable = reach(index, constKey, 3, filter);
          const affected = [];
          for (const nodes of Object.values(reachable)) {
            for (const n of nodes) {
              affected.push({ type: n.type, id: n.key.split('::').slice(1).join('::'), via: n.rel });
            }
          }
          if (affected.length > 0) {
            entry.affected = affected;
          }
        }

        return entry;
      });
    }
  } catch (e) {
    // fail-open: proximity enrichment is best-effort
  }

  return {
    residual: mismatches.length,
    detail: {
      mismatches: enrichedMismatches,
      scoped: focusSet ? false : undefined,
    },
  };
}

/**
 * T->C: Tests to Code.
 * Returns { residual: N, detail: {...} }
 */
function sweepTtoC() {
  // Guard: if we're already running inside a node --test subprocess spawned by a
  // previous sweepTtoC() call, return a skip immediately.  Without this, any test
  // that calls sweepTtoC() (or computeResidual()) would trigger an infinite chain
  // of recursive `node --test` subprocesses that never terminate.
  if (process.env.NF_SOLVE_SWEEPTOC_ACTIVE) {
    return { residual: -1, detail: { skipped: true, reason: 'recursive-guard: already running inside node --test' } };
  }

  // Load configurable test runner settings
  const configPath = path.join(ROOT, '.planning', 'config.json');
  let tToCConfig = { runner: 'node-test', command: null, scope: 'all' };
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (cfg.solve && cfg.solve.t_to_c) {
      tToCConfig = { ...tToCConfig, ...cfg.solve.t_to_c };
    }
  } catch (e) { /* use defaults */ }

  // Runner mode: none — skip entirely
  if (tToCConfig.runner === 'none') {
    return { residual: 0, detail: { skipped: true, reason: 'runner=none in config' } };
  }

  const spawnOpts = {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 120000,
    stdio: verboseMode ? ['pipe', 'pipe', 'inherit'] : 'pipe',
  };

  // Runner mode: jest
  if (tToCConfig.runner === 'jest') {
    const jestCmd = tToCConfig.command || 'npx';
    const jestArgs = tToCConfig.command ? [] : ['jest', '--ci', '--json'];
    let result;
    try {
      result = spawnSync(jestCmd, jestArgs, spawnOpts);
    } catch (err) {
      return {
        residual: -1,
        detail: { error: 'Failed to spawn jest: ' + err.message },
      };
    }

    const output = (result.stdout || '') + (result.stderr || '');
    // Try to parse Jest JSON output
    try {
      const jsonStart = output.indexOf('{');
      if (jsonStart >= 0) {
        const jestResult = JSON.parse(output.slice(jsonStart));
        const failCount = jestResult.numFailedTests || 0;
        const totalTests = jestResult.numTotalTests || 0;
        return {
          residual: failCount,
          detail: {
            total_tests: totalTests,
            passed: totalTests - failCount,
            failed: failCount,
            skipped: 0,
            todo: 0,
            runner: 'jest',
            scoped: focusSet ? false : undefined,
          },
        };
      }
    } catch (e) { /* fall through to TAP parsing */ }

    return {
      residual: -1,
      detail: { error: 'Failed to parse jest output', runner: 'jest' },
    };
  }

  // Runner mode: node-test (default)
  // V8 coverage collection: create temp dir and set NODE_V8_COVERAGE env var
  let covDir = null;
  try {
    covDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-solve-cov-'));
    spawnOpts.env = Object.assign({}, process.env, { NODE_V8_COVERAGE: covDir, NF_SOLVE_SWEEPTOC_ACTIVE: '1' });
  } catch (e) {
    covDir = null; // fail-open: continue without coverage
  }

  // Ensure guard env var is always set, even when covDir creation failed
  if (!spawnOpts.env) {
    spawnOpts.env = Object.assign({}, process.env, { NF_SOLVE_SWEEPTOC_ACTIVE: '1' });
  }

  let result;
  try {
    result = spawnSync(process.execPath, ['--test'], spawnOpts);
  } catch (err) {
    return {
      residual: -1,
      detail: { error: 'Failed to spawn node --test: ' + err.message },
    };
  }

  const output = (result.stdout || '') + (result.stderr || '');

  // Parse TAP output for test summary.
  // Support both # prefix (Node <= v24) and ℹ prefix (Node v25+)
  let totalTests = 0;
  let failCount = 0;
  let skipCount = 0;
  let todoCount = 0;

  const testsMatch = output.match(/^[ℹ#]\s+tests\s+(\d+)/m);
  if (testsMatch) totalTests = parseInt(testsMatch[1], 10);

  const failMatch = output.match(/^[ℹ#]\s+fail\s+(\d+)/m);
  if (failMatch) failCount = parseInt(failMatch[1], 10);

  const skipMatch = output.match(/^[ℹ#]\s+skipped\s+(\d+)/m);
  if (skipMatch) skipCount = parseInt(skipMatch[1], 10);

  const todoMatch = output.match(/^[ℹ#]\s+todo\s+(\d+)/m);
  if (todoMatch) todoCount = parseInt(todoMatch[1], 10);

  // Fallback: count "not ok" lines if summary not found
  if (failCount === 0 && totalTests === 0) {
    const notOkMatches = output.match(/^not ok\s+\d+/gm) || [];
    failCount = notOkMatches.length;
    const okMatches = output.match(/^ok\s+\d+/gm) || [];
    totalTests = notOkMatches.length + okMatches.length;
    skipCount = 0;
    todoCount = 0;
  }

  // Collect V8 coverage data from temp directory (fail-open)
  let coverageData = null;
  try {
    if (covDir && fs.existsSync(covDir)) {
      const covFiles = fs.readdirSync(covDir).filter(f => f.endsWith('.json'));
      coverageData = [];
      for (const cf of covFiles) {
        const raw = fs.readFileSync(path.join(covDir, cf), 'utf8');
        coverageData.push(JSON.parse(raw));
      }
      if (coverageData.length === 0) coverageData = null;
    }
  } catch (e) {
    coverageData = null; // fail-open
  } finally {
    try {
      if (covDir) fs.rmSync(covDir, { recursive: true, force: true });
    } catch (e) { /* ignore cleanup errors */ }
  }

  // Digest V8 coverage: replace raw array with lightweight format
  if (coverageData) {
    coverageData = digestV8Coverage(coverageData);
  }

  // Scope-based auto-detection: if scope is "generated-stubs-only", check if all failures
  // are outside .planning/formal/generated-stubs/
  if (tToCConfig.runner === 'node-test' && tToCConfig.scope === 'generated-stubs-only' && failCount > 0) {
    const failLines = output.match(/^not ok\s+\d+\s+.*/gm) || [];
    const stubFailures = failLines.filter(l => l.includes('generated-stubs'));
    if (stubFailures.length === 0 && failLines.length > 0) {
      return {
        residual: 0,
        detail: {
          total_tests: totalTests,
          passed: Math.max(0, totalTests - failCount - skipCount - todoCount),
          failed: failCount,
          skipped: skipCount,
          todo: todoCount,
          runner_mismatch: true,
          warning: 'All ' + failLines.length + ' failures are outside generated-stubs scope — likely runner mismatch',
          v8_coverage: coverageData,
          scoped: focusSet ? false : undefined,
        },
      };
    }
  }

  return {
    residual: failCount + skipCount,
    detail: {
      total_tests: totalTests,
      passed: Math.max(0, totalTests - failCount - skipCount - todoCount),
      failed: failCount,
      skipped: skipCount,
      todo: todoCount,
      v8_coverage: coverageData,
      scoped: focusSet ? false : undefined,
    },
  };
}

/**
 * Digest V8 coverage data: convert raw coverage array to a lightweight per-file format.
 * Input: array of V8 coverage entries (each with .result[] containing .url, .functions[], .source)
 * Output: { files: { [absolutePath]: { covered: number[], uncovered: number[] } } }
 *
 * Purpose: Reduce raw ~96MB V8 JSON to ~50KB by storing only file paths and covered/uncovered line sets.
 * Fail-open: If any entry throws, skip it and continue.
 */
function digestV8Coverage(coverageData) {
  if (!coverageData || !Array.isArray(coverageData)) return null;

  const files = {};

  try {
    for (const entry of coverageData) {
      const results = entry.result || [];

      for (const r of results) {
        if (!r.url) continue;

        // Skip internal node: URLs
        if (r.url.startsWith('node:')) continue;

        try {
          // Extract and resolve file path
          const filePath = r.url.startsWith('file://') ? r.url.slice(7) : r.url;
          const absolutePath = path.resolve(filePath);

          // Initialize file entry if not present
          if (!files[absolutePath]) {
            files[absolutePath] = { covered: [], uncovered: [] };
          }

          // Get source text to build line offset array
          const source = r.source;
          if (!source) {
            // Fallback: if no source, use file-level granularity (boolean)
            // If ANY function range has count > 0, mark file as covered
            const hasCoverage = (r.functions || []).some(fn =>
              (fn.ranges || []).some(range => range.count > 0)
            );
            if (hasCoverage) {
              files[absolutePath].covered = [true];  // boolean marker
            } else {
              files[absolutePath].uncovered = [true];  // boolean marker
            }
            continue;
          }

          // Build line offset array from source text
          const lineOffsets = [0];  // First line starts at offset 0
          for (let i = 0; i < source.length; i++) {
            if (source[i] === '\n') {
              lineOffsets.push(i + 1);
            }
          }

          // Map ranges to line numbers
          const coveredLines = new Set();
          const uncoveredLines = new Set();

          for (const fn of (r.functions || [])) {
            for (const range of (fn.ranges || [])) {
              const startOffset = range.startOffset;
              const endOffset = range.endOffset;
              const count = range.count || 0;

              // Find line numbers that this range covers
              let startLine = lineOffsets.findIndex(offset => offset > startOffset);
              if (startLine === -1) startLine = lineOffsets.length - 1;
              else startLine = Math.max(0, startLine - 1);

              let endLine = lineOffsets.findIndex(offset => offset >= endOffset);
              if (endLine === -1) endLine = lineOffsets.length - 1;

              // Add lines to appropriate set (1-indexed for output)
              for (let lineIdx = startLine; lineIdx < endLine && lineIdx < lineOffsets.length; lineIdx++) {
                const lineNum = lineIdx + 1;
                if (count > 0) {
                  coveredLines.add(lineNum);
                } else {
                  uncoveredLines.add(lineNum);
                }
              }
            }
          }

          // Update file entry with deduplicated, sorted line arrays
          files[absolutePath].covered = Array.from(coveredLines).sort((a, b) => a - b);
          files[absolutePath].uncovered = Array.from(uncoveredLines).filter(
            l => !coveredLines.has(l)
          ).sort((a, b) => a - b);

        } catch (entryErr) {
          // Fail-open: skip this result entry
          continue;
        }
      }
    }
  } catch (err) {
    // Fail-open: return whatever we've collected so far
  }

  return Object.keys(files).length > 0 ? { files } : null;
}

/**
 * Cross-reference V8 coverage data against formal-test-sync recipe source_files.
 * Identifies "false green" properties: tests pass but exercise none of the implementing source files.
 * Returns { available: false } when coverage data is null/undefined.
 *
 * Handles both digest format (new: { files: {...} }) and legacy raw array format.
 */
function crossReferenceFormalCoverage(v8CoverageData) {
  if (!v8CoverageData) return { available: false };

  try {
    const syncData = loadFormalTestSync();
    const recipes = (syncData && syncData.recipes) ? syncData.recipes : [];

    // Build set of covered absolute file paths from V8 data
    const coveredFiles = new Set();

    // Detect format: digest format has .files property; legacy is array
    if (v8CoverageData.files && typeof v8CoverageData.files === 'object') {
      // Digest format: files are keys in the .files object
      for (const absolutePath of Object.keys(v8CoverageData.files)) {
        const fileEntry = v8CoverageData.files[absolutePath];
        // If any covered lines exist (non-empty array), mark file as covered
        if (fileEntry && fileEntry.covered && Array.isArray(fileEntry.covered) && fileEntry.covered.length > 0) {
          coveredFiles.add(path.resolve(absolutePath));
        }
      }
    } else if (Array.isArray(v8CoverageData)) {
      // Legacy raw array format: parse V8 entries
      for (const entry of v8CoverageData) {
        const results = entry.result || [];
        for (const r of results) {
          if (!r.url) continue;
          const filePath = r.url.startsWith('file://') ? r.url.slice(7) : r.url;
          const resolved = path.resolve(filePath);
          // A file is "covered" if ANY function range has count > 0
          const hasCoverage = (r.functions || []).some(fn =>
            (fn.ranges || []).some(range => range.count > 0)
          );
          if (hasCoverage) coveredFiles.add(resolved);
        }
      }
    }

    const coverageRatios = [];
    const falseGreens = [];
    let propertiesWithTests = 0;
    let fullyCovered = 0;
    let partiallyCovered = 0;
    let uncovered = 0;

    for (const recipe of recipes) {
      const sourceFiles = recipe.source_files_absolute || [];
      if (sourceFiles.length === 0) continue;
      const hasTest = !!(recipe.test_file || recipe.test_files);
      if (hasTest) propertiesWithTests++;

      let coveredCount = 0;
      for (const sf of sourceFiles) {
        if (coveredFiles.has(path.resolve(sf))) coveredCount++;
      }
      const ratio = coveredCount / sourceFiles.length;
      const propName = recipe.property || recipe.invariant || recipe.id || 'unknown';

      coverageRatios.push({ property: propName, ratio: ratio });

      if (ratio === 0 && hasTest) {
        falseGreens.push({
          property: propName,
          test_file: recipe.test_file || (recipe.test_files || [])[0] || 'unknown',
          source_files: sourceFiles,
          covered: 0,
        });
        uncovered++;
      } else if (ratio < 1) {
        partiallyCovered++;
      } else {
        fullyCovered++;
      }
    }

    return {
      available: true,
      total_properties: recipes.length,
      properties_with_tests: propertiesWithTests,
      false_greens: falseGreens,
      coverage_ratios: coverageRatios,
      summary: {
        fully_covered: fullyCovered,
        partially_covered: partiallyCovered,
        uncovered: uncovered,
      },
    };
  } catch (e) {
    return { available: false };
  }
}

/**
 * F->C: Formal verification to Code.
 * Returns { residual: N, detail: {...} }
 */
function sweepFtoC() {
  const verifyScript = path.join(SCRIPT_DIR, 'run-formal-verify.cjs');

  if (!fs.existsSync(verifyScript)) {
    return {
      residual: -1,
      detail: { skipped: true, reason: 'missing: run-formal-verify.cjs' },
    };
  }

  // Always run formal verification to get fresh data (all 88+ checks).
  // Previously, report-only mode read stale check-results.ndjson which often
  // contained only 4 CI-gated checks, hiding individual alloy/tla/prism failures.
  // Now matches sweepTtoC behavior: always compute fresh diagnostic data.
  // The --report-only flag prevents auto-close remediation (line ~1400), not data collection.
  //
  // stdio: discard stdout ('ignore') because run-formal-verify.cjs writes ~4MB of
  // verbose progress output. We only need the NDJSON file it writes to disk.
  // Without this, spawnSync's maxBuffer limit kills the child mid-run, resulting
  // in a partial NDJSON with only 3-4 CI checks instead of the full 88+.
  const result = spawnTool('bin/run-formal-verify.cjs', [], {
    timeout: 600000,
    stdio: ['pipe', 'ignore', 'pipe'],
  });

  // Generate complexity profile from fresh check-results.ndjson + state-space data
  try {
    spawnTool('bin/model-complexity-profile.cjs', ['--quiet']);
  } catch (e) {
    // fail-open: profiler is informational
  }

  // Non-zero exit is expected when checks fail — still parse check-results.ndjson.
  // Only bail on spawn errors (result.stderr without any ndjson output).
  if (!result.ok && result.stderr && !fs.existsSync(path.join(ROOT, '.planning', 'formal', 'check-results.ndjson'))) {
    return {
      residual: -1,
      detail: { error: result.stderr.slice(0, 500) || 'run-formal-verify.cjs failed' },
    };
  }

  // Parse .planning/formal/check-results.ndjson
  const checkResultsPath = path.join(ROOT, '.planning', 'formal', 'check-results.ndjson');

  if (!fs.existsSync(checkResultsPath)) {
    return {
      residual: -1,
      detail: { skipped: true, reason: 'missing: check-results.ndjson' },
    };
  }

  try {
    const lines = fs.readFileSync(checkResultsPath, 'utf8').split('\n');

    // Deduplicate: when multiple runs append to the same NDJSON file,
    // take the LAST entry per check_id (most recent result wins).
    const deduped = new Map();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const id = entry.check_id || entry.id || '?';
        deduped.set(id, entry);
      } catch (e) {
        // skip malformed lines
      }
    }

    let failedCount = 0;
    let errorCount = 0;
    let inconclusiveCount = 0;
    let totalCount = deduped.size;
    const failures = [];
    const errors = [];
    const inconclusiveChecks = [];

    for (const entry of deduped.values()) {
      if (entry.result === 'fail') {
        failedCount++;
        failures.push({
          check_id: entry.check_id || entry.id || '?',
          summary: entry.summary || '',
          requirement_ids: entry.requirement_ids || [],
        });
      } else if (entry.result === 'error') {
        errorCount++;
        errors.push({
          check_id: entry.check_id || entry.id || '?',
          summary: entry.summary || '',
          requirement_ids: entry.requirement_ids || [],
        });
      } else if (entry.result === 'inconclusive') {
        inconclusiveCount++;
        inconclusiveChecks.push({
          check_id: entry.check_id || entry.id || '?',
          summary: entry.summary || '',
        });
      }
    }

    const existingDetail = {
      total_checks: totalCount,
      passed: Math.max(0, totalCount - failedCount - errorCount - inconclusiveCount),
      failed: failedCount,
      error_count: errorCount,
      inconclusive: inconclusiveCount,
      failures: failures,
      errors: errors,
      inconclusive_checks: inconclusiveChecks,
      scoped: focusSet ? false : undefined,
    };

    // Conformance trace self-healing: detect schema mismatch
    const conformancePath = path.join(ROOT, '.planning', 'formal', 'trace', 'conformance-events.jsonl');
    if (fs.existsSync(conformancePath)) {
      try {
        const events = fs.readFileSync(conformancePath, 'utf8').split('\n')
          .filter(l => l.trim())
          .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
          .filter(Boolean);

        const eventTypes = new Set(events.map(e => e.type || e.event));

        // Try to load XState machine event types from spec/
        const specDir = path.join(ROOT, '.planning', 'formal', 'spec');
        let machineEventTypes = new Set();
        if (fs.existsSync(specDir)) {
          const specFiles = walkDir(specDir, 3, 0);
          for (const f of specFiles) {
            if (!f.endsWith('.json') && !f.endsWith('.js')) continue;
            try {
              const content = fs.readFileSync(f, 'utf8');
              // Extract event types from "on": { "EVENT_NAME": ... } patterns
              const onMatches = content.matchAll(/"on"\s*:\s*\{([^}]+)\}/g);
              for (const m of onMatches) {
                const keys = m[1].matchAll(/"([A-Z_]+)"/g);
                for (const k of keys) machineEventTypes.add(k[1]);
              }
            } catch(e) { /* skip */ }
          }
        }

        if (machineEventTypes.size > 0 && eventTypes.size > 0) {
          const overlap = [...eventTypes].filter(t => machineEventTypes.has(t)).length;
          const overlapPct = overlap / Math.max(eventTypes.size, 1);

          if (overlapPct < 0.5) {
            // Schema mismatch — reclassify
            return {
              residual: failedCount,
              detail: {
                ...existingDetail,
                schema_mismatch: true,
                schema_mismatch_detail: {
                  trace_event_types: eventTypes.size,
                  machine_event_types: machineEventTypes.size,
                  overlap: overlap,
                  overlap_pct: (overlapPct * 100).toFixed(1) + '%',
                },
                note: 'Conformance trace has <50% event type overlap with state machine — likely schema mismatch, not verification failure',
              },
            };
          }
        }
      } catch (e) {
        // Conformance trace check failed — fail-open, continue with normal result
      }
    }

    return {
      residual: failedCount,
      detail: existingDetail,
    };
  } catch (err) {
    return {
      residual: -1,
      detail: { error: 'Failed to parse check-results.ndjson: ' + err.message },
    };
  }
}

/**
 * R->D: Requirements to Documentation.
 * Detects requirements not mentioned in developer docs (by ID or keyword match).
 * Returns { residual: N, detail: {...} }
 */
function sweepRtoD() {
  // Load requirements.json
  const reqPath = path.join(ROOT, '.planning', 'formal', 'requirements.json');
  if (!fs.existsSync(reqPath)) {
    return {
      residual: -1,
      detail: { skipped: true, reason: 'missing: requirements.json' },
    };
  }

  let reqData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {
    return {
      residual: -1,
      detail: { skipped: true, reason: 'missing: requirements.json (parse error: ' + e.message + ')' },
    };
  }

  // Discover doc files
  const allDiscovered = discoverDocFiles();
  // Only scan developer-category docs for R->D gap detection.
  // User docs (category='user') are human-controlled and must not drive auto-remediation.
  // Fall back to all docs only if no developer-category files exist (legacy setup).
  const developerDocs = allDiscovered.filter(f => f.category === 'developer');
  const docFiles = developerDocs.length > 0 ? developerDocs : allDiscovered;
  if (docFiles.length === 0) {
    return {
      residual: -1,
      detail: { skipped: true, reason: 'missing: doc files' },
    };
  }

  // Concatenate all doc content
  let allDocContent = '';
  for (const { absPath } of docFiles) {
    try {
      allDocContent += fs.readFileSync(absPath, 'utf8') + '\n';
    } catch (e) {
      // skip unreadable files
    }
  }
  const allDocContentLower = allDocContent.toLowerCase();

  // Get requirements array - handle both flat array and envelope format
  let requirements = [];
  if (Array.isArray(reqData)) {
    requirements = reqData;
  } else if (reqData.requirements && Array.isArray(reqData.requirements)) {
    requirements = reqData.requirements;
  } else if (reqData.groups && Array.isArray(reqData.groups)) {
    // Envelope format with groups
    for (const group of reqData.groups) {
      if (group.requirements && Array.isArray(group.requirements)) {
        for (const r of group.requirements) requirements.push(r);
      }
    }
  }

  // Apply focus filter if active
  if (focusSet) {
    requirements = requirements.filter(r => focusSet.has(r.id || r.requirement_id || ''));
  }

  const undocumented = [];
  let documented = 0;

  for (const req of requirements) {
    const id = req.id || req.requirement_id || '';
    const text = req.text || req.description || '';
    if (!id) continue;

    // Primary: literal ID match (case-sensitive)
    if (allDocContent.includes(id)) {
      documented++;
      continue;
    }

    // Secondary: keyword match (case-insensitive, 3+ keywords)
    const keywords = extractKeywords(text);
    if (keywords.length > 0) {
      let matchCount = 0;
      for (const kw of keywords) {
        if (allDocContentLower.includes(kw)) {
          matchCount++;
        }
      }
      if (matchCount >= 3) {
        documented++;
        continue;
      }
    }

    undocumented.push(id);
  }

  return {
    residual: undocumented.length,
    detail: {
      undocumented_requirements: undocumented,
      total_requirements: requirements.length,
      documented: documented,
      doc_files_scanned: docFiles.length,
      developer_docs_only: developerDocs.length > 0,
    },
  };
}

/**
 * D->C: Documentation to Code.
 * Detects stale structural claims in docs (dead file paths, missing CLI commands, absent dependencies).
 * Returns { residual: N, detail: {...} }
 */
function sweepDtoC() {
  const docFiles = discoverDocFiles();
  if (docFiles.length === 0) {
    return {
      residual: -1,
      detail: { skipped: true, reason: 'missing: doc files' },
    };
  }

  // Load package.json for dependency verification
  let pkgDeps = {};
  let pkgDevDeps = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    pkgDeps = pkg.dependencies || {};
    pkgDevDeps = pkg.devDependencies || {};
  } catch (e) {
    // No package.json — skip dependency checks
  }

  // Load acknowledged false positives
  const fpPath = path.join(ROOT, '.planning', 'formal', 'acknowledged-false-positives.json');
  let acknowledgedFPs = new Set();
  try {
    const fpData = JSON.parse(fs.readFileSync(fpPath, 'utf8'));
    for (const entry of (fpData.entries || [])) {
      // Key by doc_file + value only (no line numbers — line numbers shift on edits and break suppression)
      acknowledgedFPs.add(entry.doc_file + ':' + entry.value);
    }
  } catch (e) { /* no ack file */ }

  // Load pattern-based suppression rules
  let fpPatterns = [];
  try {
    const fpData = JSON.parse(fs.readFileSync(fpPath, 'utf8'));
    for (const entry of (fpData.patterns || [])) {
      if (entry.enabled === false) continue;
      try {
        fpPatterns.push({ type: entry.type, regex: new RegExp(entry.regex), reason: entry.reason });
      } catch (regexErr) {
        console.warn('Skipping malformed FP pattern:', entry.regex, regexErr.message);
      }
    }
  } catch (e) { /* no ack file or malformed */ }

  // Severity weights: user-facing broken claims count more
  const CATEGORY_WEIGHT = { user: 2, examples: 1.5, developer: 1, unknown: 1 };

  // Build a set of known project command/skill names from commands/ directory
  // Values matching these are project terms, not npm dependencies
  const projectCommands = new Set();
  try {
    const cmdDir = path.join(ROOT, 'commands', 'nf');
    if (fs.existsSync(cmdDir)) {
      for (const f of fs.readdirSync(cmdDir)) {
        projectCommands.add(f.replace(/\.\w+$/, '')); // strip extension
      }
    }
    // Also scan bin/ for script basenames (e.g., run-formal-verify.cjs -> run-formal-verify)
    const binDir = path.join(ROOT, 'bin');
    if (fs.existsSync(binDir)) {
      for (const f of fs.readdirSync(binDir)) {
        if (/\.(cjs|js|mjs)$/.test(f)) {
          projectCommands.add(f.replace(/\.\w+$/, ''));
        }
      }
    }
  } catch (e) { /* best effort */ }

  const brokenClaims = [];
  let totalClaimsChecked = 0;
  let suppressedFpCount = 0;

  for (const { absPath, category } of docFiles) {
    let content;
    try {
      content = fs.readFileSync(absPath, 'utf8');
    } catch (e) {
      continue;
    }

    const relativePath = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const claims = extractStructuralClaims(content, relativePath);

    for (const claim of claims) {
      totalClaimsChecked++;

      let isBroken = false;
      let reason = '';

      if (claim.type === 'file_path') {
        // Verify file exists — try ROOT first, then common parent directories
        // (docs often reference files relative to .planning/formal/ in tables)
        const claimAbsPath = path.join(ROOT, claim.value);
        const formalFallback = path.join(ROOT, '.planning', 'formal', claim.value);
        if (!fs.existsSync(claimAbsPath) && !fs.existsSync(formalFallback)) {
          // Skip runtime output files that get created on first use
          const isRuntimeOutput = /\.(jsonl|ndjson)$/.test(claim.value);
          if (!isRuntimeOutput) {
            isBroken = true;
            reason = 'file not found';
          }
        }
      } else if (claim.type === 'cli_command') {
        // Extract script path from command (e.g., "node bin/foo.cjs" -> "bin/foo.cjs")
        const cmdParts = claim.value.split(/\s+/);
        if (cmdParts.length >= 2 && cmdParts[0] === 'node') {
          const scriptPath = cmdParts[1];
          if (!fs.existsSync(path.join(ROOT, scriptPath))) {
            isBroken = true;
            reason = 'script not found';
          }
        }
      } else if (claim.type === 'dependency') {
        // Verify in package.json — skip project-internal terms that look like deps
        if (!(claim.value in pkgDeps) && !(claim.value in pkgDevDeps)) {
          // Heuristic: values not in package.json that match project-internal patterns
          // are project terms, not missing dependencies. Safe here because real deps
          // already passed the package.json check above.
          const isProjectTerm =
            /-\d+$/.test(claim.value) ||                          // slot names (copilot-1, gemini-cli-1)
            /^mcp-/.test(claim.value) ||                          // nForma MCP commands
            /-server$/.test(claim.value) ||                       // MCP server references
            /qgsd/.test(claim.value) ||                           // old project name references
            projectCommands.has(claim.value);                     // matches a known command/skill name

          // Context-aware: skip deps in requirement spec text (describes behavior, not claims deps)
          const lineContent = content.split('\n')[claim.line - 1] || '';
          const isInRequirementText = /^\*\*Requirement:\*\*/.test(lineContent.trim());

          // Context-aware: skip deps in example/template files
          const isExampleFile = /\.example\.(md|yml|yaml)$/.test(relativePath);

          // Context-aware: skip deps that appear in enumeration lists (e.g., "one of 5 types: `a`, `b`")
          const isEnumContext = /\b(?:types?|categories|values?|one of|classify|classified)\b/i.test(lineContent);

          if (!isProjectTerm && !isInRequirementText && !isExampleFile && !isEnumContext) {
            isBroken = true;
            reason = 'not in package.json';
          }
        }
      }

      if (isBroken) {
        // Filter acknowledged false positives
        if (acknowledgedFPs.has(claim.doc_file + ':' + claim.value)) {
          suppressedFpCount++;
          continue;
        }

        // Auto-suppress known rebrand patterns (qgsd->nf renames from quick-186)
        const REBRAND_PATTERNS = [
          /qgsd-core\//,          // old qgsd-core/ directory references
          /qgsd[_-](?!.*\.md$)/,  // qgsd- or qgsd_ prefixes (not in .md filenames which are historical)
          /\/qgsd\//,             // /qgsd/ path segments
        ];
        if (claim.type === 'file_path') {
          const isRebrandArtifact = REBRAND_PATTERNS.some(rx => rx.test(claim.value));
          if (isRebrandArtifact) {
            suppressedFpCount++;
            continue;
          }
        }

        // Auto-suppress illustrative/example paths in documentation
        // (e.g., "Creates: `.planning/quick/001-add-dark-mode-toggle/PLAN.md`")
        if (claim.type === 'file_path') {
          const lineContent = content.split('\n')[claim.line - 1] || '';
          const isIllustrative =
            /\b(?:creates?|produces?|generates?|outputs?|e\.g\.|for example|such as)\b.*`/i.test(lineContent) ||
            /^\*\*Creates:\*\*/.test(lineContent.trim());
          if (isIllustrative) {
            suppressedFpCount++;
            continue;
          }
        }

        // Filter by pattern-based suppression rules
        let patternSuppressed = false;
        for (const pat of fpPatterns) {
          if (pat.type === claim.type && pat.regex.test(claim.value)) {
            patternSuppressed = true;
            break;
          }
        }
        if (patternSuppressed) {
          suppressedFpCount++;
          continue;
        }

        // Reduce weight for historical/archived docs
        let effectiveCategory = category;
        const docLower = claim.doc_file.toLowerCase();
        if (docLower.includes('changelog') || docLower.includes('history') ||
            docLower.includes('archived/') || docLower.includes('deprecated/')) {
          effectiveCategory = '_historical';
        }

        brokenClaims.push({
          doc_file: claim.doc_file,
          line: claim.line,
          type: claim.type,
          value: claim.value,
          reason: reason,
          category: effectiveCategory === '_historical' ? category : category,
          weight: effectiveCategory === '_historical' ? 0.1 : (CATEGORY_WEIGHT[category] || 1),
        });
      }
    }
  }

  // Weighted residual: user-facing broken claims count more
  let weightedResidual = 0;
  const categoryBreakdown = {};
  for (const bc of brokenClaims) {
    const w = bc.weight !== undefined ? bc.weight : (CATEGORY_WEIGHT[bc.category] || 1);
    weightedResidual += w;
    categoryBreakdown[bc.category] = (categoryBreakdown[bc.category] || 0) + 1;
  }

  // Persist D→C broken claims for manual review
  try {
    const evidenceDir = path.join(ROOT, '.planning', 'formal', 'evidence');
    if (fs.existsSync(evidenceDir)) {
      fs.writeFileSync(
        path.join(evidenceDir, 'doc-claims.json'),
        JSON.stringify({
          generated: new Date().toISOString(),
          total_claims_checked: totalClaimsChecked,
          doc_files_scanned: docFiles.length,
          raw_broken_count: brokenClaims.length,
          weighted_residual: Math.ceil(weightedResidual),
          suppressed_fp_count: suppressedFpCount,
          category_breakdown: categoryBreakdown,
          broken_claims: brokenClaims,
        }, null, 2) + '\n'
      );
    }
  } catch (e) {
    // fail-open: persistence is best-effort
  }

  return {
    residual: Math.ceil(weightedResidual),
    detail: {
      broken_claims: brokenClaims,
      total_claims_checked: totalClaimsChecked,
      doc_files_scanned: docFiles.length,
      raw_broken_count: brokenClaims.length,
      weighted_residual: weightedResidual,
      category_breakdown: categoryBreakdown,
      suppressed_fp_count: suppressedFpCount,
      scoped: focusSet ? false : undefined,
    },
  };
}

// ── Reverse traceability sweeps ──────────────────────────────────────────────

const MAX_REVERSE_CANDIDATES = 200;

/**
 * C->R: Code to Requirements (reverse).
 * Scans bin/ and hooks/ for source modules not traced to any requirement.
 * Returns { residual: N, detail: { untraced_modules: [{file}], total_modules, traced } }
 */
function sweepCtoR() {
  const reqPath = path.join(ROOT, '.planning', 'formal', 'requirements.json');
  if (!fs.existsSync(reqPath)) {
    return { residual: -1, detail: { skipped: true, reason: 'missing: requirements.json' } };
  }

  let reqData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {
    return { residual: -1, detail: { skipped: true, reason: 'missing: requirements.json (parse error)' } };
  }

  // Flatten requirements
  let requirements = [];
  if (Array.isArray(reqData)) {
    requirements = reqData;
  } else if (reqData.requirements && Array.isArray(reqData.requirements)) {
    requirements = reqData.requirements;
  } else if (reqData.groups && Array.isArray(reqData.groups)) {
    for (const group of reqData.groups) {
      if (group.requirements && Array.isArray(group.requirements)) {
        for (const r of group.requirements) requirements.push(r);
      }
    }
  }

  // Build searchable text from all requirements
  const allReqText = requirements.map(r => {
    const parts = [r.id || '', r.text || '', r.description || '', r.background || ''];
    if (r.provenance && r.provenance.source_file) parts.push(r.provenance.source_file);
    return parts.join(' ');
  }).join('\n');

  // Build Set of valid requirement IDs for header-comment fallback (O(1) lookup)
  const reqIdSet = new Set(requirements.filter(r => r.id).map(r => r.id));

  // Scan bin/ and hooks/ for source modules
  const scanDirs = ['bin', 'hooks'];
  const sourceFiles = [];

  for (const dir of scanDirs) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;

    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.cjs') && !entry.name.endsWith('.js') && !entry.name.endsWith('.mjs')) continue;
      // Skip test files, dist copies, and generated files
      if (entry.name.includes('.test.')) continue;
      if (dir === 'hooks' && entry.name === 'dist') continue;

      sourceFiles.push(path.join(dir, entry.name));
    }
  }

  // Also scan hooks/dist/ as separate entry point files
  const distDir = path.join(ROOT, 'hooks', 'dist');
  if (fs.existsSync(distDir)) {
    try {
      const distEntries = fs.readdirSync(distDir, { withFileTypes: true });
      for (const entry of distEntries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.cjs') && !entry.name.endsWith('.js')) continue;
        // dist/ files are copies — skip, they trace through their source in hooks/
      }
    } catch (e) {
      // skip
    }
  }

  const untraced = [];
  let traced = 0;

  // Load code-trace index for fast lookup
  const index = loadCodeTraceIndex();

  for (const file of sourceFiles) {
    const fileName = path.basename(file);
    const fileNoExt = fileName.replace(/\.(cjs|js|mjs)$/, '');

    // First check: code-trace index lookup (if available)
    if (index && (index.traced_files[file] || index.scope_only.includes(file))) {
      traced++;
      continue;
    }

    // Check if any requirement references this file
    if (allReqText.includes(file) || allReqText.includes(fileName) || allReqText.includes(fileNoExt)) {
      traced++;
    } else {
      // Fallback: check if file self-declares requirement IDs in header comment
      let headerTraced = false;
      try {
        const absFile = path.join(ROOT, file);
        const head = fs.readFileSync(absFile, 'utf8').split('\n').slice(0, 30).join('\n');
        const match = head.match(/(?:\/\/|\/?\*)\s*Requirements:\s*(.+)/);
        if (match) {
          const declaredIds = match[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
          headerTraced = declaredIds.some(id => reqIdSet.has(id));
        }
        // Also check for @requirement REQ-ID inline annotations
        if (!headerTraced) {
          const annMatch = head.match(/@requirement\s+([A-Z][A-Z0-9_-]+)/);
          if (annMatch && reqIdSet.has(annMatch[1])) { headerTraced = true; }
        }
      } catch (e) {
        // fail-open: file unreadable, treat as untraced
      }
      if (headerTraced) {
        traced++;
      } else {
        untraced.push({ file });
      }
    }
  }

  // Proximity-based suppression pass: suppress untraced items with high-score proximity edges (fail-open)
  const SUPPRESS_THRESHOLD = 0.6;
  try {
    const piPath = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
    if (fs.existsSync(piPath) && untraced.length > 0) {
      const { SEMANTIC_WEIGHTS } = require('./formal-proximity.cjs');
      const pi = JSON.parse(fs.readFileSync(piPath, 'utf8'));
      if (pi && pi.nodes) {
        const surviving = [];
        for (const item of untraced) {
          const nodeKey = 'code_file::' + item.file;
          const node = pi.nodes[nodeKey];
          if (node) {
            const suppressEdge = node.edges.find(e =>
              e.to.startsWith('requirement::') &&
              (SEMANTIC_WEIGHTS[e.rel] || 0) >= SUPPRESS_THRESHOLD
            );
            if (suppressEdge) {
              traced++;
              item.suppressed_by = {
                requirement: suppressEdge.to.replace('requirement::', ''),
                score: SEMANTIC_WEIGHTS[suppressEdge.rel],
              };
              continue;
            }
          }
          surviving.push(item);
        }
        untraced.length = 0;
        untraced.push(...surviving);
      }
    }
  } catch (e) { /* fail-open: if proximity-index.json missing or unreadable, skip suppression */ }

  // Enrich untraced items with proximity nearest_req (fail-open)
  // Strategy: BFS graph first, then embedding fallback for items graph can't reach
  try {
    const piPath = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
    if (fs.existsSync(piPath) && untraced.length > 0) {
      const { reach: reachFn } = require('./formal-query.cjs');
      const pi = JSON.parse(fs.readFileSync(piPath, 'utf8'));
      if (pi && pi.nodes) {
        for (const item of untraced) {
          const nodeKey = 'code_file::' + item.file;
          if (!pi.nodes[nodeKey]) continue;
          const reachable = reachFn(pi, nodeKey, 2, ['requirement']);
          for (const nodes of Object.values(reachable)) {
            if (nodes.length > 0) {
              item.nearest_req = nodes[0].key.split('::').slice(1).join('::');
              break;
            }
          }
          if (!item.nearest_req) {
            const broader = reachFn(pi, nodeKey, 3, null);
            const ctx = [];
            for (const nodes of Object.values(broader)) {
              for (const n of nodes) ctx.push(n.key);
            }
            if (ctx.length > 0) item.proximity_context = ctx.slice(0, 5);
          }
        }
      }
    }
  } catch (e) { /* fail-open */ }

  // Embedding fallback: for items still without nearest_req, use cosine similarity
  try {
    for (const item of untraced) {
      if (item.nearest_req) continue;
      const result = embeddingNearestReq('code_file::' + item.file);
      if (result) {
        item.nearest_req = result.nearest_req;
        item.proximity_context = result.proximity_context;
        item.enrichment_source = 'embedding';
      }
    }
  } catch (e) { /* fail-open */ }

  return {
    residual: untraced.length,
    detail: {
      untraced_modules: untraced,
      total_modules: sourceFiles.length,
      traced: traced,
      scoped: focusSet ? false : undefined,
    },
  };
}

/**
 * T->R: Tests to Requirements (reverse).
 * Scans test files for tests without @req annotation or formal-test-sync mapping.
 * Returns { residual: N, detail: { orphan_tests: [file_paths], total_tests, mapped } }
 */
function sweepTtoR() {
  // Discover test files
  const testPatterns = [
    { dir: 'bin', suffix: '.test.cjs' },
    { dir: 'test', suffix: '.test.cjs' },
    { dir: 'test', suffix: '.test.js' },
  ];

  const testFiles = [];
  for (const { dir, suffix } of testPatterns) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;

    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(suffix)) continue;
      testFiles.push(path.join(dir, entry.name));
    }
  }

  if (testFiles.length === 0) {
    return { residual: -1, detail: { skipped: true, reason: 'missing: test files', orphan_tests: [], total_tests: 0, mapped: 0 } };
  }

  // Load formal-test-sync data for mapping info
  const syncData = loadFormalTestSync();
  const syncMappedFiles = new Set();
  if (syncData && syncData.coverage_gaps && syncData.coverage_gaps.gaps) {
    for (const gap of syncData.coverage_gaps.gaps) {
      if (gap.test_file) syncMappedFiles.add(gap.test_file);
    }
  }
  // Also check stub files from generated-stubs directory
  if (syncData && syncData.generated_stubs) {
    for (const stub of syncData.generated_stubs) {
      if (stub.source_test) syncMappedFiles.add(stub.source_test);
    }
  }

  const orphans = [];
  let mapped = 0;
  let annotatedCount = 0;

  // Load code-trace index for fast lookup
  const index = loadCodeTraceIndex();

  for (const testFile of testFiles) {
    const absPath = path.join(ROOT, testFile);

    // Check for @req/@requirement annotation in file content (run for ALL files for coverage counting)
    let hasReqAnnotation = false;
    try {
      const content = fs.readFileSync(absPath, 'utf8');
      // Match patterns: @requirement REQ-01, @req REQ-01, // req: STOP-03, // Requirements: REQ-01, REQ-02
      hasReqAnnotation = /@req(?:uirement)?\s+[A-Z]+-\d+/i.test(content) ||
                         /\/\/\s*req(?:uirement)?:\s*[A-Z]+-\d+/i.test(content) ||
                         /\/\/\s*Requirements:\s*[A-Z]+-\d+/i.test(content);
    } catch (e) {
      // Can't read — treat as orphan
    }
    if (hasReqAnnotation) annotatedCount++;

    // First check: code-trace index lookup (if available)
    if (index && index.traced_files[testFile]) {
      mapped++;
      continue;
    }

    // Check if formal-test-sync knows about this file
    const inSyncReport = syncMappedFiles.has(testFile) || syncMappedFiles.has(absPath);

    if (hasReqAnnotation || inSyncReport) {
      mapped++;
    } else {
      orphans.push(testFile);
    }
  }

  // Convert orphans to objects and enrich with proximity nearest_req (fail-open)
  // Strategy: BFS graph first, then embedding fallback for items graph can't reach
  let orphanItems = orphans.map(f => ({ file: f }));

  // Proximity-based suppression for test files (parallel to sweepCtoR suppression)
  try {
    const piPath = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
    if (fs.existsSync(piPath) && orphanItems.length > 0) {
      const { SEMANTIC_WEIGHTS } = require('./formal-proximity.cjs');
      const pi = JSON.parse(fs.readFileSync(piPath, 'utf8'));
      if (pi && pi.nodes) {
        const SUPPRESS_THRESHOLD = 0.6;
        const surviving = [];
        for (const item of orphanItems) {
          const nodeKey = 'code_file::' + item.file;
          const node = pi.nodes[nodeKey];
          if (node) {
            const suppressEdge = node.edges.find(e =>
              e.to.startsWith('requirement::') &&
              (SEMANTIC_WEIGHTS[e.rel] || 0) >= SUPPRESS_THRESHOLD
            );
            if (suppressEdge) {
              mapped++;
              continue;
            }
          }
          surviving.push(item);
        }
        orphanItems = surviving;
      }
    }
  } catch (e) { /* fail-open */ }

  try {
    const piPath = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
    if (fs.existsSync(piPath) && orphanItems.length > 0) {
      const { reach: reachFn } = require('./formal-query.cjs');
      const pi = JSON.parse(fs.readFileSync(piPath, 'utf8'));
      if (pi && pi.nodes) {
        for (const item of orphanItems) {
          const nodeKey = 'code_file::' + item.file;
          if (!pi.nodes[nodeKey]) continue;
          const reachable = reachFn(pi, nodeKey, 2, ['requirement']);
          for (const nodes of Object.values(reachable)) {
            if (nodes.length > 0) {
              item.nearest_req = nodes[0].key.split('::').slice(1).join('::');
              break;
            }
          }
          if (!item.nearest_req) {
            const broader = reachFn(pi, nodeKey, 3, null);
            const ctx = [];
            for (const nodes of Object.values(broader)) {
              for (const n of nodes) ctx.push(n.key);
            }
            if (ctx.length > 0) item.proximity_context = ctx.slice(0, 5);
          }
        }
      }
    }
  } catch (e) { /* fail-open */ }

  // Embedding fallback: for items still without nearest_req, use cosine similarity
  try {
    for (const item of orphanItems) {
      if (item.nearest_req) continue;
      const result = embeddingNearestReq('code_file::' + item.file);
      if (result) {
        item.nearest_req = result.nearest_req;
        item.proximity_context = result.proximity_context;
        item.enrichment_source = 'embedding';
      }
    }
  } catch (e) { /* fail-open */ }

  const annotation_coverage_percent = testFiles.length > 0
    ? Math.round((annotatedCount / testFiles.length) * 100)
    : 0;

  return {
    residual: orphanItems.length,
    detail: {
      orphan_tests: orphanItems,
      total_tests: testFiles.length,
      mapped: mapped,
      annotation_coverage_percent: annotation_coverage_percent,
      annotated_count: annotatedCount,
      scoped: focusSet ? false : undefined,
    },
  };
}

/**
 * D->R: Docs to Requirements (reverse).
 * Extracts capability claims from docs and checks if requirements back them.
 * Returns { residual: N, detail: { unbacked_claims: [{doc_file, line, claim_text}], total_claims, backed } }
 */
function sweepDtoR() {
  const reqPath = path.join(ROOT, '.planning', 'formal', 'requirements.json');
  if (!fs.existsSync(reqPath)) {
    return { residual: -1, detail: { skipped: true, reason: 'missing: requirements.json' } };
  }

  let reqData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {
    return { residual: -1, detail: { skipped: true, reason: 'missing: requirements.json (parse error)' } };
  }

  // Flatten requirements and extract keywords per requirement
  let requirements = [];
  if (Array.isArray(reqData)) {
    requirements = reqData;
  } else if (reqData.requirements && Array.isArray(reqData.requirements)) {
    requirements = reqData.requirements;
  } else if (reqData.groups && Array.isArray(reqData.groups)) {
    for (const group of reqData.groups) {
      if (group.requirements && Array.isArray(group.requirements)) {
        for (const r of group.requirements) requirements.push(r);
      }
    }
  }

  const reqKeywordSets = requirements.map(r => {
    const text = (r.text || r.description || '') + ' ' + (r.background || '');
    return extractKeywords(text);
  });

  // Discover doc files
  const docFiles = discoverDocFiles();
  if (docFiles.length === 0) {
    return { residual: -1, detail: { skipped: true, reason: 'missing: doc files' } };
  }

  // Action verbs that indicate capability claims
  const ACTION_VERBS = [
    'supports', 'enables', 'provides', 'ensures', 'guarantees',
    'validates', 'enforces', 'detects', 'prevents', 'handles',
    'automates', 'generates', 'monitors', 'verifies', 'dispatches',
  ];
  const verbPattern = new RegExp('\\b(' + ACTION_VERBS.join('|') + ')\\b', 'i');

  const unbacked = [];
  let totalClaims = 0;
  let backed = 0;

  for (const { absPath } of docFiles) {
    let content;
    try {
      content = fs.readFileSync(absPath, 'utf8');
    } catch (e) {
      continue;
    }

    const relativePath = path.relative(ROOT, absPath).replace(/\\/g, '/');
    const lines = content.split('\n');
    let inFencedBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip fenced code blocks
      if (line.trimStart().startsWith('```')) {
        inFencedBlock = !inFencedBlock;
        continue;
      }
      if (inFencedBlock) continue;

      // Skip headings, empty lines, and list markers only
      if (line.match(/^#{1,6}\s/) || line.trim().length === 0) continue;

      // Check for action verb
      if (!verbPattern.test(line)) continue;

      totalClaims++;

      // Extract keywords from this claim line
      const claimKeywords = extractKeywords(line);
      if (claimKeywords.length < 2) {
        // Too few keywords to match meaningfully
        backed++;
        continue;
      }

      // Check if any requirement has 3+ keyword overlap
      let hasBacking = false;
      for (const reqKws of reqKeywordSets) {
        let overlap = 0;
        for (const kw of claimKeywords) {
          if (reqKws.includes(kw)) overlap++;
        }
        if (overlap >= 3) {
          hasBacking = true;
          break;
        }
      }

      if (hasBacking) {
        backed++;
      } else {
        unbacked.push({
          doc_file: relativePath,
          line: i + 1,
          claim_text: line.trim().slice(0, 120),
        });
      }
    }
  }

  return {
    residual: unbacked.length,
    detail: {
      unbacked_claims: unbacked,
      total_claims: totalClaims,
      backed: backed,
      scoped: focusSet ? false : undefined,
    },
  };
}

/**
 * Classify a reverse discovery candidate into category A/B/C.
 * Category A (likely requirements): strong requirement language or source modules/tests.
 * Category B (likely documentation): descriptive/documentation language only.
 * Category C (ambiguous): needs human review.
 * @param {object} candidate - Candidate with file_or_claim, evidence, type fields
 * @returns {{ category: string, reason: string, suggestion: string }}
 */
function classifyCandidate(candidate) {
  const text = (candidate.file_or_claim || '').toLowerCase();

  // Category A signals: strong requirement language
  // Use word-boundary regex to avoid false matches (e.g. "mustard" matching "must")
  // Consistent with triageRequirements() which also uses \b boundaries
  const reqSignals = ['must', 'shall', 'ensures', 'invariant', 'constraint', 'enforces', 'guarantees'];
  const hasReqLanguage = reqSignals.some(s => new RegExp('\\b' + s + '\\b', 'i').test(text));

  // Category B signals: weak/descriptive language in doc claims
  const docSignals = ['supports', 'handles', 'provides', 'describes', 'documents', 'explains'];
  const hasDocLanguage = docSignals.some(s => new RegExp('\\b' + s + '\\b', 'i').test(text));

  // Determine infrastructure tier for module/test candidates
  const infraPatterns = [
    /^(install|aggregate-|build-|compute-|validate-|solve-tui|solve-worker|solve-wave-dag|solve-debt-bridge|token-dashboard|config-loader|layer-constants|providers|unified-mcp-server|review-mcp-logs|check-mcp-health|security-sweep)/,
  ];
  const baseName = path.basename(candidate.file_or_claim || '').replace(/\.(test\.)?(cjs|js|mjs)$/, '');
  const isInfra = infraPatterns.some(p => p.test(baseName)) || (candidate.file_or_claim || '').startsWith('hooks/');
  const proposed_tier = isInfra ? 'technical' : 'user';

  // Module and test types are more likely to be real requirements
  if (candidate.type === 'module' || candidate.type === 'test') {
    // Source modules and tests are usually genuine missing requirements
    return {
      category: 'A',
      reason: 'source ' + candidate.type + ' without requirement tracing',
      suggestion: 'approve',
      proposed_tier: proposed_tier
    };
  }

  if (candidate.type === 'claim') {
    if (hasReqLanguage) {
      return { category: 'A', reason: 'strong requirement language in doc claim', suggestion: 'approve' };
    }
    if (hasDocLanguage && !hasReqLanguage) {
      return { category: 'B', reason: 'descriptive/documentation language only', suggestion: 'acknowledge' };
    }
    return { category: 'C', reason: 'ambiguous — review needed', suggestion: 'review' };
  }

  return { category: 'C', reason: 'unclassified candidate type', suggestion: 'review' };
}

/**
 * Proximity pre-filter: suppress reverse-scanner items that are reachable to a
 * requirement node within BFS depth 2 in the proximity-index graph.
 * Fail-open: if proximity-index.json is missing or malformed, all items pass through.
 * @param {Array} candidates - array of {file_or_claim, type, ...}
 * @returns {{ filtered: Array, suppressed: Array, stats: {total, suppressed, passed} }}
 */
function proximityPreFilter(candidates) {
  const empty = { filtered: [...candidates], suppressed: [], stats: { total: candidates.length, suppressed: 0, passed: candidates.length } };
  if (!candidates || candidates.length === 0) {
    return { filtered: [], suppressed: [], stats: { total: 0, suppressed: 0, passed: 0 } };
  }

  try {
    const indexPath = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
    if (!fs.existsSync(indexPath)) return empty;

    const { reach } = require('./formal-query.cjs');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    if (!index || !index.nodes) return empty;

    const filtered = [];
    const suppressed = [];

    for (const c of candidates) {
      // Only module and test types have code_file nodes; claims skip proximity filter
      if (c.type === 'claim') {
        filtered.push(c);
        continue;
      }

      const nodeKey = 'code_file::' + c.file_or_claim;

      // Check if node exists in proximity graph
      if (!index.nodes[nodeKey]) {
        filtered.push(c);
        continue;
      }

      // BFS depth 2 for requirement nodes
      const reachable = reach(index, nodeKey, 2, ['requirement']);
      const reqNodes = [];
      for (const nodes of Object.values(reachable)) {
        for (const n of nodes) reqNodes.push(n);
      }

      if (reqNodes.length > 0) {
        // Suppress: requirement reachable within depth 2 (graph path)
        const reqId = reqNodes[0].key.split('::').slice(1).join('::');
        c.nearest_req = reqId;
        if (verboseMode) {
          process.stderr.write(TAG + ' Proximity suppress: ' + c.file_or_claim + ' covered by ' + reqId + '\n');
        }
        suppressed.push(c);
      } else {
        // Embedding fallback: try cosine similarity before giving up
        const embedResult = embeddingNearestReq(nodeKey);
        if (embedResult && embedResult.similarity >= 0.55) {
          // High-confidence embedding match — suppress
          c.nearest_req = embedResult.nearest_req;
          c.enrichment_source = 'embedding';
          if (verboseMode) {
            process.stderr.write(TAG + ' Embedding suppress: ' + c.file_or_claim + ' covered by ' + embedResult.nearest_req + ' (sim=' + embedResult.similarity + ')\n');
          }
          suppressed.push(c);
        } else {
          // Check depth 3 for broader context (non-requirement nodes)
          const broader = reach(index, nodeKey, 3, null);
          const contextNodes = [];
          for (const nodes of Object.values(broader)) {
            for (const n of nodes) contextNodes.push(n.key);
          }
          if (contextNodes.length > 0) {
            c.nearest_req = null;
            c.proximity_context = contextNodes.slice(0, 5);
          }
          // Enrich with lower-confidence embedding context even if not suppressing
          if (embedResult) {
            c.nearest_req = c.nearest_req || embedResult.nearest_req;
            c.proximity_context = c.proximity_context || embedResult.proximity_context;
            c.enrichment_source = 'embedding';
          }
          filtered.push(c);
        }
      }
    }

    return {
      filtered,
      suppressed,
      stats: { total: candidates.length, suppressed: suppressed.length, passed: filtered.length },
    };
  } catch (e) {
    // fail-open: proximity pre-filter is best-effort
    if (verboseMode) {
      process.stderr.write(TAG + ' Proximity pre-filter error (fail-open): ' + e.message + '\n');
    }
    return empty;
  }
}

/**
 * Assemble and deduplicate reverse traceability candidates from all 3 scanners.
 * Merges C→R, T→R, D→R results, deduplicates, filters, and respects acknowledged-not-required.json.
 * Returns { candidates: [...], total_raw, deduped, filtered, acknowledged, proximity_suppressed }
 */
function assembleReverseCandidates(c_to_r, t_to_r, d_to_r) {
  const raw = [];

  // Gather C→R candidates
  if (c_to_r.residual > 0 && c_to_r.detail.untraced_modules) {
    for (const mod of c_to_r.detail.untraced_modules) {
      const candidate = {
        source_scanners: ['C→R'],
        evidence: mod.file,
        file_or_claim: mod.file,
        type: 'module',
      };
      // Carry through proximity data from sweep enrichment
      if (mod.nearest_req) candidate.nearest_req = mod.nearest_req;
      if (mod.proximity_context) candidate.proximity_context = mod.proximity_context;
      raw.push(candidate);
    }
  }

  // Gather T→R candidates
  if (t_to_r.residual > 0 && t_to_r.detail.orphan_tests) {
    for (const testEntry of t_to_r.detail.orphan_tests) {
      const testFile = typeof testEntry === 'string' ? testEntry : testEntry.file;
      const candidate = {
        source_scanners: ['T→R'],
        evidence: testFile,
        file_or_claim: testFile,
        type: 'test',
      };
      // Carry through proximity data from sweep enrichment
      if (testEntry && typeof testEntry === 'object') {
        if (testEntry.nearest_req) candidate.nearest_req = testEntry.nearest_req;
        if (testEntry.proximity_context) candidate.proximity_context = testEntry.proximity_context;
      }
      raw.push(candidate);
    }
  }

  // Gather D→R candidates
  if (d_to_r.residual > 0 && d_to_r.detail.unbacked_claims) {
    for (const claim of d_to_r.detail.unbacked_claims) {
      raw.push({
        source_scanners: ['D→R'],
        evidence: claim.doc_file + ':' + claim.line,
        file_or_claim: claim.claim_text,
        type: 'claim',
      });
    }
  }

  const totalRaw = raw.length;

  // Deduplicate: merge test files that correspond to source modules
  // e.g., test/foo.test.cjs and bin/foo.cjs → single candidate with both scanners
  const merged = [];
  const testToSource = new Map();

  for (const candidate of raw) {
    if (candidate.type === 'test') {
      // Extract base name: test/foo.test.cjs → foo
      const baseName = path.basename(candidate.file_or_claim)
        .replace(/\.test\.(cjs|js|mjs)$/, '');
      testToSource.set(baseName, candidate);
    }
  }

  const mergedTestBases = new Set();

  for (const candidate of raw) {
    if (candidate.type === 'module') {
      const baseName = path.basename(candidate.file_or_claim)
        .replace(/\.(cjs|js|mjs)$/, '');
      const matchingTest = testToSource.get(baseName);
      if (matchingTest) {
        // Merge: combine scanners
        if (verboseMode) {
          process.stderr.write(TAG + ' Dedup: merged C→R ' + candidate.file_or_claim +
            ' + T→R ' + matchingTest.file_or_claim + '\n');
        }
        merged.push({
          source_scanners: ['C→R', 'T→R'],
          evidence: candidate.file_or_claim + ' + ' + matchingTest.file_or_claim,
          file_or_claim: candidate.file_or_claim,
          type: 'module',
        });
        mergedTestBases.add(baseName);
      } else {
        merged.push(candidate);
      }
    } else if (candidate.type === 'test') {
      const baseName = path.basename(candidate.file_or_claim)
        .replace(/\.test\.(cjs|js|mjs)$/, '');
      if (!mergedTestBases.has(baseName)) {
        merged.push(candidate);
      }
    } else {
      merged.push(candidate);
    }
  }

  const deduped = totalRaw - merged.length;

  // Filter out .planning/ files, generated stubs, node_modules
  let filtered = 0;
  const candidates = [];
  for (const c of merged) {
    if (c.file_or_claim.startsWith('.planning/') ||
        c.file_or_claim.includes('generated-stubs') ||
        c.file_or_claim.includes('node_modules')) {
      filtered++;
      continue;
    }
    candidates.push(c);
  }

  // Load acknowledged-not-required.json and filter out previously rejected
  let acknowledged = 0;
  const ackPath = path.join(ROOT, '.planning', 'formal', 'acknowledged-not-required.json');
  if (fs.existsSync(ackPath)) {
    try {
      const ackData = JSON.parse(fs.readFileSync(ackPath, 'utf8'));
      const ackSet = new Set((ackData.entries || []).map(e => e.file_or_claim));
      const afterAck = [];
      for (const c of candidates) {
        if (ackSet.has(c.file_or_claim)) {
          acknowledged++;
        } else {
          afterAck.push(c);
        }
      }
      candidates.length = 0;
      for (const c of afterAck) candidates.push(c);
    } catch (e) {
      // malformed ack file — fail-open
    }
  }

  // Proximity pre-filter: suppress items reachable to requirements in proximity graph
  const proximityResult = proximityPreFilter(candidates);
  const proximitySuppressed = proximityResult.suppressed.length;
  candidates.length = 0;
  for (const c of proximityResult.filtered) candidates.push(c);

  // Auto-categorize candidates into A/B/C
  for (const c of candidates) {
    const classification = classifyCandidate(c);
    c.category = classification.category;
    c.category_reason = classification.reason;
    c.suggestion = classification.suggestion;
    c.proposed_tier = classification.proposed_tier || 'user';
  }

  // Auto-acknowledge Category B candidates (documentation-only, no human review needed)
  const catBCandidates = candidates.filter(c => c.category === 'B');
  const autoAcknowledgedB = catBCandidates.length;

  if (catBCandidates.length > 0 && !reportOnly) {
    // Write Category B to acknowledged-not-required.json
    const ackNrPath = path.join(ROOT, '.planning', 'formal', 'acknowledged-not-required.json');
    let ackNrData = { entries: [] };
    try {
      ackNrData = JSON.parse(fs.readFileSync(ackNrPath, 'utf8'));
      if (!Array.isArray(ackNrData.entries)) ackNrData.entries = [];
    } catch (e) { /* create fresh */ }

    const existingKeys = new Set(ackNrData.entries.map(e => e.file_or_claim));
    for (const c of catBCandidates) {
      if (!existingKeys.has(c.file_or_claim)) {
        ackNrData.entries.push({
          file_or_claim: c.file_or_claim,
          category: 'B',
          reason: c.category_reason,
          acknowledged_at: new Date().toISOString(),
        });
      }
    }
    try {
      fs.writeFileSync(ackNrPath, JSON.stringify(ackNrData, null, 2) + '\n', 'utf8');
    } catch (e) {
      process.stderr.write(TAG + ' WARNING: could not write acknowledged-not-required.json: ' + e.message + '\n');
    }
  }

  // Remove Category B from candidates (never surface to humans)
  const afterCatB = candidates.filter(c => c.category !== 'B');
  candidates.length = 0;
  for (const c of afterCatB) candidates.push(c);

  // Count by category for summary
  const categoryCounts = { A: 0, B: 0, C: 0 };
  for (const c of candidates) {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  }

  // Apply max candidate cap (R3.6 improvement from copilot-1)
  if (candidates.length > MAX_REVERSE_CANDIDATES) {
    if (verboseMode) {
      process.stderr.write(TAG + ' Capping reverse candidates from ' +
        candidates.length + ' to ' + MAX_REVERSE_CANDIDATES + '\n');
    }
    candidates.length = MAX_REVERSE_CANDIDATES;
  }

  return {
    candidates: candidates,
    total_raw: totalRaw,
    deduped: deduped,
    filtered: filtered,
    acknowledged: acknowledged,
    proximity_suppressed: proximitySuppressed,
    auto_acknowledged_b: autoAcknowledgedB,
    category_counts: categoryCounts,
  };
}

// ── Layer alignment sweeps ────────────────────────────────────────────────────

/**
 * Memoized aggregate gate loader.
 * Spawns compute-per-model-gates.cjs --aggregate --json once and caches the result.
 * All three sweep functions (L1->L2, L2->L3, L3->TC) share this single call.
 */
let _aggregateCache = null;
function getAggregateGates() {
  if (_aggregateCache) return _aggregateCache;
  const args = ['--aggregate', '--json'];
  if (reportOnly) args.push('--dry-run');
  const result = spawnTool('bin/compute-per-model-gates.cjs', args);
  if (!result.ok && !result.stdout) return null;
  try {
    const data = JSON.parse(result.stdout);
    _aggregateCache = data.aggregate;
    return _aggregateCache;
  } catch { return null; }
}

/**
 * L1->L3: Wiring:Evidence alignment score (L2 collapsed — STRUCT-01).
 * Gate A now evaluates L1 evidence directly against L3 reasoning models.
 * Uses compute-per-model-gates.cjs --aggregate and computes normalized 0-10 residual.
 * Returns { residual: N, detail: {...} }
 */
function sweepL1toL3() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  const agg = getAggregateGates();
  if (!agg || !agg.gate_a) {
    return { residual: -1, detail: { error: true, stderr: 'aggregate gate data unavailable' } };
  }

  const gateA = agg.gate_a;
  const score = resolveGateScore(gateA, 'a');
  const residual = Math.ceil((1 - score) * 10);
  return {
    residual: residual,
    detail: {
      wiring_evidence_score: score,
      target: 0.8,
      gap: 0.8 - score,
      unexplained_breakdown: {
        instrumentation_bug: (gateA.unexplained_counts && gateA.unexplained_counts.instrumentation_bug) || 0,
        model_gap: (gateA.unexplained_counts && gateA.unexplained_counts.model_gap) || 0,
        genuine_violation: (gateA.unexplained_counts && gateA.unexplained_counts.genuine_violation) || 0,
      },
      scoped: focusSet ? false : undefined,
    },
  };
}

// sweepL2toL3 removed — L2 (Semantics) layer collapsed (STRUCT-01).
// Gate B purpose check is now folded into l1_to_l3 via compute-per-model-gates.cjs.

/**
 * L3->TC: Wiring:Coverage alignment score.
 * Uses compute-per-model-gates.cjs --aggregate and computes normalized 0-10 residual.
 * Checks test-recipes.json staleness before scoring.
 * Returns { residual: N, detail: {...} }
 */
function sweepL3toTC() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  // Check if test-recipes.json exists and staleness
  const recipesPath = path.join(ROOT, '.planning', 'formal', 'test-recipes', 'test-recipes.json');
  const catalogPath = path.join(ROOT, '.planning', 'formal', 'reasoning', 'failure-mode-catalog.json');

  if (fs.existsSync(recipesPath) && fs.existsSync(catalogPath)) {
    try {
      const recipesMtime = fs.statSync(recipesPath).mtimeMs;
      const catalogMtime = fs.statSync(catalogPath).mtimeMs;
      if (recipesMtime < catalogMtime) {
        if (reportOnly) {
          process.stderr.write(TAG + ' WARNING: test-recipes.json is stale; run test-recipe-gen.cjs to update\n');
        } else {
          spawnTool('bin/test-recipe-gen.cjs', []);
        }
      }
    } catch (e) {
      // fail-open: skip staleness check
    }
  }

  const agg = getAggregateGates();
  if (!agg || !agg.gate_c) {
    return { residual: -1, detail: { error: true, stderr: 'aggregate gate data unavailable' } };
  }

  const gateC = agg.gate_c;
  const score = resolveGateScore(gateC, 'c');
  const residual = Math.ceil((1 - score) * 10);
  return {
    residual: residual,
    detail: {
      wiring_coverage_score: score,
      unvalidated_count: gateC.unvalidated_entries || 0,
      total_failure_modes: gateC.total_entries || 0,
      total_recipes: gateC.validated_entries || 0,
      scoped: focusSet ? false : undefined,
    },
  };
}

// ── Per-Model Gate Maturity sweep ────────────────────────────────────────────

/**
 * Per-model gate maturity sweep.
 * Spawns compute-per-model-gates.cjs --json (in mutation mode)
 * or --json --dry-run (in report-only mode) and returns summary as residual.
 * Residual = number of models still at layer_maturity 0.
 */
function sweepPerModelGates() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  // Pre-flight: check registry exists before spawning child process
  const registryPath = path.join(ROOT, '.planning', 'formal', 'model-registry.json');
  if (!fs.existsSync(registryPath)) {
    return { residual: -1, detail: { skipped: true, reason: 'model-registry.json not found' } };
  }

  const args = ['--aggregate', '--write-per-model', '--json'];
  if (reportOnly) args.push('--dry-run');

  const result = spawnTool('bin/compute-per-model-gates.cjs', args);

  if (!result.ok && !result.stdout) {
    return { residual: -1, detail: { error: true, stderr: (result.stderr || '').slice(0, 500) } };
  }

  try {
    const data = JSON.parse(result.stdout);
    const totalModels = data.total_models || 0;
    const avgMaturity = (data.scores && data.scores.avg_layer_maturity) || 0;
    const zeroMaturityCount = Object.values(data.per_model || {})
      .filter(m => m.layer_maturity === 0).length;
    return {
      residual: zeroMaturityCount,
      detail: {
        total_models: totalModels,
        avg_layer_maturity: avgMaturity,
        gate_a_pass: (data.scores && data.scores.gate_a_pass) || 0,
        gate_b_pass: (data.scores && data.scores.gate_b_pass) || 0,
        gate_c_pass: (data.scores && data.scores.gate_c_pass) || 0,
        promotions: (data.promotions || []).length,
        scoped: focusSet ? false : undefined,
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'JSON parse failed: ' + err.message } };
  }
}

// ── Git Heatmap sweep ────────────────────────────────────────────────────────

/**
 * Reads git-heatmap.json evidence and returns uncovered hot-zone count as residual.
 * Refreshes the evidence file first (unless --report-only or --fast).
 * This is informational — not added to the automatable forward total.
 */
function sweepGitHeatmap() {
  const evidencePath = path.join(ROOT, '.planning', 'formal', 'evidence', 'git-heatmap.json');

  // Refresh evidence (skip in fast/report-only modes — too slow for git mining)
  if (!fastMode && !reportOnly) {
    const refresh = spawnTool('bin/git-heatmap.cjs', ['--since=3.months.ago', '--max-commits=300']);
    if (!refresh.ok) {
      process.stderr.write(TAG + ' WARNING: git-heatmap.cjs failed; using stale evidence\n');
    }
  }

  if (!fs.existsSync(evidencePath)) {
    return { residual: -1, detail: { skipped: true, reason: 'no evidence file' } };
  }

  try {
    const data = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const hotZones = data.uncovered_hot_zones || [];
    const signals = data.signals || {};

    return {
      residual: hotZones.length,
      detail: {
        uncovered_hot_zones: hotZones.slice(0, 20),
        total_hot_zones: hotZones.length,
        numerical_adjustments_count: (signals.numerical_adjustments || []).length,
        bugfix_hotspots_count: (signals.bugfix_hotspots || []).length,
        churn_files_count: (signals.churn_ranking || []).length,
        generated: data.generated || null,
        scoped: focusSet ? false : undefined,
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'JSON parse failed: ' + err.message } };
  }
}

// ── Git History Evidence sweep ────────────────────────────────────────────────

/**
 * Reads git-history-evidence.json and returns TLA+ drift candidate count as residual.
 * Refreshes the evidence file first (unless --report-only or --fast).
 * Informational — not added to the automatable forward total.
 */
function sweepGitHistoryEvidence() {
  const evidencePath = path.join(ROOT, '.planning', 'formal', 'evidence', 'git-history-evidence.json');

  // Refresh evidence (skip in fast/report-only modes — too slow for git mining)
  if (!fastMode && !reportOnly) {
    const refresh = spawnTool('bin/git-history-evidence.cjs', []);
    if (!refresh.ok) {
      process.stderr.write(TAG + ' WARNING: git-history-evidence.cjs failed; using stale evidence\n');
    }
  }

  if (!fs.existsSync(evidencePath)) {
    return { residual: -1, detail: { skipped: true, reason: 'no evidence file' } };
  }

  try {
    const data = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const driftCandidates = data.tla_drift_candidates || [];

    return {
      residual: driftCandidates.length,
      detail: {
        tla_drift_count: driftCandidates.length,
        total_commits: (data.summary || {}).total_commits || 0,
        top_drift_candidates: driftCandidates.slice(0, 5),
        generated: data.generated || null,
        scoped: focusSet ? false : undefined,
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'JSON parse failed: ' + err.message } };
  }
}

// ── Formal model lint sweep ──────────────────────────────────────────────────

/**
 * Runs lint-formal-models.cjs to detect fat, unbounded, or overly complex models.
 * Returns { residual: N, detail: {...} } where N = number of lint warnings.
 * Informational — not added to the forward total.
 */
function sweepFormalLint() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  try {
    const result = spawnTool('bin/lint-formal-models.cjs', ['--json']);

    // lint-formal-models exits 1 when violations found but still produces JSON
    if (!result.stdout) {
      return { residual: -1, detail: { error: true, stderr: (result.stderr || '').slice(0, 500) } };
    }

    const data = JSON.parse(result.stdout);
    const violations = data.violations || [];
    return {
      residual: violations.length,
      detail: {
        total_violations: violations.length,
        violations: violations.slice(0, 20).map(function (v) {
          return { model: v.model || v.file, rule: v.rule || v.type, message: v.message || '' };
        }),
        summary: data.summary || null,
        scoped: focusSet ? false : undefined,
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'sweepFormalLint failed: ' + err.message } };
  }
}

// ── Hazard model sweep ───────────────────────────────────────────────────────

/**
 * Runs hazard-model.cjs --json and returns FMEA hazard summary.
 * Informational — not added to the forward total.
 */
function sweepHazardModel() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  try {
    const result = spawnTool('bin/hazard-model.cjs', ['--json']);

    if (!result.ok && !result.stdout) {
      return { residual: -1, detail: { error: true, stderr: (result.stderr || '').slice(0, 500) } };
    }

    const data = JSON.parse(result.stdout);
    const hazards = data.hazards || data.transitions || [];
    const critical = hazards.filter(function (h) { return (h.rpn || 0) >= 200; });
    const high = hazards.filter(function (h) { return (h.rpn || 0) >= 100 && (h.rpn || 0) < 200; });

    return {
      residual: critical.length + high.length,
      detail: {
        total_hazards: hazards.length,
        critical_count: critical.length,
        high_count: high.length,
        top_hazards: hazards.slice(0, 10).map(function (h) {
          return { from: h.from_state || h.fromState, event: h.event, rpn: h.rpn || 0 };
        }),
        scoped: focusSet ? false : undefined,
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'sweepHazardModel failed: ' + err.message } };
  }
}

// ── Hypothesis measurement sweep ─────────────────────────────────────────────

/**
 * Runs hypothesis-measure.cjs measureHypotheses() and returns H->M summary.
 * Informational — not added to the forward total.
 */
function sweepHtoM() {
  if (fastMode) {
    return { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  }

  try {
    const result = measureHypotheses(ROOT);
    if (!result) {
      return { residual: -1, detail: { error: true, stderr: 'sweepHtoM failed: measureHypotheses returned null' } };
    }
    return {
      residual: result.verdicts.VIOLATED,
      detail: {
        total: result.total_measured,
        confirmed: result.verdicts.CONFIRMED,
        violated: result.verdicts.VIOLATED,
        unmeasurable: result.verdicts.UNMEASURABLE,
        measurements_path: '.planning/formal/evidence/hypothesis-measurements.json',
      },
    };
  } catch (err) {
    return { residual: -1, detail: { error: true, stderr: 'sweepHtoM failed: ' + err.message } };
  }
}

// ── Residual computation ─────────────────────────────────────────────────────

/**
 * Computes residual vector for all layer transitions (8 forward + 3 reverse + 3 layer alignment).
 * Returns residual object with forward layers + reverse discovery layers + layer alignment.
 */
function computeResidual() {
  const r_to_f = sweepRtoF();
  const f_to_t = sweepFtoT();
  const c_to_f = sweepCtoF();
  const t_to_c = (fastMode || skipTests)
    ? { residual: -1, detail: { skipped: true, reason: skipTests ? 'skip-tests' : 'fast mode' } }
    : sweepTtoC();

  // Cross-reference V8 coverage against formal-test-sync recipe source_files
  if (t_to_c.detail && t_to_c.detail.v8_coverage) {
    t_to_c.detail.formal_coverage = crossReferenceFormalCoverage(t_to_c.detail.v8_coverage);
  }

  const f_to_c = fastMode
    ? { residual: -1, detail: { skipped: true, reason: 'fast mode' } }
    : sweepFtoC();
  const r_to_d = sweepRtoD();
  const d_to_c = sweepDtoC();
  const p_to_f = sweepPtoF({ root: ROOT, focusSet });

  // Rebuild code-trace index for reverse sweeps
  rebuildCodeTraceIndex();

  // Reverse traceability discovery (do NOT add to automatable total)
  const c_to_r = sweepCtoR();
  const t_to_r = sweepTtoR();
  const d_to_r = sweepDtoR();

  const total =
    (r_to_f.residual >= 0 ? r_to_f.residual : 0) +
    (f_to_t.residual >= 0 ? f_to_t.residual : 0) +
    (c_to_f.residual >= 0 ? c_to_f.residual : 0) +
    (t_to_c.residual >= 0 ? t_to_c.residual : 0) +
    (f_to_c.residual >= 0 ? f_to_c.residual : 0) +
    (r_to_d.residual >= 0 ? r_to_d.residual : 0) +
    (d_to_c.residual >= 0 ? d_to_c.residual : 0) +
    (p_to_f.residual >= 0 ? p_to_f.residual : 0);

  const reverse_discovery_total =
    (c_to_r.residual >= 0 ? c_to_r.residual : 0) +
    (t_to_r.residual >= 0 ? t_to_r.residual : 0) +
    (d_to_r.residual >= 0 ? d_to_r.residual : 0);

  // Assemble deduplicated reverse candidates
  const assembled_candidates = assembleReverseCandidates(c_to_r, t_to_r, d_to_r);

  // Layer alignment sweeps (cross-layer gate checks) — skip in fast mode
  const skipLayer = { residual: -1, detail: { skipped: true, reason: 'fast mode' } };
  const l1_to_l3 = fastMode ? skipLayer : sweepL1toL3();
  const l3_to_tc = fastMode ? skipLayer : sweepL3toTC();

  // Per-model gate maturity (informational — not added to layer_total)
  const per_model_gates = fastMode ? skipLayer : sweepPerModelGates();

  // PERF-02: Clear aggregate cache after per_model_gates writes new files
  if (!fastMode) _aggregateCache = null;

  // Enrich gate files with semantic scores (SEM-03, SEM-04)
  if (!fastMode && !reportOnly) {
    process.stderr.write(TAG + ' Enriching gates with semantic scores\n');
    const semResult = spawnTool('bin/compute-semantic-scores.cjs', ['--json']);
    if (!semResult.ok) {
      process.stderr.write(TAG + ' WARNING: semantic scoring failed; gates lack semantic_score (continue)\n');
    }
  }

  const layer_total =
    (l1_to_l3.residual >= 0 ? l1_to_l3.residual : 0) +
    (l3_to_tc.residual >= 0 ? l3_to_tc.residual : 0);

  // Git heatmap sweep (informational — not added to forward total)
  const git_heatmap = sweepGitHeatmap();
  const heatmap_total = git_heatmap.residual >= 0 ? git_heatmap.residual : 0;

  // Git history evidence sweep (informational — not added to forward total)
  const git_history = sweepGitHistoryEvidence();

  // Formal model lint sweep (informational — not added to forward total)
  const formal_lint = sweepFormalLint();

  // Hazard model sweep (informational — not added to forward total)
  const hazard_model = sweepHazardModel();

  // Hypothesis measurement sweep (informational — not added to forward total)
  const h_to_m = sweepHtoM();

  // CONV-02: Split residual into three distinct buckets
  const automatable =
    (r_to_f.residual >= 0 ? r_to_f.residual : 0) +
    (f_to_t.residual >= 0 ? f_to_t.residual : 0) +
    (c_to_f.residual >= 0 ? c_to_f.residual : 0) +
    (t_to_c.residual >= 0 ? t_to_c.residual : 0) +
    (f_to_c.residual >= 0 ? f_to_c.residual : 0) +
    (r_to_d.residual >= 0 ? r_to_d.residual : 0) +
    (l1_to_l3.residual >= 0 ? l1_to_l3.residual : 0) +
    (l3_to_tc.residual >= 0 ? l3_to_tc.residual : 0);

  const manual =
    (d_to_c.residual >= 0 ? d_to_c.residual : 0) +
    (c_to_r.residual >= 0 ? c_to_r.residual : 0) +
    (t_to_r.residual >= 0 ? t_to_r.residual : 0) +
    (d_to_r.residual >= 0 ? d_to_r.residual : 0);

  const informational =
    (git_heatmap.residual >= 0 ? git_heatmap.residual : 0) +
    (git_history.residual >= 0 ? git_history.residual : 0) +
    (formal_lint.residual >= 0 ? formal_lint.residual : 0) +
    (hazard_model.residual >= 0 ? hazard_model.residual : 0) +
    (h_to_m.residual >= 0 ? h_to_m.residual : 0) +
    (per_model_gates.residual >= 0 ? per_model_gates.residual : 0) +
    (p_to_f.residual >= 0 ? p_to_f.residual : 0);

  return {
    r_to_f,
    f_to_t,
    c_to_f,
    t_to_c,
    f_to_c,
    r_to_d,
    d_to_c,
    p_to_f,
    c_to_r,
    t_to_r,
    d_to_r,
    l1_to_l3,
    l3_to_tc,
    per_model_gates,
    git_heatmap,
    git_history,
    formal_lint,
    hazard_model,
    h_to_m,
    assembled_candidates,
    total,
    automatable,
    manual,
    informational,
    layer_total,
    reverse_discovery_total,
    heatmap_total,
    focus: focusPhrase ? { phrase: focusPhrase, matched: focusSet ? focusSet.size : 0 } : null,
    timestamp: new Date().toISOString(),
  };
}

// ── Auto-close ───────────────────────────────────────────────────────────────

/**
 * Attempts to fix gaps found by the sweep.
 * Returns { actions_taken: [...], stubs_generated: N }
 * @param {Object} residual - residual object from computeResidual()
 * @param {Set<string>} [oscillatingSet] - layer keys detected as oscillating by CycleDetector
 * @param {Array<{wave: number, layers: string[], sequential?: boolean}>} [waveOrder] - wave objects from computeWaves; null/undefined = DEFAULT_WAVES
 */
function autoClose(residual, oscillatingSet, waveOrder) {
  const actions = [];

  // Read oscillation verdicts for layer gating (fail-open)
  let verdicts = {};
  try {
    const verdictsPath = path.join(ROOT, '.planning', 'formal', 'oscillation-verdicts.json');
    if (fs.existsSync(verdictsPath)) {
      const raw = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
      verdicts = raw.layers || {};
    }
  } catch (_) { /* fail-open */ }

  function isLayerBlocked(layerKey) {
    const v = verdicts[layerKey];
    if (v && v.blocked === true) return true;
    // Also block layers detected as oscillating by CycleDetector (CONV-01)
    if (oscillatingSet && oscillatingSet.has(layerKey)) return true;
    return false;
  }

  // ── LAYER_HANDLERS dispatch map ──────────────────────────────────────────
  // Each handler receives (residual, actions, isLayerBlocked) and appends to actions.
  // Logic is moved verbatim from the original sequential if-chain.

  const LAYER_HANDLERS = {
    f_to_t: (res, acts, blocked) => {
      // F->T gaps: generate test stubs
      if (blocked('f_to_t')) {
        acts.push('OSCILLATION BLOCKED: f_to_t \u2014 automated remediation suspended, human review required');
        return;
      }
      if (res.f_to_t.residual > 0) {
        const result = spawnTool('bin/formal-test-sync.cjs', []);
        if (result.ok) {
          acts.push(
            'Generated test stubs for ' +
              res.f_to_t.residual +
              ' uncovered invariants'
          );
        } else {
          acts.push(
            'Could not auto-generate test stubs for ' +
              res.f_to_t.residual +
              ' invariants (formal-test-sync.cjs failed)'
          );
        }
      }
      // F->T stubs upgrade: implement TODO stubs with real test logic
      if (!blocked('f_to_t') && res.f_to_t.residual > 0) {
        const implPath = path.join(ROOT, '.planning/formal/generated-stubs/_implement-stubs.cjs');
        if (fs.existsSync(implPath)) {
          const implResult = spawnSync(process.execPath, [implPath], {
            encoding: 'utf8', cwd: ROOT, timeout: 60000, stdio: 'pipe'
          });
          if (implResult.status === 0) {
            acts.push('Upgraded TODO stubs: ' + (implResult.stdout || '').trim());
          }
        }
      }
    },

    c_to_f: (res, acts, blocked) => {
      // C->F mismatches: log but do not auto-fix
      if (res.c_to_f.residual > 0) {
        acts.push(
          'Cannot auto-fix ' +
            res.c_to_f.residual +
            ' constant mismatch(es) \u2014 manual review required'
        );
      }
    },

    t_to_c: (res, acts, blocked) => {
      // T->C failures: log but do not auto-fix
      if (res.t_to_c.residual > 0) {
        acts.push(
          res.t_to_c.residual + ' test failure(s) \u2014 manual fix required'
        );
      }
    },

    r_to_f: (res, acts, blocked) => {
      // R->F gaps: log with triage info
      if (res.r_to_f.residual > 0) {
        const triageDetail = res.r_to_f.detail.triage;
        if (triageDetail) {
          acts.push(
            triageDetail.high + ' HIGH + ' + triageDetail.medium +
              ' MEDIUM priority requirements lack formal coverage'
          );
        } else {
          acts.push(
            res.r_to_f.residual +
              ' requirement(s) lack formal model coverage \u2014 manual modeling required'
          );
        }
      }
    },

    f_to_c: (res, acts, blocked) => {
      // F->C failures: log but do not auto-fix
      if (res.f_to_c.residual > 0) {
        acts.push(
          res.f_to_c.residual +
            ' formal verification failure(s) \u2014 manual fix required'
        );
      }
    },

    r_to_d: (res, acts, blocked) => {
      // R->D gaps: log but do not auto-fix (manual review)
      if (res.r_to_d.residual > 0) {
        acts.push(
          res.r_to_d.residual +
            ' requirement(s) undocumented in developer docs \u2014 manual review required'
        );
      }
    },

    d_to_c: (res, acts, blocked) => {
      // D->C stale claims: log but do not auto-fix (manual review)
      if (res.d_to_c.residual > 0) {
        acts.push(
          res.d_to_c.residual +
            ' stale structural claim(s) in docs \u2014 manual review required'
        );
      }
    },

    p_to_f: (res, acts, blocked) => {
      // P->F divergence: dispatch parameter updates or flag investigations
      if (blocked('p_to_f')) {
        acts.push('OSCILLATION BLOCKED: p_to_f \u2014 automated remediation suspended, human review required');
      } else if (res.p_to_f && res.p_to_f.residual > 0) {
        const result = autoClosePtoF(res.p_to_f, {
          spawnTool: spawnTool,
        });
        for (const action of result.actions_taken) {
          acts.push(action);
        }
      }
    },

    per_model_gates: (res, acts, blocked) => {
      // Per-model gate maturity: create conditions for promotion (GATE-02)
      // Produces observable signals -- never writes gate_maturity directly.
      if (blocked('per_model_gates')) {
        acts.push('OSCILLATION BLOCKED: per_model_gates \u2014 automated remediation suspended, human review required');
      } else if (res.per_model_gates && res.per_model_gates.residual > 0) {
        try {
          const registryPath = path.join(ROOT, '.planning', 'formal', 'model-registry.json');
          const manifestPath = path.join(ROOT, '.planning', 'formal', 'layer-manifest.json');
          const registryFile = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
          const models = registryFile.models || registryFile;
          const modelKeys = Object.keys(models).filter(k => k.startsWith('.'));

          // Import inferSourceLayer from promote-gate-maturity.cjs
          const { inferSourceLayer: inferLayer } = require('./promote-gate-maturity.cjs');

          // Signal 1: fill missing source_layer via inferSourceLayer heuristic
          let layersFilled = 0;
          for (const modelPath of modelKeys) {
            const model = models[modelPath];
            if (!model.source_layer) {
              const inferred = inferLayer(modelPath);
              if (inferred) {
                model.source_layer = inferred;
                model.last_updated = new Date().toISOString();
                layersFilled++;
              }
            }
          }

          // Signal 2: scan model files for semantic declarations
          const DECL_PATTERNS = {
            '.als': /\b(sig|pred|fact|assert|fun)\b/,
            '.tla': /\b(VARIABLE|CONSTANT|Init|Next|Spec)\b/,
            '.pm':  /\b(module|rewards|endmodule)\b/,
            '.props': /\b(P\s*=|filter|Pmax|Pmin)\b/,
          };

          let manifest = null;
          if (fs.existsSync(manifestPath)) {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          }

          let declsDetected = 0;
          for (const modelPath of modelKeys) {
            const ext = path.extname(modelPath);
            const pattern = DECL_PATTERNS[ext];
            if (!pattern) continue;

            const fullPath = path.join(ROOT, modelPath);
            if (!fs.existsSync(fullPath)) continue;

            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              if (pattern.test(content)) {
                // Update layer-manifest if model is currently ungrounded
                if (manifest) {
                  for (const layer of Object.values(manifest.layers || {})) {
                    for (const entry of (Array.isArray(layer) ? layer : [])) {
                      if (entry.path === modelPath && entry.grounding_status === 'ungrounded') {
                        entry.grounding_status = 'has_semantic_declarations';
                        declsDetected++;
                      }
                    }
                  }
                }
              }
            } catch (e) {
              // fail-open: skip unreadable files
            }
          }

          // Write back only if changes were made
          if (layersFilled > 0) {
            fs.writeFileSync(registryPath, JSON.stringify(registryFile, null, 2) + '\n');
            acts.push('Filled source_layer for ' + layersFilled + ' model(s) via inferSourceLayer');
          }
          if (declsDetected > 0 && manifest) {
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
            acts.push('Detected semantic declarations in ' + declsDetected + ' model(s) \u2014 updated layer-manifest');
          }
          if (layersFilled === 0 && declsDetected === 0) {
            acts.push(res.per_model_gates.residual + ' model(s) at maturity 0 \u2014 no auto-fixable signals found');
          }
        } catch (e) {
          // fail-open: per-model gate remediation is best-effort
          acts.push('Per-model gate remediation failed: ' + e.message);
        }
      }
    },
  };

  // ── Wave-aware dispatch ────────────────────────────────────────────────────
  // Default wave structure: single wave with original hardcoded sequence
  const DEFAULT_WAVES = [{ wave: 1, layers: ['f_to_t', 'c_to_f', 't_to_c', 'r_to_f', 'f_to_c', 'r_to_d', 'd_to_c', 'p_to_f', 'per_model_gates'] }];

  const waves = waveOrder || DEFAULT_WAVES;
  for (const w of waves) {
    // Process layers within each wave in order (priority-weighted by computeWaves)
    for (const layerKey of w.layers) {
      const handler = LAYER_HANDLERS[layerKey];
      if (handler) {
        handler(residual, actions, isLayerBlocked);
      }
    }
  }

  // ── Cross-cutting concerns (not layer-specific) ────────────────────────────

  // Evidence readiness check — inform whether evidence supports promotion
  try {
    const evidenceDir = path.join(ROOT, '.planning', 'formal', 'evidence');
    const evidenceFiles = [
      'instrumentation-map.json', 'state-candidates.json',
      'failure-taxonomy.json', 'trace-corpus-stats.json', 'proposed-metrics.json'
    ];
    let ready = 0;
    for (const ef of evidenceFiles) {
      const efPath = path.join(evidenceDir, ef);
      if (fs.existsSync(efPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(efPath, 'utf8'));
          // Check for non-empty primary array
          const arrays = Object.values(data).filter(v => Array.isArray(v));
          if (arrays.some(a => a.length > 0)) ready++;
        } catch (e) { /* fail-open */ }
      }
    }
    if (ready < 3) {
      actions.push(
        'Evidence readiness: ' + ready + '/5 files populated — ' +
        'gate promotion blocked until >= 3 evidence files have content. ' +
        'Run `node bin/refresh-evidence.cjs` to populate from traces.'
      );
    } else {
      actions.push('Evidence readiness: ' + ready + '/5 — sufficient for gate promotion');
    }
  } catch (e) {
    // fail-open: evidence check is informational
  }

  return {
    actions_taken: actions,
    stubs_generated: residual.f_to_t.residual > 0 ? 1 : 0,
  };
}

// ── Health indicator ─────────────────────────────────────────────────────────

/**
 * Returns health string for a residual value.
 */
function healthIndicator(residual) {
  if (residual === -1) return '?  UNKNOWN';
  if (residual === 0) return 'OK GREEN';
  if (residual >= 1 && residual <= 3) return '!! YELLOW';
  return 'XX RED';
}

// ── Report formatting ────────────────────────────────────────────────────────

/**
 * Compute triage breakdown (FP, archived, actionable counts) for a category's items.
 * Reads solve-classifications.json and archived-solve-items.json.
 * catKey: 'dtoc', 'ctor', 'ttor', 'dtor'
 * items: array of item objects with structure matching solve-tui.cjs
 */
function computeTriageBreakdown(catKey, items) {
  const classPath = path.join(ROOT, '.planning', 'formal', 'solve-classifications.json');
  const archivePath = path.join(ROOT, '.planning', 'formal', 'archived-solve-items.json');

  let classifications = {};
  let archiveEntries = [];

  try {
    const classData = JSON.parse(fs.readFileSync(classPath, 'utf8'));
    classifications = classData.classifications?.[catKey] || {};
  } catch (_) {
    // graceful fallback
  }

  try {
    const archiveData = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    archiveEntries = archiveData.entries || [];
  } catch (_) {
    // graceful fallback
  }

  let fp_count = 0;
  let archived_count = 0;
  let actionable_count = 0;

  for (const item of items) {
    // Compute key using same logic as solve-tui.cjs itemKey()
    let key = '';
    if (catKey === 'dtoc') {
      key = `${item.doc_file}:${item.value}`;
    } else if (catKey === 'ctor') {
      key = item.file || item;
    } else if (catKey === 'ttor') {
      key = (typeof item === 'string' ? item : item.file) || item;
    } else if (catKey === 'dtor') {
      key = `${item.doc_file}:${item.line}`;
    } else {
      continue;
    }

    // Check if FP-classified
    if (classifications[key] === 'fp') {
      fp_count++;
    }
    // Check if archived
    else if (archiveEntries.some(e => e.key === key)) {
      archived_count++;
    }
    // Otherwise actionable
    else {
      actionable_count++;
    }
  }

  return { fp_count, archived_count, actionable_count, total: items.length };
}

/**
 * Formats human-readable report.
 */
function formatReport(iterations, finalResidual, converged) {
  const lines = [];

  lines.push('[nf-solve] Consistency Solver Report');
  lines.push('');
  lines.push(
    'Iterations: ' +
      iterations.length +
      '/' +
      maxIterations +
      ' (converged: ' +
      (converged ? 'yes' : 'no') +
      ')'
  );
  lines.push('');

  // Unified residual vector table
  lines.push('Layer Transition             Residual  Health');
  lines.push('─────────────────────────────────────────────');

  // Helper to render a single row
  function renderRow(label, residual) {
    const res = residual >= 0 ? residual : '?';
    const health = healthIndicator(residual);
    return label.padEnd(28) + String(res).padStart(4) + '    ' + health;
  }

  // Forward layer transitions
  const forwardRows = [
    { label: 'R -> F (Req->Formal)', residual: finalResidual.r_to_f.residual },
    { label: 'F -> T (Formal->Test)', residual: finalResidual.f_to_t.residual },
    { label: 'C -> F (Code->Formal)', residual: finalResidual.c_to_f.residual },
    { label: 'T -> C (Test->Code)', residual: finalResidual.t_to_c.residual },
    { label: 'F -> C (Formal->Code)', residual: finalResidual.f_to_c.residual },
    { label: 'R -> D (Req->Docs)', residual: finalResidual.r_to_d.residual },
    { label: 'D -> C (Docs->Code)', residual: finalResidual.d_to_c.residual, catKey: 'dtoc', detail: finalResidual.d_to_c?.detail?.broken_claims },
    { label: 'P -> F (Prod->Formal)', residual: finalResidual.p_to_f ? finalResidual.p_to_f.residual : -1 },
  ];

  for (const row of forwardRows) {
    lines.push(renderRow(row.label, row.residual));

    // Add triage breakdown for D->C row
    if (row.label === 'D -> C (Docs->Code)' && row.detail && !finalResidual.d_to_c?.detail?.skipped) {
      const items = row.detail || [];
      const triage = computeTriageBreakdown('dtoc', items);
      if (triage.total > 0) {
        lines.push('\x1b[2m  (' + triage.fp_count + ' FP, ' + triage.archived_count + ' archived, ' + triage.actionable_count + ' actionable)\x1b[0m');
      }
    }
  }
  lines.push('  Forward subtotal:      ' + finalResidual.total);

  // Reverse Discovery section (always rendered)
  lines.push('\u2500 Reverse Discovery (human-gated) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const reverseRows = [
    { label: 'C -> R (Code->Req)', residual: finalResidual.c_to_r ? finalResidual.c_to_r.residual : -1, catKey: 'ctor', detail: finalResidual.c_to_r?.detail?.untraced_modules },
    { label: 'T -> R (Test->Req)', residual: finalResidual.t_to_r ? finalResidual.t_to_r.residual : -1, catKey: 'ttor', detail: finalResidual.t_to_r?.detail?.orphan_tests },
    { label: 'D -> R (Docs->Req)', residual: finalResidual.d_to_r ? finalResidual.d_to_r.residual : -1, catKey: 'dtor', detail: finalResidual.d_to_r?.detail?.unbacked_claims },
  ];

  for (const row of reverseRows) {
    lines.push(renderRow(row.label, row.residual));

    // Add triage breakdown if detail is available and not skipped
    if (row.detail && !finalResidual[row.catKey === 'ctor' ? 'c_to_r' : row.catKey === 'ttor' ? 't_to_r' : 'd_to_r']?.detail?.skipped) {
      let items = row.detail || [];
      // Normalize items: for ttor, strings become {file: item}
      if (row.catKey === 'ttor') {
        items = items.map(item => typeof item === 'string' ? { file: item } : item);
      }
      const triage = computeTriageBreakdown(row.catKey, items);
      if (triage.total > 0) {
        lines.push('\x1b[2m  (' + triage.fp_count + ' FP, ' + triage.archived_count + ' archived, ' + triage.actionable_count + ' actionable)\x1b[0m');
      }
    }
  }

  const rdTotal = finalResidual.reverse_discovery_total || 0;
  lines.push('  Discovery subtotal:    ' + rdTotal);

  if (finalResidual.assembled_candidates && finalResidual.assembled_candidates.candidates &&
      finalResidual.assembled_candidates.candidates.length > 0) {
    const ac = finalResidual.assembled_candidates;
    lines.push('Candidates: ' + ac.candidates.length + ' (raw: ' + ac.total_raw +
      ', deduped: ' + ac.deduped + ', filtered: ' + ac.filtered +
      ', acknowledged: ' + ac.acknowledged + ')');
    if (ac.category_counts) {
      lines.push('  Category A (likely reqs): ' + (ac.category_counts.A || 0) +
        ', Category B (likely docs): ' + (ac.category_counts.B || 0) +
        ', Category C (ambiguous): ' + (ac.category_counts.C || 0));
    }
  }

  // Layer Alignment section (always rendered)
  lines.push('\u2500 Layer Alignment (cross-layer gates) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const layerRows = [
    { label: 'L1 -> L3 (Wiring:Evidence)', residual: finalResidual.l1_to_l3 ? finalResidual.l1_to_l3.residual : -1 },
    { label: 'L3 -> TC (Wiring:Coverage)', residual: finalResidual.l3_to_tc ? finalResidual.l3_to_tc.residual : -1 },
  ];

  for (const row of layerRows) {
    lines.push(renderRow(row.label, row.residual));
  }

  const layerTotal = finalResidual.layer_total || 0;
  lines.push('  Alignment subtotal:    ' + layerTotal);

  // Per-Model Gate Maturity section (informational)
  lines.push('\u2500 Per-Model Gates (maturity) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const pmgResidual = finalResidual.per_model_gates ? finalResidual.per_model_gates.residual : -1;
  lines.push(renderRow('PMG (Per-Model Gates)', pmgResidual));

  if (finalResidual.per_model_gates && finalResidual.per_model_gates.detail && !finalResidual.per_model_gates.detail.skipped) {
    const pmgd = finalResidual.per_model_gates.detail;
    lines.push('  Models: ' + (pmgd.total_models || 0) +
      ', Avg maturity: ' + (pmgd.avg_layer_maturity || 0) +
      ', Wiring:Evidence: ' + (pmgd.gate_a_pass || 0) +
      ', Wiring:Purpose: ' + (pmgd.gate_b_pass || 0) +
      ', Wiring:Coverage: ' + (pmgd.gate_c_pass || 0));
    if (pmgd.promotions > 0) {
      lines.push('  Promotions: ' + pmgd.promotions);
    }
  }

  // Git Heatmap section (informational)
  lines.push('\u2500 Git Heatmap (risk signals) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const hmResidual = finalResidual.git_heatmap ? finalResidual.git_heatmap.residual : -1;
  lines.push(renderRow('G -> H (Git->Heatmap)', hmResidual));
  const hmTotal = finalResidual.heatmap_total || 0;
  lines.push('  Heatmap subtotal:      ' + hmTotal);

  if (finalResidual.git_heatmap && finalResidual.git_heatmap.detail && !finalResidual.git_heatmap.detail.skipped) {
    const hd = finalResidual.git_heatmap.detail;
    lines.push('  Signals: ' + (hd.numerical_adjustments_count || 0) + ' adjustments, ' +
      (hd.bugfix_hotspots_count || 0) + ' bugfix hotspots, ' +
      (hd.churn_files_count || 0) + ' churn files');
  }

  // Formal Model Lint section (informational)
  lines.push('\u2500 Formal Model Lint (quality) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const flResidual = finalResidual.formal_lint ? finalResidual.formal_lint.residual : -1;
  lines.push(renderRow('FL (Formal Lint)', flResidual));

  if (finalResidual.formal_lint && finalResidual.formal_lint.detail && !finalResidual.formal_lint.detail.skipped) {
    const fld = finalResidual.formal_lint.detail;
    lines.push('  Violations: ' + (fld.total_violations || 0));
  }

  // Hazard Model section (informational — FMEA RPN scoring)
  lines.push('\u2500 Hazard Model (FMEA) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const hmrResidual = finalResidual.hazard_model ? finalResidual.hazard_model.residual : -1;
  lines.push(renderRow('HM (Hazard Model)', hmrResidual));

  if (finalResidual.hazard_model && finalResidual.hazard_model.detail && !finalResidual.hazard_model.detail.skipped) {
    const hmd = finalResidual.hazard_model.detail;
    lines.push('  Hazards: ' + (hmd.total_hazards || 0) +
      ' total, ' + (hmd.critical_count || 0) + ' critical, ' + (hmd.high_count || 0) + ' high');
  }

  // Cross-Layer Dashboard summary (aggregated view)
  try {
    const dashResult = spawnTool('bin/cross-layer-dashboard.cjs', ['--cached', '--json']);
    if (dashResult.ok && dashResult.stdout) {
      const dashData = JSON.parse(dashResult.stdout);
      lines.push('\u2500 Cross-Layer Dashboard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
      const layers = dashData.layers || dashData.scores || [];
      for (const layer of (Array.isArray(layers) ? layers : [])) {
        const label = (layer.name || layer.layer || '').padEnd(20);
        const score = layer.score !== undefined ? (layer.score * 100).toFixed(0) + '%' : '?';
        const status = layer.status || layer.health || '';
        lines.push('  ' + label + score.padStart(6) + '  ' + status);
      }
    }
  } catch (e) {
    // fail-open: dashboard is informational
  }

  // PRISM Priority ranking (informational)
  try {
    const prismResult = spawnTool('bin/prism-priority.cjs', []);
    if (prismResult.ok && prismResult.stdout && prismResult.stdout.trim()) {
      lines.push('\u2500 PRISM Priority (failure probability) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
      const prismLines = prismResult.stdout.trim().split('\n');
      for (const pl of prismLines.slice(0, 10)) {
        lines.push('  ' + pl);
      }
    }
  } catch (e) {
    // fail-open: PRISM priority is informational
  }

  // Formalization Candidates (top files to formalize next)
  try {
    const fcResult = spawnTool('bin/formalization-candidates.cjs', ['--json', '--top=5']);
    if (fcResult.ok && fcResult.stdout && fcResult.stdout.trim()) {
      const fcData = JSON.parse(fcResult.stdout);
      if (fcData.candidates && fcData.candidates.length > 0) {
        lines.push('\u2500 Formalization Candidates \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
        for (const c of fcData.candidates.slice(0, 5)) {
          const fileLabel = c.file.length > 40 ? '...' + c.file.slice(-37) : c.file;
          lines.push('  ' + fileLabel.padEnd(42) + 'score: ' + c.score.toFixed(1));
        }
      }
    }
  } catch (e) {
    // fail-open: candidates are informational
  }

  // Model Complexity profile (informational)
  try {
    const profilePath = path.join(ROOT, '.planning', 'formal', 'model-complexity-profile.json');
    if (fs.existsSync(profilePath)) {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      lines.push('\u2500 Model Complexity \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
      const s = profile.summary || {};
      lines.push('  Profiled: ' + (s.total_profiled || 0) + ' models');
      const byClass = s.by_runtime_class || {};
      lines.push('  Runtime: ' + (byClass.FAST || 0) + ' FAST, ' + (byClass.MODERATE || 0) + ' MOD, ' + (byClass.SLOW || 0) + ' SLOW, ' + (byClass.HEAVY || 0) + ' HEAVY');

      // Show split candidates
      const recs = profile.recommendations || {};
      if (recs.split_candidates && recs.split_candidates.length > 0) {
        lines.push('  Split candidates (' + recs.split_candidates.length + '):');
        for (const sc of recs.split_candidates.slice(0, 5)) {
          lines.push('    \u2197 ' + sc.check_id + ' \u2014 ' + sc.reason);
        }
      }

      // Show merge candidates
      if (recs.merge_candidates && recs.merge_candidates.length > 0) {
        lines.push('  Merge candidates (' + recs.merge_candidates.length + '):');
        for (const mc of recs.merge_candidates.slice(0, 5)) {
          lines.push('    \u2198 ' + mc.model_a + ' + ' + mc.model_b + ' \u2014 ' + mc.reason);
        }
      }
    }
  } catch (e) {
    // fail-open: complexity profile is informational
  }

  // Combined total across all sections (heatmap is informational — not in convergence loop's prevTotal)
  const hmTotal2 = finalResidual.heatmap_total || 0;
  const grandTotal = (finalResidual.total || 0) + rdTotal + layerTotal + hmTotal2;
  lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  lines.push('Grand total:             ' + grandTotal);
  lines.push('');

  // Oscillation status (from oscillation verdicts)
  try {
    const verdictsPath = path.join(ROOT, '.planning', 'formal', 'oscillation-verdicts.json');
    if (fs.existsSync(verdictsPath)) {
      const verdictData = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
      const vLayers = verdictData.layers || {};
      const blockedLayers = Object.entries(vLayers).filter(([_, v]) => v.blocked);
      const oscillatingLayers = Object.entries(vLayers).filter(([_, v]) => v.trend === 'OSCILLATING');

      if (blockedLayers.length > 0 || oscillatingLayers.length > 0) {
        lines.push('## Oscillation Status');
        lines.push('');
        for (const [name, v] of blockedLayers) {
          lines.push('  BLOCKED: ' + name + ' (credits exhausted, trend: ' + v.trend + ')');
        }
        for (const [name, v] of oscillatingLayers) {
          if (!v.blocked) {
            lines.push('  WARNING: ' + name + ' oscillating (credits: ' + v.credits_remaining + ')');
          }
        }
        lines.push('');
      }
    }
  } catch (_) { /* fail-open */ }

  // Per-layer detail sections (only non-zero)
  if (finalResidual.r_to_f.residual > 0) {
    lines.push('## R -> F (Requirements -> Formal)');
    const detail = finalResidual.r_to_f.detail;
    if (detail.uncovered_requirements && detail.uncovered_requirements.length > 0) {
      lines.push('Uncovered requirements:');
      for (const req of detail.uncovered_requirements) {
        lines.push('  - ' + req);
      }
    }
    lines.push('');
  }

  if (finalResidual.f_to_t.residual > 0) {
    lines.push('## F -> T (Formal -> Tests)');
    const detail = finalResidual.f_to_t.detail;
    lines.push('Gap count: ' + detail.gap_count);
    if (detail.gaps && detail.gaps.length > 0) {
      lines.push('Requirements with gaps:');
      for (const gap of detail.gaps.slice(0, 10)) {
        lines.push('  - ' + gap);
      }
      if (detail.gaps.length > 10) {
        lines.push('  ... and ' + (detail.gaps.length - 10) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.c_to_f.residual > 0) {
    lines.push('## C -> F (Code Constants -> Formal)');
    const detail = finalResidual.c_to_f.detail;
    if (detail.mismatches && detail.mismatches.length > 0) {
      lines.push('Mismatches:');
      for (const m of detail.mismatches.slice(0, 5)) {
        lines.push(
          '  - ' +
            m.constant +
            ': formal=' +
            m.formal_value +
            ', config=' +
            m.config_value
        );
      }
      if (detail.mismatches.length > 5) {
        lines.push('  ... and ' + (detail.mismatches.length - 5) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.t_to_c.residual > 0) {
    lines.push('## T -> C (Tests -> Code)');
    const detail = finalResidual.t_to_c.detail;
    const parts = [];
    if (detail.failed > 0) parts.push('\u2717 ' + detail.failed + ' failed');
    if (detail.skipped > 0) parts.push('\u2298 ' + detail.skipped + ' skipped');
    if (detail.todo > 0) parts.push('\u25F7 ' + detail.todo + ' todo');
    lines.push('Tests: ' + parts.join(', ') + ' (of ' + detail.total_tests + ' total)');
    lines.push('');
  }

  // F->T->C coverage summary (shown regardless of T->C residual)
  if (finalResidual.t_to_c.detail && finalResidual.t_to_c.detail.formal_coverage &&
      finalResidual.t_to_c.detail.formal_coverage.available === true) {
    const fc = finalResidual.t_to_c.detail.formal_coverage;
    lines.push('  F->T->C coverage: ' + fc.summary.fully_covered + '/' +
      fc.total_properties + ' properties fully traced (' +
      fc.false_greens.length + ' false greens)');
    lines.push('');
  }

  if (finalResidual.f_to_c.residual > 0 || (finalResidual.f_to_c.detail && finalResidual.f_to_c.detail.inconclusive > 0)) {
    lines.push('## F -> C (Formal -> Code)');
    const detail = finalResidual.f_to_c.detail;
    const parts = [];
    if (detail.passed > 0) parts.push(detail.passed + ' pass');
    if (detail.failed > 0) parts.push(detail.failed + ' fail');
    if (detail.error_count > 0) parts.push(detail.error_count + ' error');
    if (detail.inconclusive > 0) parts.push(detail.inconclusive + ' inconclusive');
    lines.push('Checks: ' + parts.join(', ') + ' (of ' + detail.total_checks + ' total)');
    if (detail.failures && detail.failures.length > 0) {
      lines.push('');
      lines.push('Failures (requirement violations):');
      for (const fail of detail.failures) {
        const f = typeof fail === 'string' ? { check_id: fail, summary: '' } : fail;
        lines.push('  ✗ ' + f.check_id + (f.summary ? ' — ' + f.summary : ''));
        if (f.requirement_ids && f.requirement_ids.length > 0) {
          lines.push('    reqs: ' + f.requirement_ids.join(', '));
        }
      }
    }
    if (detail.errors && detail.errors.length > 0) {
      lines.push('');
      lines.push('Errors (infrastructure/tooling):');
      for (const err of detail.errors) {
        const e = typeof err === 'string' ? { check_id: err, summary: '' } : err;
        lines.push('  ⚙ ' + e.check_id + (e.summary ? ' — ' + e.summary : ''));
      }
    }
    if (detail.inconclusive_checks && detail.inconclusive_checks.length > 0) {
      lines.push('');
      lines.push('Inconclusive:');
      for (const w of detail.inconclusive_checks) {
        lines.push('  ⚠ ' + w.check_id + (w.summary ? ' — ' + w.summary : ''));
      }
    }
    if (detail.stale) {
      lines.push('');
      lines.push('Note: results may be stale (from cached check-results.ndjson)');
    }
    lines.push('');
  }

  if (finalResidual.r_to_d.residual > 0) {
    lines.push('## R -> D (Requirements -> Docs)');
    const detail = finalResidual.r_to_d.detail;
    if (detail.undocumented_requirements && detail.undocumented_requirements.length > 0) {
      lines.push('Undocumented requirements:');
      for (const req of detail.undocumented_requirements.slice(0, 20)) {
        lines.push('  - ' + req);
      }
      if (detail.undocumented_requirements.length > 20) {
        lines.push('  ... and ' + (detail.undocumented_requirements.length - 20) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.d_to_c.residual > 0) {
    lines.push('## D -> C (Docs -> Code)');
    const detail = finalResidual.d_to_c.detail;
    if (detail.broken_claims && detail.broken_claims.length > 0) {
      lines.push('Broken structural claims:');
      for (const claim of detail.broken_claims.slice(0, 20)) {
        lines.push('  - ' + claim.doc_file + ':' + claim.line + ' [' + claim.type + '] `' + claim.value + '` — ' + claim.reason);
      }
      if (detail.broken_claims.length > 20) {
        lines.push('  ... and ' + (detail.broken_claims.length - 20) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.p_to_f && finalResidual.p_to_f.residual > 0) {
    lines.push('## P -> F (Production -> Formal)');
    const detail = finalResidual.p_to_f.detail;
    if (detail.divergent_entries && detail.divergent_entries.length > 0) {
      lines.push('Divergent entries:');
      for (const ent of detail.divergent_entries.slice(0, 20)) {
        lines.push('  - ' + ent.id + ': ' + ent.formal_ref + ' (measured: ' + ent.measured + ', expected: ' + ent.expected + ')');
      }
      if (detail.divergent_entries.length > 20) {
        lines.push('  ... and ' + (detail.divergent_entries.length - 20) + ' more');
      }
    }
    if (detail.skipped_unlinked > 0) {
      lines.push('Skipped (waiting for formal link): ' + detail.skipped_unlinked);
    }
    lines.push('');
  }

  // Reverse traceability detail
  if (finalResidual.c_to_r && finalResidual.c_to_r.residual > 0) {
    lines.push('## C -> R (Code -> Requirements) [reverse discovery]');
    const detail = finalResidual.c_to_r.detail;
    if (detail.untraced_modules && detail.untraced_modules.length > 0) {
      lines.push('Untraced modules (' + detail.untraced_modules.length + ' of ' + detail.total_modules + '):');
      for (const mod of detail.untraced_modules.slice(0, 20)) {
        lines.push('  - ' + mod.file);
      }
      if (detail.untraced_modules.length > 20) {
        lines.push('  ... and ' + (detail.untraced_modules.length - 20) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.t_to_r && finalResidual.t_to_r.residual > 0) {
    lines.push('## T -> R (Tests -> Requirements) [reverse discovery]');
    const detail = finalResidual.t_to_r.detail;
    if (detail.orphan_tests && detail.orphan_tests.length > 0) {
      lines.push('Orphan tests (' + detail.orphan_tests.length + ' of ' + detail.total_tests + '):');
      for (const t of detail.orphan_tests.slice(0, 20)) {
        lines.push('  - ' + t);
      }
      if (detail.orphan_tests.length > 20) {
        lines.push('  ... and ' + (detail.orphan_tests.length - 20) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.d_to_r && finalResidual.d_to_r.residual > 0) {
    lines.push('## D -> R (Docs -> Requirements) [reverse discovery]');
    const detail = finalResidual.d_to_r.detail;
    if (detail.unbacked_claims && detail.unbacked_claims.length > 0) {
      lines.push('Unbacked doc claims (' + detail.unbacked_claims.length + ' of ' + detail.total_claims + '):');
      for (const c of detail.unbacked_claims.slice(0, 20)) {
        lines.push('  - ' + c.doc_file + ':' + c.line + ' — ' + c.claim_text);
      }
      if (detail.unbacked_claims.length > 20) {
        lines.push('  ... and ' + (detail.unbacked_claims.length - 20) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.git_heatmap && finalResidual.git_heatmap.residual > 0) {
    lines.push('## G -> H (Git Heatmap) [risk signals]');
    const detail = finalResidual.git_heatmap.detail;
    if (detail.uncovered_hot_zones && detail.uncovered_hot_zones.length > 0) {
      lines.push('Uncovered hot zones (' + detail.total_hot_zones + ' total):');
      for (const hz of detail.uncovered_hot_zones.slice(0, 10)) {
        lines.push('  - ' + hz.file + ' (priority: ' + hz.priority + ', signals: ' + (hz.signals || []).join(', ') + ')');
      }
      if (detail.total_hot_zones > 10) {
        lines.push('  ... and ' + (detail.total_hot_zones - 10) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.git_history && finalResidual.git_history.residual > 0) {
    lines.push('## GH (Git History Evidence) [TLA+ drift]');
    const detail = finalResidual.git_history.detail;
    if (detail.top_drift_candidates && detail.top_drift_candidates.length > 0) {
      lines.push('TLA+ drift candidates (' + detail.tla_drift_count + ' total):');
      for (const dc of detail.top_drift_candidates.slice(0, 10)) {
        lines.push('  - ' + dc.file + ' (' + dc.recent_feat_or_fix + ' feat/fix) -> ' + dc.tla_spec);
      }
      if (detail.tla_drift_count > 10) {
        lines.push('  ... and ' + (detail.tla_drift_count - 10) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.formal_lint && finalResidual.formal_lint.residual > 0) {
    lines.push('## FL (Formal Model Lint) [quality]');
    const detail = finalResidual.formal_lint.detail;
    if (detail.violations && detail.violations.length > 0) {
      lines.push('Lint violations (' + detail.total_violations + ' total):');
      for (const v of detail.violations.slice(0, 10)) {
        lines.push('  - ' + (v.model || '?') + ' [' + (v.rule || '?') + ']: ' + (v.message || ''));
      }
      if (detail.total_violations > 10) {
        lines.push('  ... and ' + (detail.total_violations - 10) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.hazard_model && finalResidual.hazard_model.residual > 0) {
    lines.push('## HM (Hazard Model) [FMEA]');
    const detail = finalResidual.hazard_model.detail;
    lines.push('Critical+High hazards: ' + (detail.critical_count || 0) + ' critical, ' + (detail.high_count || 0) + ' high');
    if (detail.top_hazards && detail.top_hazards.length > 0) {
      lines.push('Top hazards by RPN:');
      for (const h of detail.top_hazards.slice(0, 5)) {
        lines.push('  - ' + (h.from || '?') + ' -> ' + (h.event || '?') + ' (RPN: ' + (h.rpn || 0) + ')');
      }
    }
    lines.push('');
  }

  // FPTUNE-03: Append FP rate table when session history exists
  try {
    const classData = JSON.parse(fs.readFileSync(path.join(ROOT, '.planning', 'formal', 'solve-classifications.json'), 'utf8'));
    const sessionHist = classData.session_history || [];
    if (sessionHist.length > 0) {
      const fpRatesForReport = computeFPRates(sessionHist);
      const tuningForReport = classData.tuning || {};
      lines.push('');
      lines.push(formatFPRateTable(fpRatesForReport, tuningForReport));
    }
  } catch (_) { /* fail-open: no session history yet */ }

  return lines.join('\n');
}

/**
 * Truncate detail arrays in a residual object to keep JSON output within pipe buffer limits.
 * Returns a shallow copy with truncated arrays and a `truncated` flag if applicable.
 */
function truncateResidualDetail(residual) {
  const MAX_DETAIL_ITEMS = 30;
  const copy = {};
  for (const key of Object.keys(residual)) {
    const val = residual[key];
    if (val && typeof val === 'object' && val.detail && typeof val.detail === 'object') {
      const detailCopy = Object.assign({}, val.detail);
      // Truncate large arrays in detail
      for (const dk of Object.keys(detailCopy)) {
        if (Array.isArray(detailCopy[dk]) && detailCopy[dk].length > MAX_DETAIL_ITEMS) {
          const totalCount = detailCopy[dk].length;
          detailCopy[dk] = detailCopy[dk].slice(0, MAX_DETAIL_ITEMS);
          detailCopy[dk + '_truncated'] = true;
          detailCopy[dk + '_total'] = totalCount;
        }
      }
      copy[key] = { residual: val.residual, detail: detailCopy };
    } else {
      copy[key] = val;
    }
  }
  return copy;
}

/**
 * Formats JSON output.
 */
function formatJSON(iterations, finalResidual, converged) {
  const health = {};
  for (const key of LAYER_KEYS) {
    const res = finalResidual[key] ? finalResidual[key].residual : -1;
    health[key] = healthIndicator(res).split(/\s+/)[1]; // Extract GREEN/YELLOW/RED/UNKNOWN
  }

  const truncatedResidual = truncateResidualDetail(finalResidual);

  // Attach complexity profile summary if available
  let complexityProfile = null;
  try {
    const profilePath = path.join(ROOT, '.planning', 'formal', 'model-complexity-profile.json');
    if (fs.existsSync(profilePath)) {
      const raw = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      complexityProfile = {
        summary: raw.summary,
        split_candidates: (raw.recommendations || {}).split_candidates || [],
        merge_candidates: (raw.recommendations || {}).merge_candidates || [],
      };
    }
  } catch (e) { /* fail-open */ }

  // Attach oscillation verdict data if available
  let oscillation = null;
  try {
    const verdictsPath = path.join(ROOT, '.planning', 'formal', 'oscillation-verdicts.json');
    if (fs.existsSync(verdictsPath)) {
      const verdictData = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
      oscillation = {
        entry_count: verdictData.entry_count || 0,
        layers: verdictData.layers || {},
      };
    }
  } catch (_) { /* fail-open */ }

  return {
    solver_version: '1.2',
    generated_at: new Date().toISOString(),
    fast_mode: fastMode ? true : false,
    iteration_count: iterations.length,
    max_iterations: maxIterations,
    converged: converged,
    residual_vector: truncatedResidual,
    iterations: iterations.map((it) => ({
      iteration: it.iteration,
      residual: truncateResidualDetail(it.residual),
      actions: it.actions || [],
    })),
    health: health,
    complexity_profile: complexityProfile,
    oscillation: oscillation,
    capped_layers: [],
    baseline_drift: { detected: false, layers: [], warning: null },
  };
}

// ── Clean Session Check (PROMO-02) ──────────────────────────────────────────

/**
 * Checks whether the current solve session is "clean" — all gate wiring scores
 * >= 1.0, all semantic scores >= 0.8, and no formal counterexamples.
 *
 * @returns {boolean} true if the session is clean
 */
function checkCleanSession() {
  const GATE_FILES = {
    A: { file: 'gate-a-grounding.json', wiringKey: 'wiring_evidence_score' },
    B: { file: 'gate-b-abstraction.json', wiringKey: 'wiring_purpose_score' },
    C: { file: 'gate-c-validation.json', wiringKey: 'wiring_coverage_score' },
  };

  const gatesDir = path.join(ROOT, '.planning', 'formal', 'gates');
  const wiring = {};
  const semantic = {};

  for (const [label, cfg] of Object.entries(GATE_FILES)) {
    try {
      const gateData = JSON.parse(fs.readFileSync(path.join(gatesDir, cfg.file), 'utf8'));
      wiring[label] = gateData[cfg.wiringKey] != null ? gateData[cfg.wiringKey] : 0;
      semantic[label] = gateData.semantic_score != null ? gateData.semantic_score : 0;
      // PROMO-03 diagnostic: log whether semantic_score was loaded or defaulted
      if (gateData.semantic_score == null) {
        process.stderr.write(TAG + ' checkCleanSession: gate ' + label + ' semantic_score defaulted to 0 (field missing)\n');
      } else {
        process.stderr.write(TAG + ' checkCleanSession: gate ' + label + ' semantic_score=' + gateData.semantic_score + ' (from file)\n');
      }
    } catch (_) {
      wiring[label] = 0;
      semantic[label] = 0;
    }
  }

  // Check formal results — no counterexamples
  let formalPass = true;
  try {
    const checkResultsPath = path.join(ROOT, '.planning', 'formal', 'check-results.ndjson');
    if (fs.existsSync(checkResultsPath)) {
      const lines = fs.readFileSync(checkResultsPath, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.result === 'counterexample') {
            formalPass = false;
            break;
          }
        } catch (_) { /* skip malformed lines */ }
      }
    }
  } catch (_) { /* fail-open */ }

  const wiringClean = wiring.A >= 1.0 && wiring.B >= 1.0 && wiring.C >= 1.0;
  const semanticClean = semantic.A >= 0.8 && semantic.B >= 0.8 && semantic.C >= 0.8;
  const isClean = wiringClean && semanticClean && formalPass;

  process.stderr.write(
    TAG + ' Clean session check: wiring=[A:' + wiring.A + ',B:' + wiring.B + ',C:' + wiring.C +
    '] semantic=[A:' + semantic.A + ',B:' + semantic.B + ',C:' + semantic.C +
    '] formal=' + (formalPass ? 'pass' : 'fail') + ' -> ' + (isClean ? 'CLEAN' : 'NOT_CLEAN') + '\n'
  );

  return isClean;
}

// ── FPTUNE: Per-scanner FP rate tracking and auto-threshold tuning ───────────

/**
 * FPTUNE-01: Compute per-scanner per-category stats from classifications.
 * @param {Object} classifications - { ctor: {...}, ttor: {...}, dtor: {...}, dtoc: {...} }
 * @returns {Object} Per-scanner stats: { ctor: { total, fp, genuine, review }, ... }
 */
function computeScannerStats(classifications) {
  const stats = {};
  for (const [scannerKey, entries] of Object.entries(classifications || {})) {
    const values = Object.values(entries);
    stats[scannerKey] = {
      total: values.length,
      fp: values.filter(v => v === 'fp').length,
      genuine: values.filter(v => v === 'genuine').length,
      review: values.filter(v => v === 'review').length,
    };
  }
  return stats;
}

/**
 * FPTUNE-01: Record a session entry to session_history in solve-classifications.json.
 * Rolling window: keeps last 10 sessions.
 * @param {string} classificationsFilePath - Path to solve-classifications.json
 * @param {Object} scannerStats - From computeScannerStats()
 * @returns {Array} Updated session_history array
 */
function recordSessionHistory(classificationsFilePath, scannerStats) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(classificationsFilePath, 'utf8')); } catch (_) {}
  if (!Array.isArray(data.session_history)) data.session_history = [];

  data.session_history.push({
    session_id: new Date().toISOString(),
    scanner_stats: scannerStats,
  });

  // Rolling window: keep last 10 sessions
  if (data.session_history.length > 10) {
    data.session_history = data.session_history.slice(data.session_history.length - 10);
  }

  data.updated_at = new Date().toISOString();
  fs.writeFileSync(classificationsFilePath, JSON.stringify(data, null, 2) + '\n');
  return data.session_history;
}

/**
 * FPTUNE-01: Compute rolling FP rates per scanner from session_history.
 * @param {Array} sessionHistory - Array of session entries
 * @returns {Object} Per-scanner rates: { ctor: { sessions, total_items, total_fp, fp_rate }, ... }
 */
function computeFPRates(sessionHistory) {
  const rates = {};
  const scannerKeys = new Set();
  for (const session of (sessionHistory || [])) {
    for (const key of Object.keys(session.scanner_stats || {})) {
      scannerKeys.add(key);
    }
  }

  for (const key of scannerKeys) {
    let totalItems = 0;
    let totalFP = 0;
    let sessionCount = 0;
    for (const session of sessionHistory) {
      const stats = (session.scanner_stats || {})[key];
      if (stats) {
        totalItems += stats.total;
        totalFP += stats.fp;
        sessionCount++;
      }
    }
    rates[key] = {
      sessions: sessionCount,
      total_items: totalItems,
      total_fp: totalFP,
      fp_rate: totalItems > 0 ? totalFP / totalItems : 0,
    };
  }
  return rates;
}

/**
 * FPTUNE-02: Auto-raise suppression threshold for scanners with FP rate > 60% over 5+ sessions.
 * Threshold increase: +0.1 per tuning cycle, capped at 0.9.
 * @param {string} classificationsFilePath - Path to solve-classifications.json
 * @param {Object} fpRates - From computeFPRates()
 * @returns {Array} Changes applied: [{ scanner, from, to, fp_rate, sessions }]
 */
function applyFPTuning(classificationsFilePath, fpRates) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(classificationsFilePath, 'utf8')); } catch (_) {}
  if (!data.tuning) data.tuning = {};

  const changes = [];

  for (const [scannerKey, rateInfo] of Object.entries(fpRates)) {
    const currentThreshold = data.tuning[scannerKey] || 0.5;
    if (rateInfo.sessions >= 5 && rateInfo.fp_rate > 0.6) {
      const newThreshold = Math.min(currentThreshold + 0.1, 0.9);
      if (newThreshold !== currentThreshold) {
        data.tuning[scannerKey] = parseFloat(newThreshold.toFixed(2));
        changes.push({
          scanner: scannerKey,
          from: currentThreshold,
          to: data.tuning[scannerKey],
          fp_rate: rateInfo.fp_rate,
          sessions: rateInfo.sessions,
        });
      }
    }
    // Ensure scanner has an entry even if no tuning needed
    if (data.tuning[scannerKey] == null) {
      data.tuning[scannerKey] = 0.5;
    }
  }

  data.updated_at = new Date().toISOString();
  fs.writeFileSync(classificationsFilePath, JSON.stringify(data, null, 2) + '\n');
  return changes;
}

/**
 * FPTUNE-03: Format per-scanner FP rate table for diagnostics output.
 * @param {Object} fpRates - From computeFPRates()
 * @param {Object} tuning - From solve-classifications.json tuning section
 * @returns {string} Formatted table
 */
function formatFPRateTable(fpRates, tuning) {
  const lines = [];
  lines.push('');
  lines.push('Per-Scanner FP Rates (last 10 sessions):');
  lines.push('| Scanner | Sessions | FP Rate | Threshold | Status |');
  lines.push('|---------|----------|---------|-----------|--------|');

  const scannerOrder = ['ctor', 'ttor', 'dtor', 'dtoc'];
  const keys = scannerOrder.filter(k => fpRates[k]);
  // Add any keys not in the predefined order
  for (const k of Object.keys(fpRates)) {
    if (!keys.includes(k)) keys.push(k);
  }

  for (const key of keys) {
    const rate = fpRates[key];
    const threshold = (tuning && tuning[key]) || 0.5;
    const fpPct = (rate.fp_rate * 100).toFixed(1) + '%';
    const status = rate.fp_rate > 0.6 && rate.sessions >= 5 ? 'TUNED' : 'OK';
    lines.push('| ' + key.padEnd(7) + ' | ' + String(rate.sessions).padEnd(8) + ' | ' + fpPct.padEnd(7) + ' | ' + threshold.toFixed(2).padEnd(9) + ' | ' + status.padEnd(6) + ' |');
  }

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Step 0: Bootstrap formal infrastructure
  preflight();

  // Read existing solve-state.json for consecutive_clean_sessions (PROMO-02)
  let existingSolveState = {};
  try {
    existingSolveState = JSON.parse(fs.readFileSync(path.join(ROOT, '.planning', 'formal', 'solve-state.json'), 'utf8'));
  } catch (_) { /* first run or corrupt file */ }

  // Ensure consecutive_clean_sessions is initialized (PROMO-02)
  // The || 0 fallback at line ~3816 already handles missing field safely.
  // This explicit guard makes the initialization contract visible at preflight time
  // and prevents edge cases where other code reads existingSolveState.consecutive_clean_sessions
  // before the persistence block.
  if (existingSolveState.consecutive_clean_sessions == null) {
    existingSolveState.consecutive_clean_sessions = 0;
  }

  const iterations = [];
  let converged = false;
  let prevTotal = null;

  // Refresh evidence files from recent traces before convergence loop
  if (!reportOnly) {
    const evResult = spawnTool('bin/refresh-evidence.cjs', ['--json']);
    if (evResult.ok) {
      process.stderr.write(TAG + ' Evidence refresh: ' + evResult.stdout.trim() + '\n');
    }
  }

  const cycleDetector = new CycleDetector();

  for (let i = 1; i <= maxIterations; i++) {
    process.stderr.write(TAG + ' Iteration ' + i + '/' + maxIterations + '\n');

    // Clear formal-test-sync cache so computeResidual() sees fresh data after autoClose() mutations
    formalTestSyncCache = null;

    const residual = computeResidual();
    const actions = [];
    iterations.push({ iteration: i, residual: residual, actions: actions });

    // Record per-layer residuals for cycle detection (CONV-01)
    const perLayerResiduals = {};
    for (const key of LAYER_KEYS) {
      if (residual[key] && typeof residual[key].residual === 'number') {
        perLayerResiduals[key] = residual[key].residual;
      }
    }
    cycleDetector.record(i, perLayerResiduals);
    const oscillatingLayers = cycleDetector.detectOscillating();
    if (oscillatingLayers.length > 0) {
      process.stderr.write(TAG + ' Oscillating layers detected: ' + oscillatingLayers.join(', ') + ' — excluding from convergence check and dispatch\n');
    }

    // Compute effectiveTotal excluding oscillating layers (CONV-01)
    const oscillatingSet = new Set(oscillatingLayers);
    let oscillatingSum = 0;
    for (const layer of oscillatingLayers) {
      if (residual[layer] && typeof residual[layer].residual === 'number' && residual[layer].residual > 0) {
        oscillatingSum += residual[layer].residual;
      }
    }
    const effectiveTotal = residual.total - oscillatingSum;

    // Check convergence: effective residual unchanged from previous iteration
    if (prevTotal !== null && effectiveTotal === prevTotal) {
      converged = true;
      process.stderr.write(
        TAG +
          ' Converged at iteration ' +
          i +
          ' (effective residual stable at ' +
          effectiveTotal +
          (oscillatingLayers.length > 0 ? ', excluding oscillating: ' + oscillatingLayers.join(', ') : '') +
          ')\n'
      );
      break;
    }

    // Check if already at zero
    if (effectiveTotal === 0) {
      converged = true;
      process.stderr.write(TAG + ' All non-oscillating layers clean — effective residual is 0' +
        (oscillatingLayers.length > 0 ? ' (oscillating: ' + oscillatingLayers.join(', ') + ')' : '') + '\n');
      break;
    }

    // Auto-close if not report-only and not last iteration
    if (!reportOnly) {
      // HTARGET-01/02: Compute hypothesis-driven wave dispatch order
      let waveOrder = null;
      try {
        const transitions = loadHypothesisTransitions(ROOT);
        const priorityWeights = computeLayerPriorityWeights(transitions);
        const computedWaves = computeWaves(residual, priorityWeights);
        if (computedWaves.length > 0) {
          waveOrder = computedWaves;  // Preserve full wave structure (not flattened)
          process.stderr.write(TAG + ' Wave ordering (' + computedWaves.length + ' waves, ' +
            (transitions.length > 0 ? transitions.length + ' hypothesis transition(s) applied' : 'no transitions') +
            '): ' + computedWaves.map(w => 'W' + w.wave + '[' + w.layers.join(',') + ']' + (w.sequential ? '(seq)' : '')).join(' -> ') + '\n');
        }
      } catch (e) {
        // fail-open: wave ordering failure means autoClose uses default order
        process.stderr.write(TAG + ' WARNING: wave ordering failed: ' + e.message + '\n');
      }

      const closeResult = autoClose(residual, oscillatingSet, waveOrder);
      iterations[iterations.length - 1].actions = closeResult.actions_taken;
      iterations[iterations.length - 1].wave_order = waveOrder;
    } else {
      break; // report-only = single sweep, no loop
    }

    prevTotal = effectiveTotal;
  }

  const finalResidual = iterations[iterations.length - 1].residual;

  // Write solver state persistence
  const solveState = {
    last_run: new Date().toISOString(),
    converged: converged,
    iteration_count: iterations.length,
    final_residual_total: finalResidual.total,
    reverse_discovery_total: finalResidual.reverse_discovery_total || 0,
    heatmap_total: finalResidual.heatmap_total || 0,
    known_issues: [],
    r_to_f_progress: {
      total: finalResidual.r_to_f.detail.total || 0,
      covered: finalResidual.r_to_f.detail.covered || 0,
      percentage: finalResidual.r_to_f.detail.percentage || 0,
    },
    focus: focusPhrase || null,
    capped_layers: [],
    baseline_drift: { detected: false, layers: [], warning: null },
  };
  // Collect known issues from non-zero non-error layers
  // -- Load classification cache and archive data for net_residual computation --
  const LAYER_CAT_MAP = {
    d_to_c: { catKey: 'dtoc', detailKey: 'broken_claims' },
    c_to_r: { catKey: 'ctor', detailKey: 'untraced_modules' },
    t_to_r: { catKey: 'ttor', detailKey: 'orphan_tests' },
    d_to_r: { catKey: 'dtor', detailKey: 'unbacked_claims' },
  };

  let classificationsByCategory = {};
  try {
    const cached = JSON.parse(fs.readFileSync(path.join(ROOT, '.planning', 'formal', 'solve-classifications.json'), 'utf8'));
    classificationsByCategory = cached.classifications || {};
  } catch (_) { /* fail-open */ }

  // FPTUNE-01: Record session history and compute FP rates
  const scannerStats = computeScannerStats(classificationsByCategory);
  const classPath = path.join(ROOT, '.planning', 'formal', 'solve-classifications.json');
  if (!reportOnly) {
    recordSessionHistory(classPath, scannerStats);
  }

  // FPTUNE-02: Auto-tune suppression thresholds
  const fpRates = computeFPRates(
    (() => { try { return JSON.parse(fs.readFileSync(classPath, 'utf8')).session_history || []; } catch (_) { return []; } })()
  );
  if (!reportOnly) {
    const tuningChanges = applyFPTuning(classPath, fpRates);
    if (tuningChanges.length > 0) {
      for (const c of tuningChanges) {
        process.stderr.write(TAG + ' FPTUNE: ' + c.scanner + ' threshold raised ' + c.from + ' -> ' + c.to + ' (FP rate: ' + (c.fp_rate * 100).toFixed(1) + '% over ' + c.sessions + ' sessions)\n');
      }
    }
  }

  let archiveEntries = [];
  try {
    const archiveData = JSON.parse(fs.readFileSync(path.join(ROOT, '.planning', 'formal', 'archived-solve-items.json'), 'utf8'));
    archiveEntries = archiveData.entries || [];
  } catch (_) { /* fail-open */ }

  function netResidualItemKey(catKey, item) {
    if (catKey === 'dtoc') return `${item.doc_file}:${item.value}`;
    if (catKey === 'ctor') return typeof item === 'string' ? item : item.file;
    if (catKey === 'ttor') return typeof item === 'string' ? item : item.file;
    if (catKey === 'dtor') return `${item.doc_file}:${item.line}`;
    return JSON.stringify(item).slice(0, 100);
  }

  function netResidualArchiveKey(catKey, item) {
    if (catKey === 'dtoc') return `${item.doc_file}:${item.value}`;
    if (catKey === 'dtor') return `${item.doc_file}:${item.line}`;
    return typeof item === 'string' ? item : (item.file || item.summary);
  }

  for (const [key, val] of Object.entries(finalResidual)) {
    if (val && typeof val === 'object' && val.residual > 0) {
      const mapping = LAYER_CAT_MAP[key];
      if (mapping) {
        const { catKey, detailKey } = mapping;
        const detailItems = (val.detail && val.detail[detailKey]) || [];
        const catClassifications = classificationsByCategory[catKey] || {};

        // Filter out FP-classified items
        const afterFP = detailItems.filter(item => {
          const k = netResidualItemKey(catKey, item);
          return catClassifications[k] !== 'fp';
        });

        // Filter out archived items
        const afterArchive = afterFP.filter(item => {
          const ak = netResidualArchiveKey(catKey, item);
          return !archiveEntries.some(e => e.key === ak);
        });

        solveState.known_issues.push({ layer: key, residual: val.residual, net_residual: afterArchive.length });
      } else {
        solveState.known_issues.push({ layer: key, residual: val.residual });
      }
    }
  }
  // Step 8a: Track consecutive clean sessions for auto-promotion (PROMO-02)
  const isCleanSession = checkCleanSession();
  const prevClean = (existingSolveState && existingSolveState.consecutive_clean_sessions) || 0;
  solveState.consecutive_clean_sessions = isCleanSession ? prevClean + 1 : 0;

  try {
    const stateDir = path.join(ROOT, '.planning', 'formal');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'solve-state.json'),
      JSON.stringify(solveState, null, 2) + '\n'
    );
  } catch (e) {
    process.stderr.write(TAG + ' WARNING: could not write solve-state.json: ' + e.message + '\n');
  }

  // Step 8a: Auto-promote eligible models (PROMO-01)
  if (!reportOnly && solveState.consecutive_clean_sessions >= 3) {
    process.stderr.write(TAG + ' Step 8a: Checking auto-promotion eligibility (clean sessions: ' + solveState.consecutive_clean_sessions + ')\n');
    const promoResult = spawnTool('bin/promote-gate-maturity.cjs', ['--auto-promote', '--json']);
    if (promoResult.ok) {
      try {
        const promoData = JSON.parse(promoResult.stdout);
        if (promoData.promoted && promoData.promoted.length > 0) {
          process.stderr.write(TAG + ' Step 8a: Promoted ' + promoData.promoted.length + ' model(s) SOFT_GATE -> HARD_GATE\n');
          for (const m of promoData.promoted) {
            process.stderr.write(TAG + '   - ' + m + '\n');
          }
        } else {
          process.stderr.write(TAG + ' Step 8a: No models eligible for promotion\n');
        }
      } catch (e) {
        process.stderr.write(TAG + ' Step 8a: Could not parse promotion result: ' + e.message + '\n');
      }
    } else {
      process.stderr.write(TAG + ' Step 8a: promote-gate-maturity.cjs failed: ' + (promoResult.stderr || 'unknown') + '\n');
    }
  } else if (!reportOnly) {
    process.stderr.write(TAG + ' Step 8a: Skipped — consecutive_clean_sessions=' + (solveState.consecutive_clean_sessions || 0) + ' (need 3)\n');
  }

  // Append trend entry to JSONL (after solve-state.json, before session persistence)
  appendTrendEntry(finalResidual, converged, iterations.length, {
    root: ROOT,
    fastMode: fastMode,
  });

  // Update oscillation verdicts after trend entry is written
  if (!reportOnly) {
    // OSC-03: Read previous verdicts before update for newly-blocked detection
    let prevVerdictsLayers = null;
    try {
      const vPath = path.join(ROOT, '.planning', 'formal', 'oscillation-verdicts.json');
      if (fs.existsSync(vPath)) {
        prevVerdictsLayers = JSON.parse(fs.readFileSync(vPath, 'utf8')).layers || null;
      }
    } catch (_) { /* fail-open */ }

    try {
      const currVerdicts = updateVerdicts({ root: ROOT });

      // OSC-03: Escalation classification when oscillation breaker fires
      const newlyBlocked = detectNewlyBlocked(prevVerdictsLayers, currVerdicts && currVerdicts.layers);
      if (newlyBlocked.length > 0) {
        for (const layer of newlyBlocked) {
          try {
            const classResult = spawnSync(process.execPath, [
              path.join(__dirname, 'escalation-classifier.cjs'),
              '--layer=' + layer,
              '--project-root=' + ROOT,
            ], { encoding: 'utf8', timeout: 15000 });

            if (classResult.status === 0 && classResult.stdout) {
              const parsed = JSON.parse(classResult.stdout);
              process.stderr.write(TAG + ' Escalation: ' + layer + ' -> ' +
                parsed.classification + ' (confidence: ' + parsed.confidence + ')\n');
            }
          } catch (classErr) {
            process.stderr.write(TAG + ' WARNING: escalation classification failed for ' +
              layer + ': ' + classErr.message + '\n');
          }
        }
      }
    } catch (e) {
      process.stderr.write(TAG + ' WARNING: oscillation verdict update failed: ' + e.message + '\n');
    }
  }

  // Update predictive power metrics (bug linking, recall, velocity)
  let predictivePowerResults = null;
  if (!reportOnly) {
    try {
      predictivePowerResults = updatePredictivePower({ root: ROOT });
    } catch (e) {
      process.stderr.write(TAG + ' WARNING: predictive power update failed: ' + e.message + '\n');
    }
  }

  // Pre-compute both outputs for session persistence (avoid redundant formatting)
  let reportText = formatReport(iterations, finalResidual, converged);
  if (predictivePowerResults) {
    reportText += '\n' + formatPredictivePowerSummary(predictivePowerResults);
  }
  const jsonObj = formatJSON(iterations, finalResidual, converged);
  jsonObj.oscillating_layers = cycleDetector.detectOscillating();
  const jsonText = JSON.stringify(jsonObj, null, 2);

  // Persist session summary before stdout/exit
  persistSessionSummary(reportText, jsonText, converged, iterations);

  const exitCode = finalResidual.total > 0 ? 1 : 0;
  const outputText = jsonMode ? (jsonText + '\n') : reportText;

  // Drain stdout before exit to prevent pipe truncation (process.exit() does not
  // guarantee async stdout buffers are flushed when writing to a pipe/spawnSync).
  if (process.stdout.write(outputText)) {
    // Write was synchronous (no backpressure) — exit immediately
    process.exit(exitCode);
  } else {
    // Write is buffered — wait for drain before exiting
    process.stdout.once('drain', () => process.exit(exitCode));
  }
}

// ── Session Persistence ──────────────────────────────────────────────────────

const MAX_SESSION_FILES = 20;

/**
 * Persist a timestamped session summary to disk.
 * Accepts pre-computed strings to avoid redundant formatting calls.
 * @param {string} reportText - Human-readable report from formatReport()
 * @param {string} jsonText - JSON string from formatJSON()
 * @param {boolean} converged - Whether the solver converged
 * @param {Array} iterations - Array of iteration objects with actions
 * @param {string} [sessionsDir] - Override directory (for testing)
 */
function persistSessionSummary(reportText, jsonText, converged, iterations, sessionsDir) {
  try {
    const dir = sessionsDir || path.join(ROOT, '.planning', 'formal', 'solve-sessions');
    fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const ts = now.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
    const filename = 'solve-session-' + ts + '.md';

    // Build actions section
    let actionsContent = '';
    for (let i = 0; i < iterations.length; i++) {
      const iter = iterations[i];
      const actions = iter.actions || [];
      actionsContent += '### Iteration ' + (i + 1) + '\n\n';
      if (actions.length === 0) {
        actionsContent += '_No auto-close actions taken._\n\n';
      } else {
        for (const a of actions) {
          actionsContent += '- ' + a + '\n';
        }
        actionsContent += '\n';
      }
    }

    const content =
      '# nf-solve Session Summary\n\n' +
      '**Timestamp:** ' + now.toISOString() + '\n' +
      '**Converged:** ' + (converged ? 'Yes' : 'No') + '\n' +
      '**Iterations:** ' + iterations.length + '\n\n' +
      '## Residual Vector\n\n' +
      reportText + '\n\n' +
      '## Machine State\n\n' +
      '```json\n' + jsonText + '\n```\n\n' +
      '## Actions Taken\n\n' +
      actionsContent;

    fs.writeFileSync(path.join(dir, filename), content);

    // Prune old sessions — keep only the newest MAX_SESSION_FILES
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('solve-session-') && f.endsWith('.md'))
      .sort();
    if (files.length > MAX_SESSION_FILES) {
      const toDelete = files.slice(0, files.length - MAX_SESSION_FILES);
      for (const f of toDelete) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) { /* ignore */ }
      }
    }
  } catch (e) {
    process.stderr.write(TAG + ' WARNING: could not write session summary: ' + e.message + '\n');
  }
}

// ── Exports (for testing) ────────────────────────────────────────────────────

module.exports = {
  sweep: computeResidual,
  computeResidual,
  autoClose,
  formatReport,
  formatJSON,
  healthIndicator,
  preflight,
  triageRequirements,
  discoverDocFiles,
  extractKeywords,
  extractStructuralClaims,
  sweepRtoF,
  sweepFtoT,
  sweepCtoF,
  sweepTtoC,
  sweepFtoC,
  sweepRtoD,
  sweepDtoC,
  sweepPtoF: function () { return sweepPtoF({ root: ROOT, focusSet }); },
  sweepCtoR,
  sweepTtoR,
  sweepDtoR,
  sweepL1toL3,
  sweepL3toTC,
  sweepPerModelGates,
  sweepGitHeatmap,
  sweepGitHistoryEvidence,
  sweepFormalLint,
  sweepHazardModel,
  sweepHtoM,
  assembleReverseCandidates,
  proximityPreFilter,
  classifyCandidate,
  digestV8Coverage,
  crossReferenceFormalCoverage,
  persistSessionSummary,
  appendTrendEntry,
  readGateSummary,
  updateVerdicts,
  updatePredictivePower,
  checkCleanSession,
  computeScannerStats,
  recordSessionHistory,
  computeFPRates,
  applyFPTuning,
  formatFPRateTable,
};

// ── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
