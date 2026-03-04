#!/usr/bin/env node
'use strict';
// bin/qgsd-solve.cjs
// Consistency solver orchestrator: sweeps Requirements->Formal->Tests->Code->Docs,
// computes a residual vector per layer transition, and auto-closes gaps.
//
// Layer transitions (7):
//   R->F: Requirements without formal model coverage
//   F->T: Formal invariants without test backing
//   C->F: Code constants diverging from formal specs
//   T->C: Failing unit tests
//   F->C: Failing formal verification checks
//   R->D: Requirements not documented in developer docs
//   D->C: Stale structural claims in docs (dead file paths, missing CLI commands, absent dependencies)
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
  const spawnOpts = {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: opts.timeout || 120000,
    stdio: verboseMode ? ['pipe', 'pipe', 'inherit'] : 'pipe',
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
 * Discover documentation files based on:
 *   1. .planning/polyrepo.json docs field (preferred — knows user vs developer vs examples)
 *   2. .planning/config.json docs_paths (legacy)
 *   3. Fallback patterns: README.md, docs/**/*.md
 * Returns array of absolute paths.
 */
function discoverDocFiles() {
  let docPatterns = ['README.md', 'docs/**/*.md'];

  // Prefer polyrepo marker docs field
  const markerPath = path.join(ROOT, '.planning', 'polyrepo.json');
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (marker.docs && typeof marker.docs === 'object') {
      const patterns = [];
      for (const [, docPath] of Object.entries(marker.docs)) {
        if (typeof docPath !== 'string') continue;
        // If it ends with / treat as directory glob, otherwise treat as literal file
        if (docPath.endsWith('/')) {
          patterns.push(docPath + '**/*.md');
        } else {
          patterns.push(docPath);
        }
      }
      if (patterns.length > 0) {
        // Always include README.md at root
        patterns.unshift('README.md');
        docPatterns = patterns;
      }
    }
  } catch (e) {
    // No marker or malformed — fall through to config.json
  }

  // Fall back to config.json docs_paths if marker didn't provide patterns
  if (docPatterns[0] === 'README.md' && docPatterns.length === 2 && docPatterns[1] === 'docs/**/*.md') {
    const configPath = path.join(ROOT, '.planning', 'config.json');
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Array.isArray(configData.docs_paths) && configData.docs_paths.length > 0) {
        docPatterns = configData.docs_paths;
      }
    } catch (e) {
      // Use defaults
    }
  }

  const found = new Set();

  for (const pattern of docPatterns) {
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
          found.add(f);
        }
      }
    } else {
      const fullPath = path.join(ROOT, pattern);
      if (fs.existsSync(fullPath)) {
        found.add(fullPath);
      }
    }
  }

  return Array.from(found);
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

// ── Layer transition sweeps ──────────────────────────────────────────────────

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

    return {
      residual: uncovered.length,
      detail: {
        uncovered_requirements: uncovered,
        total: total,
        covered: covered,
        percentage: percentage,
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
  const spawnOpts = {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 120000,
    stdio: verboseMode ? ['pipe', 'pipe', 'inherit'] : 'pipe',
  };

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
  // Look for lines like: "# tests N" and "# fail M"
  let totalTests = 0;
  let failCount = 0;

  const testsMatch = output.match(/^#\s+tests\s+(\d+)/m);
  if (testsMatch) totalTests = parseInt(testsMatch[1], 10);

  const failMatch = output.match(/^#\s+fail\s+(\d+)/m);
  if (failMatch) failCount = parseInt(failMatch[1], 10);

  // Fallback: count "not ok" lines if summary not found
  if (failCount === 0 && totalTests === 0) {
    const notOkMatches = output.match(/^not ok\s+\d+/gm) || [];
    failCount = notOkMatches.length;
    const okMatches = output.match(/^ok\s+\d+/gm) || [];
    totalTests = notOkMatches.length + okMatches.length;
  }

  return {
    residual: failCount,
    detail: {
      total_tests: totalTests,
      passed: Math.max(0, totalTests - failCount),
      failed: failCount,
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

  // In report-only mode, read stale check results without re-running
  if (reportOnly) {
    const checkResultsPath = path.join(ROOT, '.formal', 'check-results.ndjson');
    if (!fs.existsSync(checkResultsPath)) {
      return {
        residual: 0,
        detail: { skipped: true, reason: 'check-results.ndjson not found', stale: true },
      };
    }

    try {
      const lines = fs.readFileSync(checkResultsPath, 'utf8').split('\n');
      let failedCount = 0;
      let inconclusiveCount = 0;
      let totalCount = 0;
      const failures = [];
      const inconclusive = [];

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
            inconclusive.push({
              check_id: entry.check_id || entry.id || '?',
              summary: entry.summary || '',
            });
          }
        } catch (e) {
          // skip malformed lines
        }
      }

      return {
        residual: failedCount,
        detail: {
          total_checks: totalCount,
          passed: Math.max(0, totalCount - failedCount - inconclusiveCount),
          failed: failedCount,
          inconclusive: inconclusiveCount,
          failures: failures,
          inconclusive_checks: inconclusive,
          stale: true,
        },
      };
    } catch (err) {
      return {
        residual: -1,
        detail: { error: 'Failed to read check-results.ndjson: ' + err.message },
      };
    }
  }

  // Full run (mutating, expensive)
  const result = spawnTool('bin/run-formal-verify.cjs', [], {
    timeout: 300000,
  });

  if (!result.ok) {
    return {
      residual: -1,
      detail: { error: result.stderr || 'run-formal-verify.cjs failed' },
    };
  }

  // Parse .formal/check-results.ndjson
  const checkResultsPath = path.join(ROOT, '.formal', 'check-results.ndjson');

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

    return {
      residual: failedCount,
      detail: {
        total_checks: totalCount,
        passed: Math.max(0, totalCount - failedCount - inconclusiveCount),
        failed: failedCount,
        inconclusive: inconclusiveCount,
        failures: failures,
        inconclusive_checks: inconclusiveChecks,
      },
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
  const reqPath = path.join(ROOT, '.formal', 'requirements.json');
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
  const docFiles = discoverDocFiles();
  if (docFiles.length === 0) {
    return {
      residual: 0,
      detail: { skipped: true, reason: 'no doc files found' },
    };
  }

  // Concatenate all doc content
  let allDocContent = '';
  for (const docFile of docFiles) {
    try {
      allDocContent += fs.readFileSync(docFile, 'utf8') + '\n';
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

  const brokenClaims = [];
  let totalClaimsChecked = 0;

  for (const docFile of docFiles) {
    let content;
    try {
      content = fs.readFileSync(docFile, 'utf8');
    } catch (e) {
      continue;
    }

    const relativePath = path.relative(ROOT, docFile).replace(/\\/g, '/');
    const claims = extractStructuralClaims(content, relativePath);

    for (const claim of claims) {
      totalClaimsChecked++;

      let isBroken = false;
      let reason = '';

      if (claim.type === 'file_path') {
        // Verify file exists
        const absPath = path.join(ROOT, claim.value);
        if (!fs.existsSync(absPath)) {
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
        brokenClaims.push({
          doc_file: claim.doc_file,
          line: claim.line,
          type: claim.type,
          value: claim.value,
          reason: reason,
        });
      }
    }
  }

  return {
    residual: brokenClaims.length,
    detail: {
      broken_claims: brokenClaims,
      total_claims_checked: totalClaimsChecked,
      doc_files_scanned: docFiles.length,
    },
  };
}

// ── Residual computation ─────────────────────────────────────────────────────

/**
 * Computes residual vector for all 7 layer transitions.
 * Returns residual object with r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, r_to_d, d_to_c.
 */
function computeResidual() {
  const r_to_f = sweepRtoF();
  const f_to_t = sweepFtoT();
  const c_to_f = sweepCtoF();
  const t_to_c = sweepTtoC();
  const f_to_c = sweepFtoC();
  const r_to_d = sweepRtoD();
  const d_to_c = sweepDtoC();

  const total =
    (r_to_f.residual >= 0 ? r_to_f.residual : 0) +
    (f_to_t.residual >= 0 ? f_to_t.residual : 0) +
    (c_to_f.residual >= 0 ? c_to_f.residual : 0) +
    (t_to_c.residual >= 0 ? t_to_c.residual : 0) +
    (f_to_c.residual >= 0 ? f_to_c.residual : 0) +
    (r_to_d.residual >= 0 ? r_to_d.residual : 0) +
    (d_to_c.residual >= 0 ? d_to_c.residual : 0);

  return {
    r_to_f,
    f_to_t,
    c_to_f,
    t_to_c,
    f_to_c,
    r_to_d,
    d_to_c,
    total,
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

  // R->F gaps: log but do not auto-fix
  if (residual.r_to_f.residual > 0) {
    actions.push(
      residual.r_to_f.residual +
        ' requirement(s) lack formal model coverage — manual modeling required'
    );
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
    lines.push(
      'Failed tests: ' +
        detail.failed +
        ' / ' +
        detail.total_tests
    );
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
  for (const key of ['r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c', 'r_to_d', 'd_to_c']) {
    const res = finalResidual[key].residual;
    health[key] = healthIndicator(res).split(/\s+/)[1]; // Extract GREEN/YELLOW/RED/UNKNOWN
  }

  const truncatedResidual = truncateResidualDetail(finalResidual);

  return {
    solver_version: '1.1',
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
  discoverDocFiles,
  extractKeywords,
  extractStructuralClaims,
  sweepRtoD,
  sweepDtoC,
};

// ── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
