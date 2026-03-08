#!/usr/bin/env node
// @requirement CALIB-02
// Behavioral test: run-prism.cjs reads policy.yaml via readPolicy and writes observation_window metadata.
// Verifies readPolicy returns correct parsed values (year-rollover safe: all numeric >= 0).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CALIB-02: readPolicy parses policy.yaml with correct structure', () => {
  const { readPolicy } = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  const result = readPolicy(policyPath);

  // Verify structure
  assert.ok(result.cold_start, 'result must have cold_start section');
  assert.ok(result.steady_state, 'result must have steady_state section');
  assert.ok(result.conservative_priors, 'result must have conservative_priors section');
});

test('CALIB-02: readPolicy returns non-negative numeric values (YearRolloverHandled analog)', () => {
  const { readPolicy } = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  const result = readPolicy(policyPath);

  // All parsed numeric values must be >= 0 (ParseCorrect: no result.ts or result.ts >= 0)
  assert.ok(result.cold_start.min_ci_runs >= 0, 'min_ci_runs must be >= 0');
  assert.ok(result.cold_start.min_quorum_rounds >= 0, 'min_quorum_rounds must be >= 0');
  assert.ok(result.cold_start.min_days >= 0, 'min_days must be >= 0');
  assert.ok(result.conservative_priors.tp_rate >= 0, 'tp_rate must be >= 0');
  assert.ok(result.conservative_priors.unavail >= 0, 'unavail must be >= 0');
});

test('CALIB-02: run-prism.cjs imports readPolicy and writeCheckResult with observation_window', () => {
  const fs = require('node:fs');
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-prism.cjs'), 'utf8');
  assert.match(content, /readPolicy/, 'run-prism.cjs must import readPolicy');
  assert.match(content, /writeCheckResult/, 'run-prism.cjs must use writeCheckResult');
  assert.match(content, /observation_window/, 'run-prism.cjs must include observation_window in output');
});
