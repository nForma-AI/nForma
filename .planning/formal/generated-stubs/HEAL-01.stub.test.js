#!/usr/bin/env node
// @requirement HEAL-01
// Test: Early escalation threshold defaults to 0.10 (10%) and computeEarlyEscalation
// fires shouldEscalate when P(consensus | remaining) < threshold.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  readEarlyEscalationThreshold,
  computeEarlyEscalation,
} = require('/Users/jonathanborduas/code/QGSD/bin/quorum-consensus-gate.cjs');

test('HEAL-01: readEarlyEscalationThreshold returns default 0.10 when no config exists', () => {
  // Pass non-existent paths so it falls through to default
  const threshold = readEarlyEscalationThreshold(['/tmp/does-not-exist-heal01.json']);
  assert.strictEqual(threshold, 0.10, 'Default early escalation threshold must be 0.10 (10%)');
});

test('HEAL-01: computeEarlyEscalation returns shouldEscalate=true when P < threshold', () => {
  // Very low slot rates + only 1 remaining round + high threshold => should escalate
  const slotRates = { 'slot-1': 0.1, 'slot-2': 0.1, 'slot-3': 0.1, 'slot-4': 0.1 };
  const result = computeEarlyEscalation(slotRates, 3, 1, 0.90);
  assert.strictEqual(result.shouldEscalate, true, 'Should escalate when P(consensus) is very low');
  assert.strictEqual(typeof result.probability, 'number');
  assert.strictEqual(result.threshold, 0.90);
  assert.strictEqual(result.remainingRounds, 1);
});

test('HEAL-01: computeEarlyEscalation returns shouldEscalate=false when P >= threshold', () => {
  // High slot rates + many rounds + low threshold => should NOT escalate
  const slotRates = { 'slot-1': 0.95, 'slot-2': 0.95, 'slot-3': 0.95, 'slot-4': 0.95 };
  const result = computeEarlyEscalation(slotRates, 2, 5, 0.10);
  assert.strictEqual(result.shouldEscalate, false, 'Should not escalate when P(consensus) is high');
  assert.ok(result.probability >= 0.10, `Probability ${result.probability} should be >= threshold 0.10`);
});

test('HEAL-01: computeEarlyEscalation returns shouldEscalate=true when remainingRounds=0', () => {
  const slotRates = { 'slot-1': 0.95, 'slot-2': 0.95 };
  const result = computeEarlyEscalation(slotRates, 2, 0, 0.10);
  assert.strictEqual(result.shouldEscalate, true, 'Must escalate when zero rounds remain');
  assert.strictEqual(result.probability, 0);
});
