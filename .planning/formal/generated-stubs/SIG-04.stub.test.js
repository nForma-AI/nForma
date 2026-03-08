#!/usr/bin/env node
// @requirement SIG-04
// Test: quorum-consensus-gate.cjs gates quorum rounds by Poisson binomial consensus probability threshold

const { test } = require('node:test');
const assert = require('node:assert/strict');

const mod = require('/Users/jonathanborduas/code/QGSD/bin/quorum-consensus-gate.cjs');

test('SIG-04: exports poissonBinomialCDF function', () => {
  assert.equal(typeof mod.poissonBinomialCDF, 'function');
});

test('SIG-04: poissonBinomialCDF returns 1.0 for trivial case (all certain, k=1)', () => {
  const result = mod.poissonBinomialCDF([1.0, 1.0, 1.0], 1);
  assert.equal(result, 1.0);
});

test('SIG-04: poissonBinomialCDF returns 0 when k exceeds slot count', () => {
  const result = mod.poissonBinomialCDF([0.5, 0.5], 3);
  assert.equal(result, 0);
});

test('SIG-04: computeConsensusProbability uses Poisson binomial threshold gating', () => {
  const result = mod.computeConsensusProbability(
    { 'slot-1': 0.9, 'slot-2': 0.9, 'slot-3': 0.9 },
    2
  );
  assert.equal(typeof result.probability, 'number');
  assert.ok(result.probability > 0 && result.probability <= 1.0,
    'Probability should be between 0 and 1');
  assert.equal(result.minQuorum, 2);
  assert.equal(result.slotCount, 3);
});

test('SIG-04: checkConsensusGate returns proceed/defer based on threshold', () => {
  assert.equal(typeof mod.checkConsensusGate, 'function');
  // The function signature accepts options with threshold gating
  const result = mod.checkConsensusGate({ minQuorum: 1 });
  assert.ok(['proceed', 'defer'].includes(result.action),
    'action must be proceed or defer');
  assert.equal(typeof result.probability, 'number');
  assert.equal(typeof result.threshold, 'number');
});
