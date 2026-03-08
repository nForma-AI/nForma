#!/usr/bin/env node
// @requirement EVID-01
// Structural test for Confidence assertion from evidence-triage.als
// Verifies that validate-traces.cjs exports computeConfidenceTier with
// low/medium/high tiers based on trace volume and window duration.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const vtPath = path.resolve(__dirname, '../../../bin/validate-traces.cjs');

test('EVID-01: computeConfidenceTier is exported', () => {
  const mod = require(vtPath);
  assert.ok(typeof mod.computeConfidenceTier === 'function',
    'computeConfidenceTier must be exported');
});

test('EVID-01: CONFIDENCE_THRESHOLDS is exported', () => {
  const mod = require(vtPath);
  assert.ok(mod.CONFIDENCE_THRESHOLDS, 'CONFIDENCE_THRESHOLDS must be exported');
  assert.ok('low' in mod.CONFIDENCE_THRESHOLDS, 'must have low tier');
  assert.ok('medium' in mod.CONFIDENCE_THRESHOLDS, 'must have medium tier');
  assert.ok('high' in mod.CONFIDENCE_THRESHOLDS, 'must have high tier');
});

test('EVID-01: computeConfidenceTier returns low for zero rounds', () => {
  const { computeConfidenceTier } = require(vtPath);
  assert.equal(computeConfidenceTier(0, 0), 'low');
});

test('EVID-01: computeConfidenceTier returns medium for adequate rounds and days', () => {
  const { computeConfidenceTier, CONFIDENCE_THRESHOLDS } = require(vtPath);
  const result = computeConfidenceTier(
    CONFIDENCE_THRESHOLDS.medium.min_rounds,
    CONFIDENCE_THRESHOLDS.medium.min_days
  );
  assert.equal(result, 'medium');
});

test('EVID-01: computeConfidenceTier returns high for large volume', () => {
  const { computeConfidenceTier, CONFIDENCE_THRESHOLDS } = require(vtPath);
  const result = computeConfidenceTier(
    CONFIDENCE_THRESHOLDS.high.min_rounds,
    CONFIDENCE_THRESHOLDS.high.min_days
  );
  assert.equal(result, 'high');
});
