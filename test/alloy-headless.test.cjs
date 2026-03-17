'use strict';
/** @requirement ANNOT-02 — validates Alloy model checker scripts run in headless mode */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const ALLOY_RUNNER_PATTERN = /^run-.*alloy.*\.cjs$/;

// Auto-discover all Alloy runner scripts (exclude test files)
const runners = fs.readdirSync(BIN_DIR)
  .filter(f => ALLOY_RUNNER_PATTERN.test(f) && !f.includes('.test.'));

// ── Static Source Scan ──────────────────────────────────────────────────────

describe('static source scan', () => {
  test('discovers exactly 6 Alloy runner scripts', () => {
    const expected = [
      'run-alloy.cjs',
      'run-transcript-alloy.cjs',
      'run-account-pool-alloy.cjs',
      'run-audit-alloy.cjs',
      'run-installer-alloy.cjs',
      'run-quorum-composition-alloy.cjs',
    ];
    assert.strictEqual(runners.length, 6,
      `Expected 6 Alloy runners, found ${runners.length}: ${runners.join(', ')}`);
    for (const name of expected) {
      assert.ok(runners.includes(name), `Missing expected runner: ${name}`);
    }
  });

  for (const runner of runners) {
    test(`${runner} contains -Djava.awt.headless=true`, () => {
      const source = fs.readFileSync(path.join(BIN_DIR, runner), 'utf8');
      assert.ok(
        source.includes('-Djava.awt.headless=true'),
        `${runner} is missing -Djava.awt.headless=true`
      );
    });

    test(`${runner} has headless flag before -jar in spawnSync args`, () => {
      const source = fs.readFileSync(path.join(BIN_DIR, runner), 'utf8');
      // In the args array, headless flag must appear before '-jar'
      const orderRegex = /'-Djava\.awt\.headless=true'[\s\S]*?'-jar'/;
      assert.ok(
        orderRegex.test(source),
        `${runner}: -Djava.awt.headless=true must appear before -jar in spawnSync args`
      );
    });
  }
});

// ── Dynamic Invocation ──────────────────────────────────────────────────────

describe('dynamic invocation', () => {
  for (const runner of runners) {
    test(`${runner} is loadable and executable (exits early with bad JAVA_HOME)`, () => {
      const runnerPath = path.join(BIN_DIR, runner);
      const result = spawnSync(process.execPath, [runnerPath], {
        encoding: 'utf8',
        timeout: 15000,
        env: { ...process.env, JAVA_HOME: '/nonexistent/java/home' },
      });
      // The runner should exit with code 1 (Java not found)
      assert.strictEqual(result.status, 1,
        `${runner} should exit 1 when JAVA_HOME points to nonexistent path`);
      // Confirm the script actually executed and produced output
      assert.ok(
        result.stderr.includes('[run-'),
        `${runner} stderr should contain "[run-" prefix, got: ${result.stderr.slice(0, 200)}`
      );
    });
  }
});
