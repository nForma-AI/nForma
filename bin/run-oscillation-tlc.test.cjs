#!/usr/bin/env node
'use strict';
// bin/run-oscillation-tlc.test.cjs
// Wave 0 RED stubs for bin/run-oscillation-tlc.cjs error paths.
// All tests check error conditions only — no Java or TLC invocation.
// Requirements: GAP-1, GAP-5

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const RUN_OSCILLATION_TLC = path.join(__dirname, 'run-oscillation-tlc.cjs');

// @requirement DETECT-05
test('exits non-zero and prints clear error when JAVA_HOME points to nonexistent path', () => {
  const result = spawnSync(process.execPath, [RUN_OSCILLATION_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: '/nonexistent/java/path' },
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /JAVA_HOME|java/i);
});

test('exits non-zero and prints download URL when tla2tools.jar is not found', () => {
  // Need valid Java so run-oscillation-tlc.cjs passes Java check and reaches JAR check.
  // Detect system Java home: on macOS /usr/libexec/java_home, fallback to JAVA_HOME env.
  const javaHome = process.env.JAVA_HOME ||
    (() => { const r = spawnSync('/usr/libexec/java_home', [], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })() ||
    null;
  // If no Java available, skip this test — it cannot reach JAR check without Java.
  if (!javaHome) { return; }  // test is skipped, not failed
  // If the JAR is present on disk (gitignored but downloaded), skip — cannot test absence.
  const fs = require('fs');
  const jarPath = require('path').join(__dirname, '..', '.formal', 'tla', 'tla2tools.jar');
  if (fs.existsSync(jarPath)) { return; }  // test is skipped, not failed
  const result = spawnSync(process.execPath, [RUN_OSCILLATION_TLC], {
    encoding: 'utf8',
    env: { ...process.env, JAVA_HOME: javaHome },
    // No JAR exists in the repo (gitignored) — JAR check fires
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /tla2tools\.jar|github\.com\/tlaplus/i);
});

test('exits non-zero with descriptive message for unknown --config value', () => {
  const result = spawnSync(process.execPath, [RUN_OSCILLATION_TLC, '--config=bogus'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Unknown config|bogus/i);
});

test('exits non-zero and lists valid configs (MCoscillation, MCconvergence) in error output for invalid config', () => {
  const result = spawnSync(process.execPath, [RUN_OSCILLATION_TLC, '--config=invalid'], {
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /MCoscillation|MCconvergence/i);
});

test('both MCoscillation and MCconvergence use -workers 1 (both have liveness PROPERTY)', () => {
  const fs = require('fs');
  if (!fs.existsSync(RUN_OSCILLATION_TLC)) {
    assert.fail('run-oscillation-tlc.cjs not yet implemented — Wave 0 RED stub');
  }
  const src = fs.readFileSync(RUN_OSCILLATION_TLC, 'utf8');
  // GAP-5 fix: both configs have PROPERTY (liveness); workers must always be '1'
  // Assert unconditional workers assignment to '1'
  assert.match(src, /const workers = '1';/);
  // Assert no workers ternary conditional (the spec-file ternary for QGSDOscillation/QGSDConvergence
  // is still valid — only the workers ternary must be gone)
  assert.doesNotMatch(src, /workers\s*=\s*configName\s*===\s*['"]MCoscillation['"]\s*\?/);
  // Assert 'auto' is not assigned as the workers value
  assert.doesNotMatch(src, /workers\s*=.*['"]auto['"]/);
});

// LIVE-02: liveness wiring tests (Wave 0 RED stubs — fail until implementation in Wave 1)

test('run-oscillation-tlc.cjs requires run-tlc.cjs and destructures detectLivenessProperties', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'run-oscillation-tlc.cjs'), 'utf8');
  // Must require run-tlc.cjs
  assert.match(src, /require\(['"]\.\/run-tlc\.cjs['"]\)/,
    'run-oscillation-tlc.cjs must require ./run-tlc.cjs');
  // Must destructure detectLivenessProperties from it
  assert.match(src, /\{\s*detectLivenessProperties\s*\}\s*=\s*require\(['"]\.\/run-tlc\.cjs['"]\)/,
    'run-oscillation-tlc.cjs must destructure detectLivenessProperties from ./run-tlc.cjs');
});

test('run-oscillation-tlc.cjs calls detectLivenessProperties with configName and cfgPath', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'run-oscillation-tlc.cjs'), 'utf8');
  // Must call detectLivenessProperties(configName, cfgPath)
  assert.match(src, /detectLivenessProperties\s*\(\s*configName\s*,\s*cfgPath\s*\)/,
    'run-oscillation-tlc.cjs must call detectLivenessProperties(configName, cfgPath)');
});

test('run-oscillation-tlc.cjs has inconclusive writeCheckResult call in source', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, 'run-oscillation-tlc.cjs'), 'utf8');
  // Must have result: 'inconclusive' in a writeCheckResult call
  assert.match(src, /result\s*:\s*['"]inconclusive['"]/,
    'run-oscillation-tlc.cjs must have result=inconclusive in writeCheckResult call');
});
