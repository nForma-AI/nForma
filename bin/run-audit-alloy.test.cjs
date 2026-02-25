#!/usr/bin/env node
'use strict';
// bin/run-audit-alloy.test.cjs
// Wave 0 RED stubs for bin/run-audit-alloy.cjs error paths.
// All tests check error conditions only — no Java or Alloy JAR invocation.
// Requirements: GAP-3, GAP-9

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const RUN_AUDIT_ALLOY = path.join(__dirname, 'run-audit-alloy.cjs');

test('exits non-zero and prints JAVA_HOME error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_AUDIT_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero and prints Alloy JAR download URL when JAR not found', () => {
  // Need valid Java so run-audit-alloy.cjs passes Java check and reaches JAR check.
  // Detect system Java home: on macOS /usr/libexec/java_home, fallback to JAVA_HOME env.
  const javaHome = process.env.JAVA_HOME ||
    (() => { const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })() ||
    null;
  if (!javaHome) { return; }  // skip if no Java — cannot reach JAR check without Java

  const jarPath = path.join(__dirname, '..', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
  if (fs.existsSync(jarPath)) { return; }  // skip — can't test absent-JAR path when JAR is present

  const result = spawnSync(process.execPath, [RUN_AUDIT_ALLOY], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /alloy.*jar|org\.alloytools|download/i);
});

test('exits non-zero with descriptive message for unknown --spec value', () => {
  const result = spawnSync(process.execPath, [RUN_AUDIT_ALLOY, '--spec=bogus'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown spec|bogus/i);
});

test('exits non-zero and lists valid specs (scoreboard-recompute, availability-parsing) in error for invalid spec', () => {
  const result = spawnSync(process.execPath, [RUN_AUDIT_ALLOY, '--spec=invalid'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /scoreboard-recompute|availability-parsing/i);
});
