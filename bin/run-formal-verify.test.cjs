#!/usr/bin/env node
'use strict';
// bin/run-formal-verify.test.cjs
// Error-path and integration smoke tests for bin/run-formal-verify.cjs.
// All tests check error conditions only — no Java/TLC/Alloy/PRISM invocation.
// Requirements: INTG-01, INTG-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RUN_FV = path.join(__dirname, 'run-formal-verify.cjs');

test('exits non-zero with descriptive error for unknown --only value', () => {
  const result = spawnSync(process.execPath, [RUN_FV, '--only=bogus-invalid'], { encoding: 'utf8' });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr || result.stdout, /unknown|invalid|bogus|--only/i);
});

test('syntax smoke: script loads without SyntaxError', () => {
  // Use node --check to parse the file for syntax errors without executing it.
  const result = spawnSync(process.execPath, ['--check', RUN_FV], {
    encoding: 'utf8',
    timeout: 5000,
  });
  // --check exits 0 on valid syntax; stderr contains "SyntaxError" on failure.
  assert.doesNotMatch(result.stderr || '', /SyntaxError/);
  assert.strictEqual(result.status, 0);
});

test('integration smoke: --only=generate filter resolves step list without Java', () => {
  // --only=generate with no Java still passes the argument-parsing stage
  // and enters the step-execution loop. Verify the filter is accepted
  // (it does NOT exit 1 for "Unknown --only value").
  // The step will fail (no generate-formal-specs.cjs execution succeeds without tooling),
  // but the important check is: the unknown-option guard does NOT fire.
  const result = spawnSync(process.execPath, [RUN_FV, '--only=generate'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  // Should NOT match the "Unknown --only value" error path
  assert.doesNotMatch(result.stderr || '', /Unknown --only value/i);
  // Full integration requires Java — note for CI documentation.
  // (exit code may be non-zero when child scripts fail; we only verify the pipeline is callable)
});
