#!/usr/bin/env node
// @requirement CALIB-01
// Structural test: policy.yaml is the single authoritative source for PRISM calibration parameters.
// Verifies that read-policy.cjs reads from policy.yaml and requirement-map.cjs maps CALIB-01.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CALIB-01: policy.yaml exists as the authoritative calibration source', () => {
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  assert.ok(fs.existsSync(policyPath), 'policy.yaml must exist at .planning/formal/policy.yaml');
});

test('CALIB-01: policy.yaml contains required calibration keys', () => {
  const policyPath = path.join(ROOT, '.planning', 'formal', 'policy.yaml');
  const content = fs.readFileSync(policyPath, 'utf8');
  assert.match(content, /tp_rate/, 'policy.yaml must contain tp_rate');
  assert.match(content, /unavail/, 'policy.yaml must contain unavail');
  assert.match(content, /min_ci_runs/, 'policy.yaml must contain min_ci_runs');
  assert.match(content, /min_quorum_rounds/, 'policy.yaml must contain min_quorum_rounds');
  assert.match(content, /min_days/, 'policy.yaml must contain min_days');
});

test('CALIB-01: read-policy.cjs references policy.yaml parsing', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'read-policy.cjs'), 'utf8');
  assert.match(content, /readPolicy/, 'read-policy.cjs must export readPolicy function');
  assert.match(content, /policy\.yaml/, 'read-policy.cjs must reference policy.yaml');
});

test('CALIB-01: requirement-map.cjs maps alloy:availability to CALIB-01', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(path.join(ROOT, 'bin', 'requirement-map.cjs'));
  const reqs = CHECK_ID_TO_REQUIREMENTS['alloy:availability'];
  assert.ok(Array.isArray(reqs), 'alloy:availability must map to an array');
  assert.ok(reqs.includes('CALIB-01'), 'alloy:availability must include CALIB-01');
});
