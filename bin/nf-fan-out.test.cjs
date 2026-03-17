#!/usr/bin/env node
// bin/nf-fan-out.test.cjs — Wave 0 test scaffold for FAN-01, FAN-02, FAN-03
// Unit tests for mapRiskLevelToCount(riskLevel, maxSize) helper
// Uses node:test + node:assert/strict
//
// Purpose: Define test contracts for adaptive fan-out before implementation.
// mapRiskLevelToCount will be exported from hooks/nf-prompt.js once implemented.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// mapRiskLevelToCount will be exported from hooks/nf-prompt.js
// Stub tests — all fail until Wave 1 implementation
// Import will fail until helper is exported, so wrap in try/catch
let mapRiskLevelToCount;
try {
  ({ mapRiskLevelToCount } = require('../hooks/nf-prompt.js'));
} catch (_) {
  mapRiskLevelToCount = null;
}

// Helper: Guard each test against missing helper
function guardTest(fn) {
  return function() {
    if (!mapRiskLevelToCount) {
      // Skip gracefully — no throw, just fail with clear message
      assert.fail('mapRiskLevelToCount must be exported from hooks/nf-prompt.js');
    }
    return fn();
  };
}

// FAN-TC1: routine risk_level → fan_out_count = ceil(n/3), min 1
// Formula: low/routine = ceil(maxSize/3)
test('FAN-TC1: routine risk_level → fan_out_count = ceil(maxSize/3)', guardTest(() => {
  const result = mapRiskLevelToCount('routine', 3);
  // ceil(3/3) = 1
  assert.strictEqual(result, 1, 'routine risk_level with maxSize=3 should return ceil(3/3)=1');
}));

// FAN-TC2: medium risk_level → fan_out_count = ceil(2n/3)
// Formula: medium = ceil(2*maxSize/3)
test('FAN-TC2: medium risk_level → fan_out_count = ceil(2*maxSize/3)', guardTest(() => {
  const result = mapRiskLevelToCount('medium', 5);
  // ceil(2*5/3) = ceil(3.33) = 4
  assert.strictEqual(result, 4, 'medium risk_level with maxSize=5 should return ceil(2*5/3)=4');
}));

// FAN-TC3: high risk_level → fan_out_count = maxSize
test('FAN-TC3: high risk_level → fan_out_count = maxSize', guardTest(() => {
  const result = mapRiskLevelToCount('high', 4);
  assert.strictEqual(result, 4, 'high risk_level should return maxSize (4)');
}));

// FAN-TC4: undefined risk_level → fan_out_count = maxSize (fail-open)
test('FAN-TC4: undefined risk_level → fan_out_count = maxSize (fail-open)', guardTest(() => {
  const result = mapRiskLevelToCount(undefined, 3);
  assert.strictEqual(result, 3, 'undefined risk_level should default to maxSize (3)');
}));

// FAN-TC5: invalid risk_level string → fan_out_count = maxSize (fail-open)
test('FAN-TC5: invalid risk_level string → fan_out_count = maxSize (fail-open)', guardTest(() => {
  const result = mapRiskLevelToCount('critical', 3);
  assert.strictEqual(result, 3, 'invalid risk_level should default to maxSize (3)');
}));
