#!/usr/bin/env node
'use strict';
// bin/run-breaker-tlc.test.cjs
// Error-path tests for bin/run-breaker-tlc.cjs.
// All tests check error conditions only — no Java or TLC invocation.
// Requirements: QT-105

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RUN_BREAKER_TLC = path.join(__dirname, 'run-breaker-tlc.cjs');

test('exits non-zero and prints clear error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_BREAKER_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero and prints download URL when tla2tools.jar is not found', () => {
  // Need valid Java so run-breaker-tlc.cjs passes Java check and reaches JAR check.
  // Detect system Java home: on macOS /usr/libexec/java_home, fallback to JAVA_HOME env.
  const javaHome = process.env.JAVA_HOME ||
    (() => { const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })() ||
    null;
  // If no Java available, skip this test — it cannot reach JAR check without Java.
  if (!javaHome) { return; }  // test is skipped, not failed
  // If the JAR is present on disk (gitignored but downloaded), skip — cannot test absence.
  const fs = require('fs');
  const jarPath = require('path').join(__dirname, '..', 'formal', 'tla', 'tla2tools.jar');
  if (fs.existsSync(jarPath)) { return; }  // test is skipped, not failed
  const result = spawnSync(process.execPath, [RUN_BREAKER_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome },
    // No JAR exists in the repo (gitignored) — JAR check fires
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /tla2tools\.jar|github\.com\/tlaplus/i);
});

test('exits non-zero with descriptive message for unknown --config value', () => {
  const result = spawnSync(process.execPath, [RUN_BREAKER_TLC, '--config=bogus'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown config|bogus/i);
});

test('exits non-zero and lists valid configs (MCbreaker) in error output for invalid config', () => {
  const result = spawnSync(process.execPath, [RUN_BREAKER_TLC, '--config=invalid'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /MCbreaker/i);
});
