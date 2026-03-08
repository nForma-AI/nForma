#!/usr/bin/env node
// @requirement TRACE-05
// Validates: CI guard default threshold is 15% and check-coverage-guard.cjs exists with expected structure

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GUARD_PATH = path.join(ROOT, 'bin', 'check-coverage-guard.cjs');

test('TRACE-05: check-coverage-guard.cjs exists', () => {
  assert.ok(fs.existsSync(GUARD_PATH), 'bin/check-coverage-guard.cjs must exist');
});

test('TRACE-05: default threshold constant is 15', () => {
  const content = fs.readFileSync(GUARD_PATH, 'utf8');
  // The default threshold is parsed from CLI args with fallback 15
  assert.match(content, /threshold.*:\s*15\b|:\s*15;/, 'default threshold must be 15');
});

test('TRACE-05: guard references TRACE-05 requirement', () => {
  const content = fs.readFileSync(GUARD_PATH, 'utf8');
  assert.match(content, /TRACE-05/, 'check-coverage-guard.cjs must reference TRACE-05 requirement');
});

test('TRACE-05: guard supports --threshold CLI flag', () => {
  const content = fs.readFileSync(GUARD_PATH, 'utf8');
  assert.match(content, /--threshold/, 'must support --threshold CLI flag');
});
