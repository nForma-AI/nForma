#!/usr/bin/env node
// @requirement HEAL-02
// Structural test: verify-quorum-health.cjs exports suggestMaxDeliberation and
// applyMaxDeliberationUpdate with correct signatures for auto-adjusting maxDeliberation.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const mod = require('/Users/jonathanborduas/code/QGSD/bin/verify-quorum-health.cjs');

test('HEAL-02: verify-quorum-health exports suggestMaxDeliberation function', () => {
  assert.strictEqual(typeof mod.suggestMaxDeliberation, 'function',
    'suggestMaxDeliberation must be exported as a function');
});

test('HEAL-02: verify-quorum-health exports applyMaxDeliberationUpdate function', () => {
  assert.strictEqual(typeof mod.applyMaxDeliberationUpdate, 'function',
    'applyMaxDeliberationUpdate must be exported as a function');
});

test('HEAL-02: suggestMaxDeliberation returns a number for valid inputs', () => {
  const result = mod.suggestMaxDeliberation(0.7, 0.95);
  assert.strictEqual(typeof result, 'number', 'Must return a number');
  assert.ok(result >= 1, `Suggested maxDeliberation ${result} must be >= 1`);
  assert.ok(Number.isFinite(result), 'Must return a finite number for pPerRound > 0');
});

test('HEAL-02: suggestMaxDeliberation returns Infinity when pPerRound is 0', () => {
  const result = mod.suggestMaxDeliberation(0, 0.95);
  assert.strictEqual(result, Infinity, 'pPerRound=0 means consensus is impossible');
});

test('HEAL-02: suggestMaxDeliberation returns 1 when pPerRound is 1', () => {
  const result = mod.suggestMaxDeliberation(1, 0.95);
  assert.strictEqual(result, 1, 'pPerRound=1 means consensus in 1 round');
});
