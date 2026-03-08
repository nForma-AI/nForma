#!/usr/bin/env node
// @requirement SOLVE-10
// Structural test: T->C sweep collects coverage data and crossReferenceFormalCoverage()
// cross-references covered source files against formal-test-sync recipe source_files,
// identifying false-green properties, with coverage collection fail-open.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SOLVE_PATH = path.resolve(__dirname, '../../../bin/nf-solve.cjs');

test('SOLVE-10: nf-solve.cjs exports crossReferenceFormalCoverage function', () => {
  const mod = require(SOLVE_PATH);
  assert.equal(typeof mod.crossReferenceFormalCoverage, 'function',
    'crossReferenceFormalCoverage must be exported from nf-solve.cjs');
});

test('SOLVE-10: crossReferenceFormalCoverage returns { available: false } on null input (fail-open)', () => {
  const { crossReferenceFormalCoverage } = require(SOLVE_PATH);
  const result = crossReferenceFormalCoverage(null);
  assert.deepStrictEqual(result, { available: false },
    'null coverage data must return { available: false }');
});

test('SOLVE-10: crossReferenceFormalCoverage returns { available: false } on undefined input (fail-open)', () => {
  const { crossReferenceFormalCoverage } = require(SOLVE_PATH);
  const result = crossReferenceFormalCoverage(undefined);
  assert.deepStrictEqual(result, { available: false },
    'undefined coverage data must return { available: false }');
});

test('SOLVE-10: nf-solve.cjs source references false-green detection logic', () => {
  const fs = require('node:fs');
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  assert.match(content, /falseGreen/i, 'must detect false-green properties');
  assert.match(content, /source_files_absolute/, 'must cross-reference recipe source_files_absolute');
  assert.match(content, /coveredFiles/, 'must track covered files from V8 data');
});
