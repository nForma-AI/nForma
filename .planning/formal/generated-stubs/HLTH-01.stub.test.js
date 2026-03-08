#!/usr/bin/env node
// @requirement HLTH-01
// Behavioral test: The W005 regex in gsd-tools validate health correctly accepts
// versioned phase directories (v0.X-YY-name format), producing zero false positives.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// The W005 regex from gsd-tools.cjs Check 6:
// /^(v\d+\.\d+-\d{2}(?:\.\d+)?-[.\w-]+|\d{2}(?:\.\d+)?-[\w-]+)$/
const W005_REGEX = /^(v\d+\.\d+-\d{2}(?:\.\d+)?-[.\w-]+|\d{2}(?:\.\d+)?-[\w-]+)$/;

test('HLTH-01: v0.15-01-health-fix matches phase naming regex (no W005)', () => {
  assert.ok(W005_REGEX.test('v0.15-01-health-fix'),
    'v0.15-01-health-fix must match versioned phase pattern');
});

test('HLTH-01: v0.9-08-post-v0.9-install-sync matches (dots in name segment)', () => {
  assert.ok(W005_REGEX.test('v0.9-08-post-v0.9-install-sync'),
    'v0.9-08-post-v0.9-install-sync must match versioned phase pattern');
});

test('HLTH-01: v0.30-01-dynamic-model-selection matches', () => {
  assert.ok(W005_REGEX.test('v0.30-01-dynamic-model-selection'),
    'v0.30-01-dynamic-model-selection must match versioned phase pattern');
});

test('HLTH-01: traditional 01-setup format still matches', () => {
  assert.ok(W005_REGEX.test('01-setup'),
    'Traditional NN-name format must still match');
});

test('HLTH-01: invalid directory name does NOT match (triggers W005 correctly)', () => {
  assert.ok(!W005_REGEX.test('random-folder'),
    'random-folder should not match and should trigger W005');
});
