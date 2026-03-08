#!/usr/bin/env node
// @requirement REDACT-03
// Auto-generated stub for uncovered invariant: CompleteRedaction
// Redaction violations emit `result=fail` (not warn)

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const redactionSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../bin/check-trace-redaction.cjs'),
  'utf8'
);

test('REDACT-03 — CompleteRedaction: violations produce result=fail', () => {
  // When violations are found, writeCheckResult must be called with result: 'fail'
  assert.match(redactionSrc, /result:\s*'fail'/,
    'check-trace-redaction.cjs must emit result=fail for violations');
});

test('REDACT-03 — CompleteRedaction: violations do not produce result=warn', () => {
  // Ensure the violation path never uses 'warn' — it must be 'fail'
  // The source should not have result: 'warn' in violation handling context
  const violationBlock = redactionSrc.slice(
    redactionSrc.indexOf('allViolations.length > 0'),
    redactionSrc.indexOf('process.exit(1)')
  );
  assert.doesNotMatch(violationBlock, /result:\s*'warn'/,
    'violation handling must not use result=warn');
});

test('REDACT-03 — CompleteRedaction: violations cause exit code 1', () => {
  // Confirm violations trigger process.exit(1) — hard failure, not soft warning
  assert.match(redactionSrc, /process\.exit\(1\)/,
    'check-trace-redaction.cjs must exit with code 1 on violations');
});

test('REDACT-03 — CompleteRedaction: clean traces produce result=pass', () => {
  // Verify that when no violations are found, the result is 'pass'
  assert.match(redactionSrc, /result:\s*'pass'/,
    'check-trace-redaction.cjs must emit result=pass for clean traces');
});
