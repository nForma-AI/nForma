#!/usr/bin/env node
'use strict';
// bin/nf-solve.test.cjs
// TDD test suite for bin/nf-solve.cjs
// Uses node:test + node:assert/strict
//
// Test categories:
// - TC-HEALTH: healthIndicator() tests
// - TC-FORMAT: formatReport() tests
// - TC-JSON: formatJSON() tests
// - TC-INT: Integration tests (full script)
// - TC-CONV: Convergence logic tests
// - TC-KEYWORD: extractKeywords() tests
// - TC-CLAIMS: extractStructuralClaims() tests
// - TC-SWEEP-RD: sweepRtoD() tests
// - TC-SWEEP-DC: sweepDtoC() tests

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

// Import functions from nf-solve.cjs
const {
  healthIndicator,
  formatReport,
  formatJSON,
  discoverDocFiles,
  extractKeywords,
  extractStructuralClaims,
  sweepRtoD,
  sweepDtoC,
  sweepTtoC,
  crossReferenceFormalCoverage,
} = require('./nf-solve.cjs');

const ROOT = path.resolve(__dirname, '..');

// ── TC-HEALTH: Health Indicator Tests ────────────────────────────────────────

test('TC-HEALTH-1: healthIndicator(-1) returns UNKNOWN', () => {
  const result = healthIndicator(-1);
  assert.ok(result.includes('UNKNOWN'));
});

test('TC-HEALTH-2: healthIndicator(0) returns GREEN', () => {
  const result = healthIndicator(0);
  assert.ok(result.includes('GREEN'));
});

test('TC-HEALTH-3: healthIndicator(2) returns YELLOW', () => {
  const result = healthIndicator(2);
  assert.ok(result.includes('YELLOW'));
});

test('TC-HEALTH-4: healthIndicator(5) returns RED', () => {
  const result = healthIndicator(5);
  assert.ok(result.includes('RED'));
});

// ── TC-FORMAT: Report Formatting Tests ───────────────────────────────────────

test('TC-FORMAT-1: formatReport with converged=true, total=0', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, true);

  assert.ok(result.includes('converged'));
  assert.ok(result.includes('GREEN'));
});

test('TC-FORMAT-2: formatReport with converged=false, total=5', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 2, detail: { uncovered_requirements: ['REQ-001', 'REQ-002'] } },
        f_to_t: { residual: 1, detail: { gaps: ['REQ-003'] } },
        c_to_f: { residual: 1, detail: { mismatches: [] } },
        t_to_c: { residual: 1, detail: { failed: 1, skipped: 0, todo: 0, total_tests: 10 } },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 5,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, false);

  assert.ok(result.includes('RED') || result.includes('YELLOW'));
});

test('TC-FORMAT-3: formatReport includes layer transition table', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, true);

  assert.ok(result.includes('Layer Transition'));
  assert.ok(result.includes('R -> F'));
  assert.ok(result.includes('F -> T'));
  assert.ok(result.includes('C -> F'));
  assert.ok(result.includes('T -> C'));
  assert.ok(result.includes('F -> C'));
});

test('TC-FORMAT-4: formatReport includes R -> D and D -> C labels', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatReport(iterations, finalResidual, true);

  assert.ok(result.includes('R -> D'));
  assert.ok(result.includes('D -> C'));
});

// ── TC-JSON: JSON Formatting Tests ───────────────────────────────────────────

test('TC-JSON-1: formatJSON returns object with required keys', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.ok(typeof result === 'object');
  assert.ok(result.solver_version);
  assert.ok(result.generated_at);
  assert.ok(typeof result.iteration_count === 'number');
  assert.ok(typeof result.converged === 'boolean');
  assert.ok(result.residual_vector);
  assert.ok(result.health);
});

test('TC-JSON-2: formatJSON with all zero residuals has GREEN health', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.equal(result.converged, true);
  assert.equal(result.health.r_to_f, 'GREEN');
  assert.equal(result.health.f_to_t, 'GREEN');
  assert.equal(result.health.c_to_f, 'GREEN');
  assert.equal(result.health.t_to_c, 'GREEN');
  assert.equal(result.health.f_to_c, 'GREEN');
  assert.equal(result.health.r_to_d, 'GREEN');
  assert.equal(result.health.d_to_c, 'GREEN');
});

test('TC-JSON-3: formatJSON includes iterations array', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: ['action 1'],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.ok(Array.isArray(result.iterations));
  assert.equal(result.iterations.length, 1);
  assert.equal(result.iterations[0].iteration, 1);
  assert.ok(Array.isArray(result.iterations[0].actions));
});

test('TC-JSON-4: formatJSON includes r_to_d and d_to_c health keys', () => {
  const iterations = [
    {
      iteration: 1,
      residual: {
        r_to_f: { residual: 0, detail: {} },
        f_to_t: { residual: 0, detail: {} },
        c_to_f: { residual: 0, detail: {} },
        t_to_c: { residual: 0, detail: {} },
        f_to_c: { residual: 0, detail: {} },
        r_to_d: { residual: 0, detail: {} },
        d_to_c: { residual: 0, detail: {} },
        total: 0,
        timestamp: '2026-03-03T00:00:00Z',
      },
      actions: [],
    },
  ];
  const finalResidual = iterations[0].residual;
  const result = formatJSON(iterations, finalResidual, true);

  assert.ok(result.health.r_to_d !== undefined, 'health should have r_to_d key');
  assert.ok(result.health.d_to_c !== undefined, 'health should have d_to_c key');
  assert.equal(result.solver_version, '1.1');
});

// ── TC-KEYWORD: Keyword Extraction Tests ─────────────────────────────────────

test('TC-KEYWORD-1: extractKeywords strips stopwords and short tokens', () => {
  const result = extractKeywords('the quick brown fox jumps over this lazy dog');
  assert.ok(!result.includes('the'));  // stopword
  assert.ok(!result.includes('fox'));  // < 4 chars
  assert.ok(!result.includes('dog'));  // < 4 chars
  assert.ok(result.includes('quick'));
  assert.ok(result.includes('brown'));
  assert.ok(result.includes('jumps'));
  assert.ok(result.includes('lazy'));
});

test('TC-KEYWORD-2: extractKeywords ignores backtick-wrapped fragments', () => {
  const result = extractKeywords('uses `spawnSync` for spawning child processes');
  assert.ok(!result.includes('spawnsync'));
  assert.ok(result.includes('spawning'));
  assert.ok(result.includes('child'));
  assert.ok(result.includes('processes'));
});

// ── TC-CLAIMS: Structural Claims Tests ───────────────────────────────────────

test('TC-CLAIMS-1: extractStructuralClaims finds file paths in backticks', () => {
  const doc = 'See `bin/nf-solve.cjs` for details.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(claims.some(c => c.type === 'file_path' && c.value === 'bin/nf-solve.cjs'));
});

test('TC-CLAIMS-2: extractStructuralClaims skips fenced code blocks', () => {
  const doc = 'text\n```\n`bin/fake-file.cjs`\n```\nmore text';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value === 'bin/fake-file.cjs'));
});

test('TC-CLAIMS-3: extractStructuralClaims skips template variables', () => {
  const doc = 'Path: `.planning/phases/{phase}/{plan}-PLAN.md`';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value.includes('{phase}')));
});

test('TC-CLAIMS-4: extractStructuralClaims skips paths under Example headings', () => {
  const doc = '## Example Usage\n\nSee `bin/imaginary.cjs` for reference.\n\n## Real Section\n\nSee `bin/nf-solve.cjs` here.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value === 'bin/imaginary.cjs'));
  // Real section claims should still be collected
  assert.ok(claims.some(c => c.value === 'bin/nf-solve.cjs'));
});

test('TC-CLAIMS-5: extractStructuralClaims identifies CLI commands', () => {
  const doc = 'Run `node bin/nf-solve.cjs --report-only` to check.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(claims.some(c => c.type === 'cli_command'));
});

test('TC-CLAIMS-6: extractStructuralClaims skips home directory paths', () => {
  const doc = 'Installed at `~/.claude/hooks/` by default.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value.includes('~/')));
});

// ── TC-SWEEP-RD: sweepRtoD Tests ────────────────────────────────────────────

test('TC-SWEEP-RD-1: sweepRtoD returns valid structure', () => {
  const result = sweepRtoD();
  assert.ok(typeof result === 'object');
  assert.ok(typeof result.residual === 'number');
  assert.ok(typeof result.detail === 'object');
  // If skipped, should still be residual: 0
  if (result.detail.skipped) {
    assert.equal(result.residual, 0);
  }
});

// ── TC-SWEEP-DC: sweepDtoC Tests ────────────────────────────────────────────

test('TC-SWEEP-DC-1: sweepDtoC returns valid structure', () => {
  const result = sweepDtoC();
  assert.ok(typeof result === 'object');
  assert.ok(typeof result.residual === 'number');
  assert.ok(typeof result.detail === 'object');
  if (result.detail.skipped) {
    assert.equal(result.residual, 0);
  }
});

// ── TC-TAP-PARSE: TAP Format Parsing Tests ──────────────────────────────────

test('TC-TAP-PARSE-1: dual-format regex matches i prefix (Node v25)', () => {
  const output = 'ℹ tests 42\nℹ pass 40\nℹ fail 1\nℹ skipped 1\nℹ todo 0\nℹ duration_ms 123';
  const testsMatch = output.match(/^[ℹ#]\s+tests\s+(\d+)/m);
  const failMatch = output.match(/^[ℹ#]\s+fail\s+(\d+)/m);
  const skipMatch = output.match(/^[ℹ#]\s+skipped\s+(\d+)/m);
  assert.ok(testsMatch, 'should match ℹ prefix for tests');
  assert.equal(testsMatch[1], '42');
  assert.ok(failMatch, 'should match ℹ prefix for fail');
  assert.equal(failMatch[1], '1');
  assert.ok(skipMatch, 'should match ℹ prefix for skipped');
  assert.equal(skipMatch[1], '1');
});

test('TC-TAP-PARSE-2: dual-format regex matches # prefix (Node <= v24)', () => {
  const output = '# tests 10\n# pass 8\n# fail 2\n# skipped 0\n# todo 0';
  const testsMatch = output.match(/^[ℹ#]\s+tests\s+(\d+)/m);
  const failMatch = output.match(/^[ℹ#]\s+fail\s+(\d+)/m);
  assert.ok(testsMatch);
  assert.equal(testsMatch[1], '10');
  assert.ok(failMatch);
  assert.equal(failMatch[1], '2');
});

test('TC-TAP-PARSE-3: skip and todo counts extracted', () => {
  const output = 'ℹ tests 20\nℹ fail 1\nℹ skipped 3\nℹ todo 2';
  const skipMatch = output.match(/^[ℹ#]\s+skipped\s+(\d+)/m);
  const todoMatch = output.match(/^[ℹ#]\s+todo\s+(\d+)/m);
  assert.ok(skipMatch);
  assert.equal(parseInt(skipMatch[1], 10), 3);
  assert.ok(todoMatch);
  assert.equal(parseInt(todoMatch[1], 10), 2);
});

test('TC-RESIDUAL-SKIP-1: sweepTtoC residual includes skipped count', () => {
  // Integration test: run actual tests and verify detail shape
  const result = sweepTtoC();
  assert.ok(typeof result === 'object');
  assert.ok(typeof result.residual === 'number');
  assert.ok(typeof result.detail === 'object');
  assert.ok('skipped' in result.detail, 'detail must include skipped field');
  assert.ok('todo' in result.detail, 'detail must include todo field');
  assert.ok('failed' in result.detail, 'detail must include failed field');
  // residual should equal failed + skipped
  assert.equal(result.residual, result.detail.failed + result.detail.skipped);
});

// ── TC-INT: Integration Tests ────────────────────────────────────────────────

test('TC-INT-1: node bin/nf-solve.cjs --json --report-only exits with valid JSON', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--json',
    '--report-only',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  // Either exit 0 or 1 is acceptable (depends on project state)
  assert.ok(result.status === 0 || result.status === 1);

  // stdout should be valid JSON
  const output = result.stdout.trim();
  assert.ok(output.length > 0);

  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (err) {
    assert.fail('stdout is not valid JSON: ' + err.message);
  }

  assert.ok(parsed.residual_vector);
  assert.ok(typeof parsed.converged === 'boolean');
  assert.ok(typeof parsed.iteration_count === 'number');
});

test('TC-INT-2: node bin/nf-solve.cjs --report-only produces human-readable output', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--report-only',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  // Either exit 0 or 1 is acceptable
  assert.ok(result.status === 0 || result.status === 1);

  const output = result.stdout;
  // Should contain markers of human-readable format
  assert.ok(
    output.includes('nf-solve') ||
    output.includes('Layer Transition') ||
    output.includes('Residual')
  );
});

test('TC-INT-3: node bin/nf-solve.cjs --report-only --max-iterations=1 iterations count', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--json',
    '--report-only',
    '--max-iterations=1',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  assert.ok(result.status === 0 || result.status === 1);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.iteration_count, 1);
  } catch (err) {
    assert.fail('Failed to parse JSON: ' + err.message);
  }
});

test('TC-INT-4: node bin/nf-solve.cjs --json --report-only --verbose exits without crash', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--json',
    '--report-only',
    '--verbose',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  // Should not crash
  assert.ok(result.status === 0 || result.status === 1);

  // stdout should still be valid JSON even with --verbose
  try {
    JSON.parse(result.stdout.trim());
  } catch (err) {
    assert.fail('stdout is not valid JSON with --verbose: ' + err.message);
  }
});

// ── TC-CONV: Convergence Logic Tests ─────────────────────────────────────────

test('TC-CONV-1: --report-only mode does single iteration (iteration_count === 1)', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--json',
    '--report-only',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  assert.ok(result.status === 0 || result.status === 1);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.iteration_count, 1, '--report-only should do exactly 1 iteration');
  } catch (err) {
    assert.fail('Failed to parse JSON: ' + err.message);
  }
});

test('TC-CONV-2: --max-iterations limits iterations', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--json',
    '--report-only',
    '--max-iterations=2',
  ], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });

  assert.ok(result.status === 0 || result.status === 1);

  try {
    const parsed = JSON.parse(result.stdout.trim());
    // --report-only stops after 1 iteration regardless, so this should still be 1
    assert.ok(parsed.iteration_count <= 2);
  } catch (err) {
    assert.fail('Failed to parse JSON: ' + err.message);
  }
});

// ── TC-INT: Integration Tests ─────────────────────────────────────────────────

test('TC-INT: --project-root overrides CWD for diagnostic sweep', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'bin', 'nf-solve.cjs'),
    '--json',
    '--report-only',
    '--project-root=' + ROOT,
  ], {
    encoding: 'utf8',
    cwd: '/tmp',
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.residual_vector, 'Should have residual_vector');
  assert.equal(typeof parsed.residual_vector.total, 'number');
});

// ── TC-COV: crossReferenceFormalCoverage Tests ────────────────────────────────

test('TC-COV-1: crossReferenceFormalCoverage returns unavailable when null input', () => {
  const result = crossReferenceFormalCoverage(null);
  assert.deepStrictEqual(result, { available: false });
});

test('TC-COV-2: crossReferenceFormalCoverage returns unavailable when undefined input', () => {
  const result = crossReferenceFormalCoverage(undefined);
  assert.deepStrictEqual(result, { available: false });
});

test('TC-COV-3: crossReferenceFormalCoverage returns available with empty coverage array', () => {
  const result = crossReferenceFormalCoverage([]);
  assert.equal(result.available, true);
  assert.ok(Array.isArray(result.false_greens), 'false_greens should be an array');
  assert.ok(result.summary, 'should have summary object');
  assert.equal(typeof result.summary.fully_covered, 'number');
  assert.equal(typeof result.summary.partially_covered, 'number');
  assert.equal(typeof result.summary.uncovered, 'number');
});

test('TC-COV-4: crossReferenceFormalCoverage parses V8 coverage format and returns available', () => {
  const coverageArray = [{
    result: [{
      url: 'file:///some/other/file.js',
      functions: [{
        ranges: [{ startOffset: 0, endOffset: 100, count: 1 }],
      }],
    }],
  }];
  const result = crossReferenceFormalCoverage(coverageArray);
  assert.equal(result.available, true);
  assert.ok(result.summary, 'should have summary object');
  assert.equal(typeof result.summary.fully_covered, 'number');
  assert.equal(typeof result.summary.partially_covered, 'number');
  assert.equal(typeof result.summary.uncovered, 'number');
  assert.equal(typeof result.total_properties, 'number');
});

test('TC-COV-5: sweepTtoC detail contains v8_coverage field', () => {
  const result = sweepTtoC();
  assert.ok(result.detail, 'sweepTtoC should return detail');
  assert.ok('v8_coverage' in result.detail, 'detail should have v8_coverage key');
});
