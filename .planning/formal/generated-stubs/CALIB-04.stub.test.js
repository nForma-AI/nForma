#!/usr/bin/env node
// @requirement CALIB-04
// Constant test: policy.yaml tp_rate and unavail wire directly to run-prism.cjs fallback constants.
// Verifies the values in policy.yaml match what readPolicy extracts.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CALIB-04: policy.yaml conservative_priors.tp_rate matches expected value', () => {
  const { readPolicy } = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  const policy = readPolicy(policyPath);
  assert.equal(policy.conservative_priors.tp_rate, 0.85, 'tp_rate must be 0.85');
});

test('CALIB-04: policy.yaml conservative_priors.unavail matches expected value', () => {
  const { readPolicy } = require(path.join(ROOT, 'bin', 'read-policy.cjs'));
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  const policy = readPolicy(policyPath);
  assert.equal(policy.conservative_priors.unavail, 0.15, 'unavail must be 0.15');
});

test('CALIB-04: run-prism.cjs reads policy for fallback constants', () => {
  const fs = require('node:fs');
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-prism.cjs'), 'utf8');
  // run-prism.cjs must load policy via readPolicy (not hardcoded constants)
  assert.match(content, /readPolicy\(policyPath\)/, 'run-prism.cjs must call readPolicy(policyPath)');
  // Must use policy.conservative_priors values
  assert.match(content, /conservative_priors/, 'run-prism.cjs must reference conservative_priors from policy');
});
