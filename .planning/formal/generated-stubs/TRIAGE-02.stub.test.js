#!/usr/bin/env node
// @requirement TRIAGE-02
// Test: run-formal-verify.cjs calls generate-triage-bundle.cjs as the final step after all checks

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('TRIAGE-02: run-formal-verify.cjs contains a triage-bundle step referencing generate-triage-bundle.cjs', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // Verify generate-triage-bundle.cjs is registered as a step
  assert.match(source, /generate-triage-bundle\.cjs/, 'references generate-triage-bundle.cjs');
});

test('TRIAGE-02: triage-bundle step is in STATIC_STEPS (runs after tool groups)', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // The triage bundle step should be in the STATIC_STEPS array
  assert.match(source, /ci:triage-bundle/, 'has ci:triage-bundle step id');
  assert.match(source, /generate-triage-bundle/, 'step references the triage bundle script');
});

test('TRIAGE-02: triage-bundle step appears after CI enforcement steps in STATIC_STEPS', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // Triage bundle should appear after CI enforcement steps
  const ciTraceIdx = source.indexOf("'ci:trace-redaction'");
  const triageIdx = source.indexOf("'ci:triage-bundle'");
  assert.ok(ciTraceIdx > 0, 'ci:trace-redaction step exists');
  assert.ok(triageIdx > 0, 'ci:triage-bundle step exists');
  assert.ok(triageIdx > ciTraceIdx, 'triage-bundle appears after ci enforcement steps');
});
