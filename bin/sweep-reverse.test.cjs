#!/usr/bin/env node
'use strict';
// bin/sweep-reverse.test.cjs
// Tests for reverse traceability scanners (C→R, T→R, D→R) and assembleReverseCandidates.

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  sweepCtoR,
  sweepTtoR,
  sweepDtoR,
  assembleReverseCandidates,
  computeResidual,
  formatJSON,
} = require('./nf-solve.cjs');

// ── sweepCtoR ────────────────────────────────────────────────────────────────

describe('sweepCtoR', () => {
  it('returns function type', () => {
    assert.equal(typeof sweepCtoR, 'function');
  });

  it('returns residual object with expected shape', () => {
    const result = sweepCtoR();
    assert.equal(typeof result.residual, 'number');
    assert.ok(result.detail !== undefined);
    // Should have either untraced_modules array or skipped flag
    if (!result.detail.skipped) {
      assert.ok(Array.isArray(result.detail.untraced_modules));
      assert.equal(typeof result.detail.total_modules, 'number');
      assert.equal(typeof result.detail.traced, 'number');
    }
  });

  it('residual equals untraced_modules length', () => {
    const result = sweepCtoR();
    if (!result.detail.skipped) {
      assert.equal(result.residual, result.detail.untraced_modules.length);
    }
  });

  it('total_modules = traced + untraced', () => {
    const result = sweepCtoR();
    if (!result.detail.skipped) {
      assert.equal(
        result.detail.total_modules,
        result.detail.traced + result.detail.untraced_modules.length
      );
    }
  });

  it('excludes test files from scan', () => {
    const result = sweepCtoR();
    if (!result.detail.skipped && result.detail.untraced_modules.length > 0) {
      for (const mod of result.detail.untraced_modules) {
        assert.ok(!mod.file.includes('.test.'), 'Test file should not appear in C→R: ' + mod.file);
      }
    }
  });

  it('traces files with Requirements: header comment', () => {
    const result = sweepCtoR();
    if (!result.detail.skipped) {
      const found = result.detail.untraced_modules.find(
        m => m.file.includes('formalization-candidates')
      );
      assert.equal(found, undefined,
        'formalization-candidates.cjs should be traced via header comment');
    }
  });

  it('header-traced files contribute to traced count', () => {
    const result = sweepCtoR();
    if (!result.detail.skipped) {
      assert.ok(result.detail.traced > 0, 'traced count should be > 0');
      // Scan bin/*.cjs for files with Requirements: headers
      const binDir = path.join(process.cwd(), 'bin');
      const entries = fs.readdirSync(binDir).filter(f => f.endsWith('.cjs') && !f.includes('.test.'));
      const headerFiles = [];
      for (const f of entries) {
        try {
          const head = fs.readFileSync(path.join(binDir, f), 'utf8').split('\n').slice(0, 30).join('\n');
          if (/(?:\/\/|\/?\*)\s*Requirements:\s*(.+)/.test(head)) {
            headerFiles.push('bin/' + f);
          }
        } catch (e) { /* skip */ }
      }
      // None of the header-declaring files should be untraced
      const untracedFiles = result.detail.untraced_modules.map(m => m.file);
      for (const hf of headerFiles) {
        assert.ok(!untracedFiles.includes(hf),
          hf + ' has Requirements: header but is still untraced');
      }
    }
  });

  it('traced + untraced still equals total_modules after header parsing', () => {
    const result = sweepCtoR();
    if (!result.detail.skipped) {
      assert.equal(
        result.detail.total_modules,
        result.detail.traced + result.detail.untraced_modules.length,
        'traced + untraced must equal total_modules'
      );
    }
  });

  it('header parsing works on a known temp file', () => {
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'sweep-header-test-' + Date.now() + '.cjs');
    try {
      fs.writeFileSync(tmpFile, [
        '#!/usr/bin/env node',
        "'use strict';",
        '// Requirements: GATE-01, GATE-02',
        '',
        'module.exports = {};',
      ].join('\n'));

      // Replicate the header-parsing logic from sweepCtoR
      const head = fs.readFileSync(tmpFile, 'utf8').split('\n').slice(0, 30).join('\n');
      const match = head.match(/(?:\/\/|\/?\*)\s*Requirements:\s*(.+)/);
      assert.ok(match, 'Should match Requirements: header');
      const declaredIds = match[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      assert.deepEqual(declaredIds, ['GATE-01', 'GATE-02']);

      // Verify against a mock reqIdSet
      const mockReqIdSet = new Set(['GATE-01', 'GATE-03']);
      const traced = declaredIds.some(id => mockReqIdSet.has(id));
      assert.ok(traced, 'Should be traced when at least one ID matches');

      // Verify non-matching set
      const emptySet = new Set(['NONEXISTENT-99']);
      const notTraced = declaredIds.some(id => emptySet.has(id));
      assert.ok(!notTraced, 'Should NOT be traced when no IDs match');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (e) { /* cleanup */ }
    }
  });
});

// ── sweepTtoR ────────────────────────────────────────────────────────────────

describe('sweepTtoR', () => {
  it('returns function type', () => {
    assert.equal(typeof sweepTtoR, 'function');
  });

  it('returns residual object with expected shape', () => {
    const result = sweepTtoR();
    assert.equal(typeof result.residual, 'number');
    assert.ok(result.detail !== undefined);
    assert.ok(Array.isArray(result.detail.orphan_tests));
    assert.equal(typeof result.detail.total_tests, 'number');
    assert.equal(typeof result.detail.mapped, 'number');
  });

  it('residual equals orphan_tests length', () => {
    const result = sweepTtoR();
    assert.equal(result.residual, result.detail.orphan_tests.length);
  });

  it('total_tests = mapped + orphans', () => {
    const result = sweepTtoR();
    assert.equal(
      result.detail.total_tests,
      result.detail.mapped + result.detail.orphan_tests.length
    );
  });

  it('orphan test paths end with .test.cjs or .test.js', () => {
    const result = sweepTtoR();
    for (const t of result.detail.orphan_tests) {
      assert.ok(
        t.endsWith('.test.cjs') || t.endsWith('.test.js'),
        'Orphan test should be a test file: ' + t
      );
    }
  });
});

// ── sweepDtoR ────────────────────────────────────────────────────────────────

describe('sweepDtoR', () => {
  it('returns function type', () => {
    assert.equal(typeof sweepDtoR, 'function');
  });

  it('returns residual object with expected shape', () => {
    const result = sweepDtoR();
    assert.equal(typeof result.residual, 'number');
    assert.ok(result.detail !== undefined);
    if (!result.detail.skipped) {
      assert.ok(Array.isArray(result.detail.unbacked_claims));
      assert.equal(typeof result.detail.total_claims, 'number');
      assert.equal(typeof result.detail.backed, 'number');
    }
  });

  it('residual equals unbacked_claims length', () => {
    const result = sweepDtoR();
    if (!result.detail.skipped) {
      assert.equal(result.residual, result.detail.unbacked_claims.length);
    }
  });

  it('each unbacked claim has required fields', () => {
    const result = sweepDtoR();
    if (!result.detail.skipped && result.detail.unbacked_claims.length > 0) {
      for (const claim of result.detail.unbacked_claims) {
        assert.equal(typeof claim.doc_file, 'string');
        assert.equal(typeof claim.line, 'number');
        assert.equal(typeof claim.claim_text, 'string');
      }
    }
  });
});

// ── assembleReverseCandidates ────────────────────────────────────────────────

describe('assembleReverseCandidates', () => {
  it('returns function type', () => {
    assert.equal(typeof assembleReverseCandidates, 'function');
  });

  it('returns empty when all scanners have 0 residual', () => {
    const result = assembleReverseCandidates(
      { residual: 0, detail: { untraced_modules: [] } },
      { residual: 0, detail: { orphan_tests: [] } },
      { residual: 0, detail: { unbacked_claims: [] } }
    );
    assert.equal(result.candidates.length, 0);
    assert.equal(result.total_raw, 0);
  });

  it('gathers candidates from all 3 sources', () => {
    const result = assembleReverseCandidates(
      { residual: 1, detail: { untraced_modules: [{ file: 'bin/alpha.cjs' }] } },
      { residual: 1, detail: { orphan_tests: ['test/beta.test.cjs'] } },
      { residual: 1, detail: { unbacked_claims: [{ doc_file: 'README.md', line: 5, claim_text: 'supports feature X' }] } }
    );
    assert.equal(result.total_raw, 3);
    assert.ok(result.candidates.length >= 3);
  });

  it('deduplicates test+source with matching base names', () => {
    const result = assembleReverseCandidates(
      { residual: 1, detail: { untraced_modules: [{ file: 'bin/foo.cjs' }] } },
      { residual: 1, detail: { orphan_tests: ['bin/foo.test.cjs'] } },
      { residual: 0, detail: { unbacked_claims: [] } }
    );
    assert.equal(result.total_raw, 2);
    // After dedup, should be 1 merged candidate
    assert.equal(result.candidates.length, 1);
    assert.ok(result.candidates[0].source_scanners.includes('C→R'));
    assert.ok(result.candidates[0].source_scanners.includes('T→R'));
    assert.equal(result.deduped, 1);
  });

  it('filters out .planning/ paths', () => {
    const result = assembleReverseCandidates(
      { residual: 1, detail: { untraced_modules: [{ file: '.planning/formal/foo.cjs' }] } },
      { residual: 0, detail: { orphan_tests: [] } },
      { residual: 0, detail: { unbacked_claims: [] } }
    );
    assert.equal(result.candidates.length, 0);
    assert.equal(result.filtered, 1);
  });

  it('filters out generated-stubs paths', () => {
    const result = assembleReverseCandidates(
      { residual: 0, detail: { untraced_modules: [] } },
      { residual: 1, detail: { orphan_tests: ['.planning/formal/generated-stubs/FOO-01.stub.test.js'] } },
      { residual: 0, detail: { unbacked_claims: [] } }
    );
    assert.equal(result.candidates.length, 0);
    assert.equal(result.filtered, 1);
  });

  it('has total_raw, deduped, filtered, acknowledged fields', () => {
    const result = assembleReverseCandidates(
      { residual: 0, detail: { untraced_modules: [] } },
      { residual: 0, detail: { orphan_tests: [] } },
      { residual: 0, detail: { unbacked_claims: [] } }
    );
    assert.equal(typeof result.total_raw, 'number');
    assert.equal(typeof result.deduped, 'number');
    assert.equal(typeof result.filtered, 'number');
    assert.equal(typeof result.acknowledged, 'number');
  });
});

// ── Integration: computeResidual includes reverse layers ─────────────────────

describe('computeResidual integration', () => {
  it('includes c_to_r, t_to_r, d_to_r fields', () => {
    // This is a live test — requires the project context
    const result = computeResidual();
    assert.ok('c_to_r' in result, 'Missing c_to_r');
    assert.ok('t_to_r' in result, 'Missing t_to_r');
    assert.ok('d_to_r' in result, 'Missing d_to_r');
    assert.ok('assembled_candidates' in result, 'Missing assembled_candidates');
    assert.ok('reverse_discovery_total' in result, 'Missing reverse_discovery_total');
  });

  it('reverse residuals do NOT inflate total', () => {
    const result = computeResidual();
    // Total should not include reverse layers
    const forwardSum =
      Math.max(0, result.r_to_f.residual) +
      Math.max(0, result.f_to_t.residual) +
      Math.max(0, result.c_to_f.residual) +
      Math.max(0, result.t_to_c.residual) +
      Math.max(0, result.f_to_c.residual) +
      Math.max(0, result.r_to_d.residual) +
      Math.max(0, result.d_to_c.residual) +
      (result.p_to_f ? Math.max(0, result.p_to_f.residual) : 0);

    assert.equal(result.total, forwardSum, 'total should only include forward layers');
  });

  it('reverse_discovery_total equals sum of reverse residuals', () => {
    const result = computeResidual();
    const reverseSum =
      Math.max(0, result.c_to_r.residual) +
      Math.max(0, result.t_to_r.residual) +
      Math.max(0, result.d_to_r.residual);
    assert.equal(result.reverse_discovery_total, reverseSum);
  });
});

// ── formatJSON includes reverse layers ───────────────────────────────────────

describe('formatJSON with reverse layers', () => {
  it('includes c_to_r, t_to_r, d_to_r in health object', () => {
    const residual = computeResidual();
    const json = formatJSON([{ iteration: 1, residual, actions: [] }], residual, false);
    assert.ok('c_to_r' in json.health, 'Missing c_to_r in health');
    assert.ok('t_to_r' in json.health, 'Missing t_to_r in health');
    assert.ok('d_to_r' in json.health, 'Missing d_to_r in health');
  });

  it('solver_version is 1.2', () => {
    const residual = computeResidual();
    const json = formatJSON([{ iteration: 1, residual, actions: [] }], residual, false);
    assert.equal(json.solver_version, '1.2');
  });
});
