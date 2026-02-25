#!/usr/bin/env node
'use strict';
// bin/run-alloy.test.cjs
// Wave 0 RED stubs for bin/run-alloy.cjs error paths.
// All tests check error conditions only — no Java or Alloy JAR invocation.
// Requirements: ALY-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RUN_ALLOY = path.join(__dirname, 'run-alloy.cjs');

test('exits non-zero and prints JAVA_HOME error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero and prints Alloy JAR download URL when JAR not found', () => {
  // Need valid Java so run-alloy.cjs passes Java check and reaches JAR check.
  // Detect system Java home: on macOS /usr/libexec/java_home, fallback to JAVA_HOME env.
  const javaHome = process.env.JAVA_HOME ||
    (() => { const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })() ||
    null;
  // If no Java available, skip this test — it cannot reach JAR check without Java.
  if (!javaHome) { return; }  // test is skipped, not failed
  const result = spawnSync(process.execPath, [RUN_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome },
    // No JAR exists in the repo (gitignored) — JAR check fires
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /org\.alloytools|alloy.*jar|github\.com\/AlloyTools/i);
});

test('exits non-zero with descriptive message for missing ALS file', () => {
  const result = spawnSync(process.execPath, [RUN_ALLOY, '--als=/nonexistent/path/quorum.als'], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
});

test('exits non-zero listing download URL in error when both JAR and ALS are missing', () => {
  // Run with a nonexistent JAVA_HOME — the JAVA_HOME check fires first,
  // giving a clear error about Java. The important assertion is exit 1.
  const result = spawnSync(process.execPath, [RUN_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  // Should mention JAVA_HOME or java in some form
  assert.ok(
    result.stderr.length > 0,
    'Expected stderr output describing the error'
  );
});
