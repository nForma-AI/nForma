#!/usr/bin/env node
'use strict';
// bin/run-formal-check.test.cjs
// Tests for PRISM delegation in run-formal-check.cjs.
// Verifies that prism checks delegate to run-prism.cjs instead of calling
// the prism binary directly.
// Requirements: quick-225

const { test }      = require('node:test');
const assert        = require('node:assert');
const { spawnSync } = require('child_process');
const path          = require('path');

const { runCheck, MODULE_CHECKS } = require('./run-formal-check.cjs');

const RUN_FORMAL_CHECK = path.join(__dirname, 'run-formal-check.cjs');

test('runCheck delegates prism checks to run-prism.cjs', () => {
  // Find the prism check definition for quorum module
  const prismCheck = MODULE_CHECKS.quorum.find(c => c.tool === 'prism');
  assert.ok(prismCheck, 'quorum module must have a prism check definition');

  const result = runCheck('quorum', prismCheck, null, process.cwd());

  // Since PRISM_BIN may not be set in the test environment,
  // expected behavior is either pass (prism installed) or skipped (not installed).
  // It should never be 'fail' due to a delegation issue.
  assert.ok(
    ['pass', 'skipped'].includes(result.status),
    'prism check status should be pass or skipped, got: ' + result.status + ' detail: ' + result.detail
  );
  // Verify correct shape
  assert.strictEqual(result.module, 'quorum');
  assert.strictEqual(result.tool, 'prism');
  assert.ok(typeof result.detail === 'string', 'detail must be a string');
  assert.ok(typeof result.runtimeMs === 'number', 'runtimeMs must be a number');
});

test('prism delegation spawns run-prism.cjs not prism binary directly', () => {
  // Verify the source code delegates to run-prism.cjs by checking the implementation.
  // The old inline code used resolvePrismBin() + spawnSync(prismBin, ...).
  // The new code uses spawnSync(process.execPath, [runPrismPath, ...]).
  const fs = require('fs');
  const src = fs.readFileSync(RUN_FORMAL_CHECK, 'utf8');

  // Delegation pattern must exist
  assert.ok(
    src.includes('run-prism.cjs'),
    'run-formal-check.cjs must reference run-prism.cjs for delegation'
  );

  // Old direct invocation pattern must NOT exist
  assert.ok(
    !src.includes("require('./resolve-prism-bin.cjs')"),
    'run-formal-check.cjs must not directly require resolve-prism-bin.cjs'
  );
  assert.ok(
    !src.includes('spawnSync(prismBin'),
    'run-formal-check.cjs must not directly spawn the prism binary'
  );

  // Also run the CLI to verify fail-open behavior
  const env = { ...process.env };
  delete env.PRISM_BIN;

  const result = spawnSync(process.execPath, [RUN_FORMAL_CHECK, '--modules=quorum'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 60000,
    env
  });

  // Fail-open: prism skipped should not cause overall failure if TLC/Alloy also skip
  assert.strictEqual(result.status, 0,
    'exit code should be 0 (fail-open: skipped checks do not cause failure)');

  // The FORMAL_CHECK_RESULT line should show prism was handled (skipped or passed)
  assert.ok(
    result.stdout.includes('FORMAL_CHECK_RESULT'),
    'stdout must contain machine-readable result line'
  );
});

test('runCheck returns correct shape for prism tool', () => {
  const prismCheck = MODULE_CHECKS.quorum.find(c => c.tool === 'prism');
  assert.ok(prismCheck, 'quorum module must have a prism check definition');

  const result = runCheck('quorum', prismCheck, null, process.cwd());

  // Verify all expected keys exist
  assert.ok('module' in result, 'result must have module key');
  assert.ok('tool' in result, 'result must have tool key');
  assert.ok('status' in result, 'result must have status key');
  assert.ok('detail' in result, 'result must have detail key');
  assert.ok('runtimeMs' in result, 'result must have runtimeMs key');

  // Type checks
  assert.strictEqual(typeof result.module, 'string');
  assert.strictEqual(typeof result.tool, 'string');
  assert.strictEqual(typeof result.status, 'string');
  assert.strictEqual(typeof result.detail, 'string');
  assert.strictEqual(typeof result.runtimeMs, 'number');
  assert.ok(result.runtimeMs >= 0, 'runtimeMs must be >= 0');
});
