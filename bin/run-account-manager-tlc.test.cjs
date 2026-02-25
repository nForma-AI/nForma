#!/usr/bin/env node
'use strict';
// bin/run-account-manager-tlc.test.cjs
// Error-path tests for bin/run-account-manager-tlc.cjs.
// All tests check error conditions only — no Java or TLC invocation.
// Requirements: INTG-01, INTG-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RUN_ACCOUNT_MANAGER_TLC = path.join(__dirname, 'run-account-manager-tlc.cjs');

test('exits non-zero and prints JAVA_HOME error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_ACCOUNT_MANAGER_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero with descriptive message for unknown --config value', () => {
  const result = spawnSync(process.execPath, [RUN_ACCOUNT_MANAGER_TLC, '--config=invalid'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown config|invalid/i);
});
