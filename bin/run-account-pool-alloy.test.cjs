#!/usr/bin/env node
'use strict';
// bin/run-account-pool-alloy.test.cjs
// Error-path tests for bin/run-account-pool-alloy.cjs.
// All tests check error conditions only — no Java or Alloy JAR invocation.
// Requirements: INTG-01, INTG-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const RUN_ACCOUNT_POOL_ALLOY = path.join(__dirname, 'run-account-pool-alloy.cjs');

test('exits non-zero and prints JAVA_HOME error when JAVA_HOME points to nonexistent path', () => {
  // The script checks Java before the Alloy JAR — this guard fires first.
  const result = spawnSync(process.execPath, [RUN_ACCOUNT_POOL_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero and prints Alloy JAR download URL when JAR not found', () => {
  // Need valid Java so the Java check passes and the JAR check fires.
  const javaHome = process.env.JAVA_HOME ||
    (() => {
      const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' });
      return r.status === 0 ? r.stdout.trim() : null;
    })() ||
    null;
  if (!javaHome) { return; }  // skip if no Java — cannot reach JAR check without Java

  const jarPath = path.join(__dirname, '..', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
  if (fs.existsSync(jarPath)) { return; }  // skip — cannot test absent-JAR path when JAR is present

  const result = spawnSync(process.execPath, [RUN_ACCOUNT_POOL_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /alloy.*jar|org\.alloytools|download/i);
});
