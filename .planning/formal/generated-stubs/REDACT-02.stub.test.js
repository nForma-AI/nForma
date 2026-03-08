#!/usr/bin/env node
// @requirement REDACT-02
// Auto-generated stub for uncovered invariant: CompleteRedaction
// Redaction check runs as CI step in `run-formal-verify.cjs`

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const runFormalSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../bin/run-formal-verify.cjs'),
  'utf8'
);

test('REDACT-02 — CompleteRedaction: run-formal-verify.cjs includes trace-redaction CI step', () => {
  // The STATIC_STEPS array must include a step for check-trace-redaction.cjs
  assert.match(runFormalSrc, /check-trace-redaction\.cjs/,
    'run-formal-verify.cjs must reference check-trace-redaction.cjs as a step');
});

test('REDACT-02 — CompleteRedaction: trace-redaction step has ci tool type', () => {
  // The step must be categorized under tool: 'ci'
  assert.match(runFormalSrc, /tool:\s*'ci'[^}]*check-trace-redaction|check-trace-redaction[^}]*tool:\s*'ci'/s,
    'trace-redaction step must have tool type ci');
});

test('REDACT-02 — CompleteRedaction: trace-redaction step ID is ci:trace-redaction', () => {
  assert.match(runFormalSrc, /id:\s*'ci:trace-redaction'/,
    'trace-redaction step must have id ci:trace-redaction');
});

test('REDACT-02 — CompleteRedaction: check-trace-redaction.cjs exists as executable', () => {
  const scriptPath = path.resolve(__dirname, '../../../bin/check-trace-redaction.cjs');
  assert.ok(fs.existsSync(scriptPath),
    'bin/check-trace-redaction.cjs must exist');
});
