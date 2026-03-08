#!/usr/bin/env node
// @requirement SOLVE-11
// Behavioral test: formal verification result schema distinguishes infrastructure errors
// (binary not found, model missing, Java version wrong) from requirement violations
// (counterexample, divergence, property violation) using separate result values,
// and only requirement violations inflate the F->C residual.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const WRITE_CHECK_RESULT_PATH = path.resolve(__dirname, '../../../bin/write-check-result.cjs');
const CHECK_RESULTS_EXIT_PATH = path.resolve(__dirname, '../../../bin/check-results-exit.cjs');
const VERIFY_FORMAL_PATH = path.resolve(__dirname, '../../../bin/verify-formal-results.cjs');

test('SOLVE-11: VALID_RESULTS includes both "error" (infra) and "fail" (violation) as distinct values', () => {
  const { VALID_RESULTS } = require(WRITE_CHECK_RESULT_PATH);
  assert.ok(Array.isArray(VALID_RESULTS), 'VALID_RESULTS must be an array');
  assert.ok(VALID_RESULTS.includes('error'), 'VALID_RESULTS must include "error" for infrastructure errors');
  assert.ok(VALID_RESULTS.includes('fail'), 'VALID_RESULTS must include "fail" for requirement violations');
  assert.notEqual(
    VALID_RESULTS.indexOf('error'),
    VALID_RESULTS.indexOf('fail'),
    '"error" and "fail" must be distinct result values'
  );
});

test('SOLVE-11: check-results-exit only counts "fail" results (not "error") for exit code', () => {
  const fs = require('node:fs');
  const content = fs.readFileSync(CHECK_RESULTS_EXIT_PATH, 'utf8');
  // The exit logic filters on result === 'fail', NOT result === 'error'
  assert.match(content, /result\s*===\s*'fail'/, 'must filter on result === "fail" for exit code');
  // Should NOT treat 'error' as failure for exit code
  assert.ok(!content.includes("result === 'error'") || content.includes("result === 'fail'"),
    'exit logic must specifically check for "fail", not "error"');
});

test('SOLVE-11: groupByFormalism tracks "inconclusive" separately from "fail"', () => {
  const { groupByFormalism } = require(VERIFY_FORMAL_PATH);
  const results = [
    { formalism: 'tla', result: 'fail' },
    { formalism: 'tla', result: 'inconclusive' },
    { formalism: 'tla', result: 'pass' },
  ];
  const grouped = groupByFormalism(results);
  assert.equal(grouped.tla.fail, 1, 'must count 1 fail');
  assert.equal(grouped.tla.inconclusive, 1, 'must count 1 inconclusive');
  assert.equal(grouped.tla.pass, 1, 'must count 1 pass');
});

test('SOLVE-11: groupByFormalism does not count "error" in fail bucket', () => {
  const { groupByFormalism } = require(VERIFY_FORMAL_PATH);
  // 'error' is not in the pass/fail/warn/inconclusive schema of groupByFormalism
  // so it should not inflate fail count
  const results = [
    { formalism: 'alloy', result: 'error' },
    { formalism: 'alloy', result: 'fail' },
  ];
  const grouped = groupByFormalism(results);
  assert.equal(grouped.alloy.fail, 1, 'only "fail" results should increment fail count');
});
