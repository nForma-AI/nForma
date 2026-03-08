#!/usr/bin/env node
// @requirement LIVE-02
// Test: run-formal-verify.cjs STEPS includes a ci:liveness-fairness-lint step
//       that enforces LIVE-01
// Strategy: structural — verify STATIC_STEPS contains the liveness-fairness-lint entry

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcPath = path.resolve(__dirname, '../../../bin/run-formal-verify.cjs');
const source = fs.readFileSync(srcPath, 'utf8');

test('LIVE-02: run-formal-verify.cjs STATIC_STEPS includes ci:liveness-fairness-lint step', () => {
  assert.match(source, /id:\s*['"]ci:liveness-fairness-lint['"]/,
    'STATIC_STEPS must include a step with id ci:liveness-fairness-lint');
});

test('LIVE-02: ci:liveness-fairness-lint step uses check-liveness-fairness.cjs script', () => {
  assert.match(source, /script:\s*['"]check-liveness-fairness\.cjs['"]/,
    'The liveness-fairness-lint step must reference check-liveness-fairness.cjs as its script');
});

test('LIVE-02: ci:liveness-fairness-lint step is categorized as tool=ci', () => {
  // Verify the step has tool: 'ci' so it runs in the CI enforcement phase
  assert.match(source, /tool:\s*['"]ci['"],\s*id:\s*['"]ci:liveness-fairness-lint['"]/,
    'The step must have tool: ci to run during CI enforcement phase');
});
