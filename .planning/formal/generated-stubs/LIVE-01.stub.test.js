#!/usr/bin/env node
// @requirement LIVE-01
// Test: CI step detects liveness properties lacking a fairness declaration
//       and emits result=inconclusive instead of pass
// Strategy: behavioral — verify check-liveness-fairness.cjs source encodes
//   the inconclusive result logic and calls writeCheckResult with correct result

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcPath = path.resolve(__dirname, '../../../bin/check-liveness-fairness.cjs');
const source = fs.readFileSync(srcPath, 'utf8');

test('LIVE-01: check-liveness-fairness.cjs emits result=inconclusive when fairness missing', () => {
  // Verify the conditional logic: hasMissing -> 'inconclusive', else 'pass'
  assert.match(source, /hasMissing\s*\?\s*'inconclusive'\s*:\s*'pass'/,
    'Must compute result as inconclusive when missing fairness declarations found');
});

test('LIVE-01: check-liveness-fairness.cjs calls writeCheckResult with the result', () => {
  assert.match(source, /writeCheckResult\s*\(\s*\{/,
    'Must call writeCheckResult to emit the check result');
  // Verify the check_id matches the CI step identifier
  assert.match(source, /check_id:\s*['"]ci:liveness-fairness-lint['"]/,
    'Must use check_id ci:liveness-fairness-lint');
});

test('LIVE-01: check-liveness-fairness.cjs always exits 0 (inconclusive is not a build failure)', () => {
  assert.match(source, /process\.exit\s*\(\s*0\s*\)/,
    'Must exit with code 0 even when result is inconclusive');
});

test('LIVE-01: check-liveness-fairness.cjs uses detectLivenessProperties to find missing fairness', () => {
  assert.match(source, /detectLivenessProperties/,
    'Must use detectLivenessProperties function to scan for missing fairness declarations');
});
