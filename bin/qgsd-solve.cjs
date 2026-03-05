#!/usr/bin/env node
'use strict';
// bin/qgsd-solve.cjs
// Consistency solver orchestrator: sweeps Requirements->Formal->Tests->Code->Docs,
// computes a residual vector per layer transition, and auto-closes gaps.
//
// Layer transitions (8 forward + 3 reverse):
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
//
// Usage:
//   node bin/qgsd-solve.cjs                  # full sync, up to 3 iterations
//   node bin/qgsd-solve.cjs --report-only    # single sweep, no mutations
//   node bin/qgsd-solve.cjs --max-iterations=1
//   node bin/qgsd-solve.cjs --json           # machine-readable output
//   node bin/qgsd-solve.cjs --verbose        # pipe child stderr to parent stderr
//
// Requirements: QUICK-140

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = '[qgsd-solve]';
let ROOT = process.cwd();
const SCRIPT_DIR = __dirname;
const DEFAULT_MAX_ITERATIONS = 3;

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const reportOnly = args.includes('--report-only');
const jsonMode = args.includes('--json');
const verboseMode = args.includes('--verbose');

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
          `[qgsd-solve] WARNING: docs.${w.docKey} overlaps submodule "${w.name}" ` +
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
      else if (/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(value) && !value.includes('/')) {
        type = 'dependency';
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
  const gapCount = stats.gap_count || 0;
  const gapsList = gaps.gaps || [];

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

  return {
    residual: mismatches.length,
    detail: {
      mismatches: mismatches.map((m) => ({
        constant: m.constant,
        source: m.source,
        formal_value: m.formal_value,
        config_value: m.config_value,
      })),
    },
  };
}

/**
 * T->C: Tests to Code.
 * Returns { residual: N, detail: {...} }
 */
function sweepTtoC() {
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
    },
  };
}

/**
 * F->C: Formal verification to Code.
 * Returns { residual: N, detail: {...} }
 */
function sweepFtoC() {
  const verifyScript = path.join(SCRIPT_DIR, 'run-formal-verify.cjs');

  if (!fs.existsSync(verifyScript)) {
    return {
      residual: 0,
      detail: { skipped: true, reason: 'run-formal-verify.cjs not found' },
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
    timeout: 300000,
    stdio: ['pipe', 'ignore', 'pipe'],
  });

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
      residual: 0,
      detail: { note: 'No check-results.ndjson generated' },
    };
  }

  try {
    const lines = fs.readFileSync(checkResultsPath, 'utf8').split('\n');
    let failedCount = 0;
    let inconclusiveCount = 0;
    let totalCount = 0;
    const failures = [];
    const inconclusiveChecks = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      totalCount++;
      try {
        const entry = JSON.parse(line);
        if (entry.result === 'fail') {
          failedCount++;
          failures.push({
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
      } catch (e) {
        // skip malformed lines
      }
    }

    const existingDetail = {
      total_checks: totalCount,
      passed: Math.max(0, totalCount - failedCount - inconclusiveCount),
      failed: failedCount,
      inconclusive: inconclusiveCount,
      failures: failures,
      inconclusive_checks: inconclusiveChecks,
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
      residual: 0,
      detail: { skipped: true, reason: 'requirements.json not found' },
    };
  }

  let reqData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {
    return {
      residual: 0,
      detail: { skipped: true, reason: 'requirements.json parse error: ' + e.message },
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
      residual: 0,
      detail: { skipped: true, reason: 'no doc files found' },
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
      residual: 0,
      detail: { skipped: true, reason: 'no doc files found' },
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

  // Severity weights: user-facing broken claims count more
  const CATEGORY_WEIGHT = { user: 2, examples: 1.5, developer: 1, unknown: 1 };

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
        // Verify file exists
        const claimAbsPath = path.join(ROOT, claim.value);
        if (!fs.existsSync(claimAbsPath)) {
          isBroken = true;
          reason = 'file not found';
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
        // Verify in package.json
        if (!(claim.value in pkgDeps) && !(claim.value in pkgDevDeps)) {
          isBroken = true;
          reason = 'not in package.json';
        }
      }

      if (isBroken) {
        // Filter acknowledged false positives
        if (acknowledgedFPs.has(claim.doc_file + ':' + claim.value)) {
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
    return { residual: 0, detail: { skipped: true, reason: 'requirements.json not found' } };
  }

  let reqData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {
    return { residual: 0, detail: { skipped: true, reason: 'requirements.json parse error' } };
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

  for (const file of sourceFiles) {
    const fileName = path.basename(file);
    const fileNoExt = fileName.replace(/\.(cjs|js|mjs)$/, '');

    // Check if any requirement references this file
    if (allReqText.includes(file) || allReqText.includes(fileName) || allReqText.includes(fileNoExt)) {
      traced++;
    } else {
      untraced.push({ file });
    }
  }

  return {
    residual: untraced.length,
    detail: {
      untraced_modules: untraced,
      total_modules: sourceFiles.length,
      traced: traced,
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
    return { residual: 0, detail: { orphan_tests: [], total_tests: 0, mapped: 0 } };
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

  for (const testFile of testFiles) {
    const absPath = path.join(ROOT, testFile);

    // Check for @req annotation in file content
    let hasReqAnnotation = false;
    try {
      const content = fs.readFileSync(absPath, 'utf8');
      // Match patterns like: @req REQ-01, @req ACT-02, // req: STOP-03
      hasReqAnnotation = /@req\s+[A-Z]+-\d+/i.test(content) ||
                         /\/\/\s*req:\s*[A-Z]+-\d+/i.test(content);
    } catch (e) {
      // Can't read — treat as orphan
    }

    // Check if formal-test-sync knows about this file
    const inSyncReport = syncMappedFiles.has(testFile) || syncMappedFiles.has(absPath);

    if (hasReqAnnotation || inSyncReport) {
      mapped++;
    } else {
      orphans.push(testFile);
    }
  }

  return {
    residual: orphans.length,
    detail: {
      orphan_tests: orphans,
      total_tests: testFiles.length,
      mapped: mapped,
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
    return { residual: 0, detail: { skipped: true, reason: 'requirements.json not found' } };
  }

  let reqData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
  } catch (e) {
    return { residual: 0, detail: { skipped: true, reason: 'requirements.json parse error' } };
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
    return { residual: 0, detail: { skipped: true, reason: 'no doc files found' } };
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

  // Module and test types are more likely to be real requirements
  if (candidate.type === 'module' || candidate.type === 'test') {
    // Source modules and tests are usually genuine missing requirements
    return { category: 'A', reason: 'source ' + candidate.type + ' without requirement tracing', suggestion: 'approve' };
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
 * Assemble and deduplicate reverse traceability candidates from all 3 scanners.
 * Merges C→R, T→R, D→R results, deduplicates, filters, and respects acknowledged-not-required.json.
 * Returns { candidates: [...], total_raw, deduped, filtered, acknowledged }
 */
function assembleReverseCandidates(c_to_r, t_to_r, d_to_r) {
  const raw = [];

  // Gather C→R candidates
  if (c_to_r.residual > 0 && c_to_r.detail.untraced_modules) {
    for (const mod of c_to_r.detail.untraced_modules) {
      raw.push({
        source_scanners: ['C→R'],
        evidence: mod.file,
        file_or_claim: mod.file,
        type: 'module',
      });
    }
  }

  // Gather T→R candidates
  if (t_to_r.residual > 0 && t_to_r.detail.orphan_tests) {
    for (const testFile of t_to_r.detail.orphan_tests) {
      raw.push({
        source_scanners: ['T→R'],
        evidence: testFile,
        file_or_claim: testFile,
        type: 'test',
      });
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

  // Auto-categorize candidates into A/B/C
  for (const c of candidates) {
    const classification = classifyCandidate(c);
    c.category = classification.category;
    c.category_reason = classification.reason;
    c.suggestion = classification.suggestion;
  }

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
    category_counts: categoryCounts,
  };
}

// ── Residual computation ─────────────────────────────────────────────────────

/**
 * Computes residual vector for all layer transitions (8 forward + 3 reverse).
 * Returns residual object with forward layers + reverse discovery layers.
 */
function computeResidual() {
  const r_to_f = sweepRtoF();
  const f_to_t = sweepFtoT();
  const c_to_f = sweepCtoF();
  const t_to_c = sweepTtoC();
  const f_to_c = sweepFtoC();
  const r_to_d = sweepRtoD();
  const d_to_c = sweepDtoC();
  const p_to_f = sweepPtoF({ root: ROOT });

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
    assembled_candidates,
    total,
    reverse_discovery_total,
    timestamp: new Date().toISOString(),
  };
}

// ── Auto-close ───────────────────────────────────────────────────────────────

/**
 * Attempts to fix gaps found by the sweep.
 * Returns { actions_taken: [...], stubs_generated: N }
 */
function autoClose(residual) {
  const actions = [];

  // F->T gaps: generate test stubs
  if (residual.f_to_t.residual > 0) {
    const result = spawnTool('bin/formal-test-sync.cjs', []);
    if (result.ok) {
      actions.push(
        'Generated test stubs for ' +
          residual.f_to_t.residual +
          ' uncovered invariants'
      );
    } else {
      actions.push(
        'Could not auto-generate test stubs for ' +
          residual.f_to_t.residual +
          ' invariants (formal-test-sync.cjs failed)'
      );
    }
  }

  // C->F mismatches: log but do not auto-fix
  if (residual.c_to_f.residual > 0) {
    actions.push(
      'Cannot auto-fix ' +
        residual.c_to_f.residual +
        ' constant mismatch(es) — manual review required'
    );
  }

  // T->C failures: log but do not auto-fix
  if (residual.t_to_c.residual > 0) {
    actions.push(
      residual.t_to_c.residual + ' test failure(s) — manual fix required'
    );
  }

  // R->F gaps: log with triage info
  if (residual.r_to_f.residual > 0) {
    const triageDetail = residual.r_to_f.detail.triage;
    if (triageDetail) {
      actions.push(
        triageDetail.high + ' HIGH + ' + triageDetail.medium +
          ' MEDIUM priority requirements lack formal coverage'
      );
    } else {
      actions.push(
        residual.r_to_f.residual +
          ' requirement(s) lack formal model coverage — manual modeling required'
      );
    }
  }

  // F->C failures: log but do not auto-fix
  if (residual.f_to_c.residual > 0) {
    actions.push(
      residual.f_to_c.residual +
        ' formal verification failure(s) — manual fix required'
    );
  }

  // R->D gaps: log but do not auto-fix (manual review)
  if (residual.r_to_d.residual > 0) {
    actions.push(
      residual.r_to_d.residual +
        ' requirement(s) undocumented in developer docs — manual review required'
    );
  }

  // D->C stale claims: log but do not auto-fix (manual review)
  if (residual.d_to_c.residual > 0) {
    actions.push(
      residual.d_to_c.residual +
        ' stale structural claim(s) in docs — manual review required'
    );
  }

  // P->F divergence: dispatch parameter updates or flag investigations
  if (residual.p_to_f && residual.p_to_f.residual > 0) {
    const result = autoClosePtoF(residual.p_to_f, {
      spawnTool: spawnTool,
    });
    for (const action of result.actions_taken) {
      actions.push(action);
    }
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
 * Formats human-readable report.
 */
function formatReport(iterations, finalResidual, converged) {
  const lines = [];

  lines.push('[qgsd-solve] Consistency Solver Report');
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

  // Residual vector table
  lines.push('Layer Transition             Residual  Health');
  lines.push('─────────────────────────────────────────────');

  const rows = [
    {
      label: 'R -> F (Req->Formal)',
      residual: finalResidual.r_to_f.residual,
    },
    {
      label: 'F -> T (Formal->Test)',
      residual: finalResidual.f_to_t.residual,
    },
    {
      label: 'C -> F (Code->Formal)',
      residual: finalResidual.c_to_f.residual,
    },
    {
      label: 'T -> C (Test->Code)',
      residual: finalResidual.t_to_c.residual,
    },
    {
      label: 'F -> C (Formal->Code)',
      residual: finalResidual.f_to_c.residual,
    },
    {
      label: 'R -> D (Req->Docs)',
      residual: finalResidual.r_to_d.residual,
    },
    {
      label: 'D -> C (Docs->Code)',
      residual: finalResidual.d_to_c.residual,
    },
    {
      label: 'P -> F (Prod->Formal)',
      residual: finalResidual.p_to_f ? finalResidual.p_to_f.residual : -1,
    },
  ];

  for (const row of rows) {
    const res =
      row.residual >= 0 ? row.residual : '?';
    const health = healthIndicator(row.residual);
    const line = row.label.padEnd(28) + String(res).padStart(4) + '    ' + health;
    lines.push(line);
  }

  lines.push('─────────────────────────────────────────────');
  lines.push('Total residual:          ' + finalResidual.total);

  // Reverse traceability discovery section
  if (finalResidual.c_to_r || finalResidual.t_to_r || finalResidual.d_to_r) {
    lines.push('');
    lines.push('Reverse Traceability Discovery (human-gated):');
    lines.push('─────────────────────────────────────────────');

    const reverseRows = [
      { label: 'C -> R (Code->Req)', residual: finalResidual.c_to_r ? finalResidual.c_to_r.residual : -1 },
      { label: 'T -> R (Test->Req)', residual: finalResidual.t_to_r ? finalResidual.t_to_r.residual : -1 },
      { label: 'D -> R (Docs->Req)', residual: finalResidual.d_to_r ? finalResidual.d_to_r.residual : -1 },
    ];

    for (const row of reverseRows) {
      const res = row.residual >= 0 ? row.residual : '?';
      const health = healthIndicator(row.residual);
      const line = row.label.padEnd(28) + String(res).padStart(4) + '    ' + health;
      lines.push(line);
    }

    const rdTotal = finalResidual.reverse_discovery_total || 0;
    lines.push('─────────────────────────────────────────────');
    lines.push('Discovery total:         ' + rdTotal);

    if (finalResidual.assembled_candidates && finalResidual.assembled_candidates.candidates.length > 0) {
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
  }
  lines.push('');

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

  if (finalResidual.f_to_c.residual > 0 || (finalResidual.f_to_c.detail && finalResidual.f_to_c.detail.inconclusive > 0)) {
    lines.push('## F -> C (Formal -> Code)');
    const detail = finalResidual.f_to_c.detail;
    const parts = [];
    if (detail.passed > 0) parts.push(detail.passed + ' pass');
    if (detail.failed > 0) parts.push(detail.failed + ' fail');
    if (detail.inconclusive > 0) parts.push(detail.inconclusive + ' inconclusive');
    lines.push('Checks: ' + parts.join(', ') + ' (of ' + detail.total_checks + ' total)');
    if (detail.failures && detail.failures.length > 0) {
      lines.push('');
      lines.push('Failures:');
      for (const fail of detail.failures) {
        const f = typeof fail === 'string' ? { check_id: fail, summary: '' } : fail;
        lines.push('  ✗ ' + f.check_id + (f.summary ? ' — ' + f.summary : ''));
        if (f.requirement_ids && f.requirement_ids.length > 0) {
          lines.push('    reqs: ' + f.requirement_ids.join(', '));
        }
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
  for (const key of ['r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c', 'r_to_d', 'd_to_c', 'p_to_f', 'c_to_r', 't_to_r', 'd_to_r']) {
    const res = finalResidual[key] ? finalResidual[key].residual : -1;
    health[key] = healthIndicator(res).split(/\s+/)[1]; // Extract GREEN/YELLOW/RED/UNKNOWN
  }

  const truncatedResidual = truncateResidualDetail(finalResidual);

  return {
    solver_version: '1.2',
    generated_at: new Date().toISOString(),
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
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Step 0: Bootstrap formal infrastructure
  preflight();

  const iterations = [];
  let converged = false;
  let prevTotal = null;

  for (let i = 1; i <= maxIterations; i++) {
    process.stderr.write(TAG + ' Iteration ' + i + '/' + maxIterations + '\n');

    // Clear formal-test-sync cache so computeResidual() sees fresh data after autoClose() mutations
    formalTestSyncCache = null;

    const residual = computeResidual();
    const actions = [];
    iterations.push({ iteration: i, residual: residual, actions: actions });

    // Check convergence: total residual unchanged from previous iteration
    if (prevTotal !== null && residual.total === prevTotal) {
      converged = true;
      process.stderr.write(
        TAG +
          ' Converged at iteration ' +
          i +
          ' (residual stable at ' +
          residual.total +
          ')\n'
      );
      break;
    }

    // Check if already at zero
    if (residual.total === 0) {
      converged = true;
      process.stderr.write(TAG + ' All layers clean — residual is 0\n');
      break;
    }

    // Auto-close if not report-only and not last iteration
    if (!reportOnly) {
      const closeResult = autoClose(residual);
      iterations[iterations.length - 1].actions = closeResult.actions_taken;
    } else {
      break; // report-only = single sweep, no loop
    }

    prevTotal = residual.total;
  }

  const finalResidual = iterations[iterations.length - 1].residual;

  // Write solver state persistence
  const solveState = {
    last_run: new Date().toISOString(),
    converged: converged,
    iteration_count: iterations.length,
    final_residual_total: finalResidual.total,
    reverse_discovery_total: finalResidual.reverse_discovery_total || 0,
    known_issues: [],
    r_to_f_progress: {
      total: finalResidual.r_to_f.detail.total || 0,
      covered: finalResidual.r_to_f.detail.covered || 0,
      percentage: finalResidual.r_to_f.detail.percentage || 0,
    },
  };
  // Collect known issues from non-zero non-error layers
  for (const [key, val] of Object.entries(finalResidual)) {
    if (val && typeof val === 'object' && val.residual > 0) {
      solveState.known_issues.push({ layer: key, residual: val.residual });
    }
  }
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

  if (jsonMode) {
    process.stdout.write(
      JSON.stringify(formatJSON(iterations, finalResidual, converged), null, 2) +
        '\n'
    );
  } else {
    process.stdout.write(formatReport(iterations, finalResidual, converged));
  }

  // Exit with non-zero if residual > 0 (signals gaps remain)
  process.exit(finalResidual.total > 0 ? 1 : 0);
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
  sweepRtoD,
  sweepDtoC,
  sweepTtoC,
  sweepCtoR,
  sweepTtoR,
  sweepDtoR,
  assembleReverseCandidates,
  classifyCandidate,
};

// ── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
