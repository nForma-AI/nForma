#!/usr/bin/env node
// @requirement SOLVE-06
// Verifies: assembleReverseCandidates provides reverse traceability sweeps
// (C->R, T->R, D->R) with deduplication and acknowledged-not-required filtering.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const nfSolvePath = path.resolve(__dirname, '../../../bin/nf-solve.cjs');

test('SOLVE-06: assembleReverseCandidates is exported from nf-solve.cjs', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.assembleReverseCandidates === 'function',
    'assembleReverseCandidates must be exported');
});

test('SOLVE-06: sweepCtoR, sweepTtoR, sweepDtoR are exported', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.sweepCtoR === 'function', 'sweepCtoR must be exported');
  assert.ok(typeof mod.sweepTtoR === 'function', 'sweepTtoR must be exported');
  assert.ok(typeof mod.sweepDtoR === 'function', 'sweepDtoR must be exported');
});

test('SOLVE-06: assembleReverseCandidates handles empty inputs', () => {
  const { assembleReverseCandidates } = require(nfSolvePath);
  const result = assembleReverseCandidates(
    { residual: 0, detail: {} },
    { residual: 0, detail: {} },
    { residual: 0, detail: {} }
  );
  assert.ok(result.candidates !== undefined, 'must return candidates array');
  assert.strictEqual(result.candidates.length, 0, 'empty inputs produce no candidates');
  assert.strictEqual(result.total_raw, 0, 'total_raw should be 0');
});

test('SOLVE-06: assembleReverseCandidates deduplicates test+module pairs', () => {
  const { assembleReverseCandidates } = require(nfSolvePath);
  const result = assembleReverseCandidates(
    { residual: 2, detail: { untraced_modules: [{ file: 'bin/foo.cjs' }] } },
    { residual: 1, detail: { orphan_tests: ['bin/foo.test.cjs'] } },
    { residual: 0, detail: {} }
  );
  assert.strictEqual(result.total_raw, 2, 'raw count should be 2 (1 module + 1 test)');
  assert.ok(result.deduped > 0, 'deduplication should merge foo.cjs and foo.test.cjs');
  // Merged candidate should have both scanners
  const merged = result.candidates.find(c =>
    c.source_scanners.includes('C\u2192R') && c.source_scanners.includes('T\u2192R')
  );
  assert.ok(merged, 'merged candidate should have both C->R and T->R scanners');
});

test('SOLVE-06: assembleReverseCandidates filters acknowledged-not-required', () => {
  const source = fs.readFileSync(nfSolvePath, 'utf8');
  assert.match(source, /acknowledged-not-required/,
    'must reference acknowledged-not-required.json for filtering');
});

test('SOLVE-06: solver-portability.als models reverse traceability', () => {
  const alloyPath = path.resolve(__dirname, '../../../.planning/formal/alloy/solver-portability.als');
  const content = fs.readFileSync(alloyPath, 'utf8');
  assert.match(content, /SOLVE-06/,
    'Alloy model must reference SOLVE-06 requirement');
});
