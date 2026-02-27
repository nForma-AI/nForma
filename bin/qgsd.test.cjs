'use strict';
// Test suite for bin/qgsd.cjs — circuit breaker management CLI
// Uses Node.js built-in test runner: node --test bin/qgsd.test.cjs
//
// Spawns the CLI as a subprocess with cwd set to a non-git temp dir so
// getProjectRoot() falls back to process.cwd(), making state files isolated.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, 'qgsd.cjs');

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), 'qgsd-cli-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function run(args, cwd) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd: cwd || os.tmpdir(),
    timeout: 8000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

function stateFilePath(dir) {
  return path.join(dir, '.claude', 'circuit-breaker-state.json');
}

function readState(dir) {
  return JSON.parse(fs.readFileSync(stateFilePath(dir), 'utf8'));
}

// ─── Usage / unknown args ─────────────────────────────────────────────────────

test('no args: exits 1 with usage message', () => {
  const tmpDir = makeTmpDir();
  const { exitCode, stderr } = run([], tmpDir);
  assert.equal(exitCode, 1);
  assert.ok(stderr.includes('Usage'));
});

test('unknown flag: exits 1 with usage message', () => {
  const tmpDir = makeTmpDir();
  const { exitCode, stderr } = run(['--unknown'], tmpDir);
  assert.equal(exitCode, 1);
  assert.ok(stderr.includes('Usage'));
});

// ─── --disable-breaker ────────────────────────────────────────────────────────

test('--disable-breaker: exits 0', () => {
  const tmpDir = makeTmpDir();
  const { exitCode } = run(['--disable-breaker'], tmpDir);
  assert.equal(exitCode, 0);
});

test('--disable-breaker: creates state file with disabled=true, active=false', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  const state = readState(tmpDir);
  assert.equal(state.disabled, true);
  assert.equal(state.active, false);
});

test('--disable-breaker: prints confirmation message', () => {
  const tmpDir = makeTmpDir();
  const { stdout } = run(['--disable-breaker'], tmpDir);
  assert.ok(stdout.includes('disabled'));
});

test('--disable-breaker: preserves existing fields in state file', () => {
  const tmpDir = makeTmpDir();
  // Pre-create state with some existing data
  const claudeDir = path.join(tmpDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'circuit-breaker-state.json'),
    JSON.stringify({ active: true, oscillation_count: 3 }), 'utf8');

  run(['--disable-breaker'], tmpDir);
  const state = readState(tmpDir);
  assert.equal(state.disabled, true);
  assert.equal(state.active, false);
  assert.equal(state.oscillation_count, 3, 'Existing fields should be preserved');
});

// ─── --enable-breaker ─────────────────────────────────────────────────────────

test('--enable-breaker: exits 0', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir); // create state file first
  const { exitCode } = run(['--enable-breaker'], tmpDir);
  assert.equal(exitCode, 0);
});

test('--enable-breaker: sets disabled=false, active=false', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  run(['--enable-breaker'], tmpDir);
  const state = readState(tmpDir);
  assert.equal(state.disabled, false);
  assert.equal(state.active, false);
});

test('--enable-breaker: prints confirmation message', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  const { stdout } = run(['--enable-breaker'], tmpDir);
  assert.ok(stdout.includes('enabled'));
});

test('--enable-breaker: no-op when state file does not exist', () => {
  const tmpDir = makeTmpDir();
  // No state file — should not throw or create a file
  const { exitCode } = run(['--enable-breaker'], tmpDir);
  assert.equal(exitCode, 0);
  assert.equal(fs.existsSync(stateFilePath(tmpDir)), false, 'Should not create state file');
});

// ─── --reset-breaker ──────────────────────────────────────────────────────────

test('--reset-breaker: exits 0 when state file exists', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  const { exitCode } = run(['--reset-breaker'], tmpDir);
  assert.equal(exitCode, 0);
});

test('--reset-breaker: deletes state file', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  assert.ok(fs.existsSync(stateFilePath(tmpDir)), 'State file should exist before reset');
  run(['--reset-breaker'], tmpDir);
  assert.equal(fs.existsSync(stateFilePath(tmpDir)), false, 'State file should be deleted after reset');
});

test('--reset-breaker: exits 0 when no state file exists', () => {
  const tmpDir = makeTmpDir();
  const { exitCode, stdout } = run(['--reset-breaker'], tmpDir);
  assert.equal(exitCode, 0);
  assert.ok(stdout.includes('No active'), 'Should report no state found');
});

test('--reset-breaker: prints confirmation when file was deleted', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  const { stdout } = run(['--reset-breaker'], tmpDir);
  assert.ok(stdout.toLowerCase().includes('clear') || stdout.includes('breaker'));
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

test('disable → enable → disable round-trip preserves state structure', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  run(['--enable-breaker'], tmpDir);
  run(['--disable-breaker'], tmpDir);
  const state = readState(tmpDir);
  assert.equal(state.disabled, true);
});

test('disable → reset removes file; enable after reset is no-op', () => {
  const tmpDir = makeTmpDir();
  run(['--disable-breaker'], tmpDir);
  run(['--reset-breaker'], tmpDir);
  assert.equal(fs.existsSync(stateFilePath(tmpDir)), false);
  run(['--enable-breaker'], tmpDir); // should not create a file
  assert.equal(fs.existsSync(stateFilePath(tmpDir)), false);
});
