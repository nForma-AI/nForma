#!/usr/bin/env node
// @requirement CALIB-03
// Structural test: read-policy.cjs exposes all policy fields with typed interface.
// Verifies FallbackIsNull analog: when parsing succeeds, all fields have valid types.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CALIB-03: read-policy.cjs exports readPolicy function', () => {
  const mod = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  assert.equal(typeof mod.readPolicy, 'function', 'readPolicy must be a function export');
});

test('CALIB-03: readPolicy returns typed fields for all policy sections', () => {
  const { readPolicy } = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  const result = readPolicy(policyPath);

  // cold_start fields are integers
  assert.equal(typeof result.cold_start.min_ci_runs, 'number', 'min_ci_runs must be number');
  assert.ok(Number.isInteger(result.cold_start.min_ci_runs), 'min_ci_runs must be integer');
  assert.equal(typeof result.cold_start.min_quorum_rounds, 'number', 'min_quorum_rounds must be number');
  assert.ok(Number.isInteger(result.cold_start.min_quorum_rounds), 'min_quorum_rounds must be integer');
  assert.equal(typeof result.cold_start.min_days, 'number', 'min_days must be number');

  // steady_state.mode is a string
  assert.equal(typeof result.steady_state.mode, 'string', 'mode must be string');

  // conservative_priors are floats
  assert.equal(typeof result.conservative_priors.tp_rate, 'number', 'tp_rate must be number');
  assert.equal(typeof result.conservative_priors.unavail, 'number', 'unavail must be number');
});

test('CALIB-03: readPolicy throws on missing file (FallbackIsNull — fallback reason valid)', () => {
  const { readPolicy } = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  assert.throws(
    () => readPolicy('/nonexistent/path/policy.yaml'),
    /Policy file not found/,
    'readPolicy must throw descriptive error for missing file'
  );
});
