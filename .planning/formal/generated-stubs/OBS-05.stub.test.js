#!/usr/bin/env node
// @requirement OBS-05
// Structural test: CLI tools exit with appropriate codes (0=success, non-zero=failure)
// and write errors to stderr, output to stdout

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const binDir = path.resolve(__dirname, '../../../bin');

// Sample CLI tools that should follow exit code conventions
const cliFiles = [
  'nf-solve.cjs',
  'run-formal-verify.cjs',
  'install-formal-tools.cjs',
  'review-mcp-logs.cjs',
];

test('OBS-05: CLI tools use process.exit or process.exitCode for exit codes', () => {
  for (const file of cliFiles) {
    const filePath = path.join(binDir, file);
    if (!fs.existsSync(filePath)) continue;
    const src = fs.readFileSync(filePath, 'utf8');
    // Must use process.exit() or process.exitCode for exit signaling
    const hasExit = /process\.exit\s*\(/.test(src) || /process\.exitCode\s*=/.test(src);
    assert.ok(hasExit, `${file} should use process.exit() or process.exitCode`);
  }
});

test('OBS-05: CLI tools write errors to stderr, not stdout', () => {
  for (const file of cliFiles) {
    const filePath = path.join(binDir, file);
    if (!fs.existsSync(filePath)) continue;
    const src = fs.readFileSync(filePath, 'utf8');
    // Should use process.stderr.write or console.error for error output
    const hasStderr = /process\.stderr\.write/.test(src) || /console\.error/.test(src);
    assert.ok(hasStderr, `${file} should write errors to stderr`);
  }
});

test('OBS-05: hooks use fail-open exit(0) pattern', () => {
  const hookDir = path.resolve(__dirname, '../../../hooks');
  const hookFiles = ['nf-stop.js', 'nf-prompt.js', 'gsd-context-monitor.js'];
  for (const file of hookFiles) {
    const filePath = path.join(hookDir, file);
    if (!fs.existsSync(filePath)) continue;
    const src = fs.readFileSync(filePath, 'utf8');
    // Hooks must exit 0 on error (fail-open)
    assert.match(src, /process\.exit\(0\)/, `${file} should have fail-open exit(0)`);
  }
});

test('OBS-05: non-zero exit codes are used for failure conditions', () => {
  const solveSrc = fs.readFileSync(path.join(binDir, 'nf-solve.cjs'), 'utf8');
  // nf-solve exits with conditional code: process.exit(finalResidual.total > 0 ? 1 : 0)
  assert.match(solveSrc, /process\.exit\(/);
  // The exit expression uses a ternary with 1 for failure
  assert.match(solveSrc, /\? 1 : 0/);
});
