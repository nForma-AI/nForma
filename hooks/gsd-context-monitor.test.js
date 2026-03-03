#!/usr/bin/env node
// Test suite for hooks/gsd-context-monitor.js
// Uses Node.js built-in test runner: node --test hooks/gsd-context-monitor.test.js
//
// Spawns the hook as a child process with mock stdin JSON payloads.
// Verifies threshold logic, additionalContext injection, and fail-open behavior.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'gsd-context-monitor.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), 'qgsd-cm-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runHook(payload, cwd) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(payload),
    cwd: cwd || os.tmpdir(),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
    parsed: (() => { try { return JSON.parse(result.stdout); } catch { return null; } })(),
  };
}

function writeQgsdConfig(dir, config) {
  const claudeDir = path.join(dir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'qgsd.json'), JSON.stringify(config), 'utf8');
}

// ─── Below-threshold tests ────────────────────────────────────────────────────

test('below warn threshold: exits 0 with no stdout', () => {
  const { exitCode, stdout } = runHook({
    context_window: { remaining_percentage: 40 }, // used = 60%, below default 70%
    cwd: os.tmpdir(),
  });
  assert.equal(exitCode, 0);
  assert.equal(stdout, '', 'No output when below threshold');
});

test('exactly at warn boundary (used = 70%): emits WARNING', () => {
  const { exitCode, parsed } = runHook({
    context_window: { remaining_percentage: 30 }, // used = 70%
    cwd: os.tmpdir(),
  });
  assert.equal(exitCode, 0);
  assert.ok(parsed, 'should emit JSON');
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes('WARNING'));
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes('70%'));
});

test('above warn threshold (used = 80%): emits WARNING message', () => {
  const { exitCode, parsed } = runHook({
    context_window: { remaining_percentage: 20 }, // used = 80%
    cwd: os.tmpdir(),
  });
  assert.equal(exitCode, 0);
  assert.ok(parsed);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes('WARNING'), 'Should be WARNING not CRITICAL at 80%');
  assert.ok(!ctx.includes('CRITICAL'), 'Should not be CRITICAL at 80%');
  assert.ok(ctx.includes('/qgsd:pause-work'), 'Should mention pause-work');
});

// ─── Critical threshold tests ─────────────────────────────────────────────────

test('at critical threshold (used = 90%): emits CRITICAL message', () => {
  const { exitCode, parsed } = runHook({
    context_window: { remaining_percentage: 10 }, // used = 90%
    cwd: os.tmpdir(),
  });
  assert.equal(exitCode, 0);
  assert.ok(parsed);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes('CRITICAL'), 'Should be CRITICAL at 90%');
  assert.ok(ctx.includes('STOP'), 'Should instruct to stop');
});

test('above critical threshold (used = 95%): emits CRITICAL', () => {
  const { exitCode, parsed } = runHook({
    context_window: { remaining_percentage: 5 }, // used = 95%
    cwd: os.tmpdir(),
  });
  assert.equal(exitCode, 0);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes('CRITICAL'));
  assert.ok(ctx.includes('95%'));
});

// ─── Fail-open tests ──────────────────────────────────────────────────────────

test('missing context_window field: exits 0, no output', () => {
  const { exitCode, stdout } = runHook({ tool_name: 'Read', cwd: os.tmpdir() });
  assert.equal(exitCode, 0);
  assert.equal(stdout, '');
});

test('null remaining_percentage: exits 0, no output', () => {
  const { exitCode, stdout } = runHook({
    context_window: { remaining_percentage: null },
    cwd: os.tmpdir(),
  });
  assert.equal(exitCode, 0);
  assert.equal(stdout, '');
});

test('invalid JSON stdin: exits 0 (fail-open)', () => {
  const result = spawnSync('node', [HOOK_PATH], {
    input: 'not json {{{',
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 0);
});

test('empty stdin: exits 0 (fail-open)', () => {
  const result = spawnSync('node', [HOOK_PATH], {
    input: '',
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 0);
});

// ─── Custom threshold tests ───────────────────────────────────────────────────

test('custom warn_pct=50 in config: warns at 55% used', () => {
  const tmpDir = makeTmpDir();
  writeQgsdConfig(tmpDir, { context_monitor: { warn_pct: 50, critical_pct: 90 } });

  const { parsed } = runHook({
    context_window: { remaining_percentage: 45 }, // used = 55%
    cwd: tmpDir,
  });
  assert.ok(parsed, 'Should emit output with custom lower threshold');
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes('WARNING'));
});

test('custom critical_pct=80 in config: CRITICAL at 85% used', () => {
  const tmpDir = makeTmpDir();
  writeQgsdConfig(tmpDir, { context_monitor: { warn_pct: 70, critical_pct: 80 } });

  const { parsed } = runHook({
    context_window: { remaining_percentage: 15 }, // used = 85%
    cwd: tmpDir,
  });
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes('CRITICAL'));
});

test('custom thresholds: below custom warn_pct=80 → no output', () => {
  const tmpDir = makeTmpDir();
  writeQgsdConfig(tmpDir, { context_monitor: { warn_pct: 80, critical_pct: 95 } });

  const { stdout } = runHook({
    context_window: { remaining_percentage: 25 }, // used = 75%, below custom 80%
    cwd: tmpDir,
  });
  assert.equal(stdout, '', 'No output when below custom threshold');
});
