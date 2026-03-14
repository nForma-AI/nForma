#!/usr/bin/env node
// Test suite for hooks/nf-statusline.js
// Uses Node.js built-in test runner: node --test hooks/nf-statusline.test.js
//
// Each test spawns the hook as a child process with mock stdin (JSON payload).
// Captures stdout + exit code. The hook reads JSON from stdin and writes
// formatted statusline text to stdout.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'nf-statusline.js');

// Helper: run the hook with a given stdin JSON payload and optional extra env vars
function runHook(stdinPayload, extraEnv) {
  const input = typeof stdinPayload === 'string'
    ? stdinPayload
    : JSON.stringify(stdinPayload);

  const result = spawnSync('node', [HOOK_PATH], {
    input,
    encoding: 'utf8',
    timeout: 5000,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// Helper: create a temp directory structure, write a file inside it, return tempDir
function makeTempDir(suffix) {
  const dir = path.join(os.tmpdir(), `nf-sl-test-${Date.now()}-${suffix}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// --- Test Cases ---

// TC1: Minimal payload — stdout contains model name and directory basename
test('TC1: minimal payload includes model name and directory name', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'TestModel' },
    workspace: { current_dir: '/tmp/myproject' },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('TestModel'), 'stdout must include model name "TestModel"');
  assert.ok(stdout.includes('myproject'), 'stdout must include directory basename "myproject"');
});

// TC2: Context at 100% remaining (0% used) → green bar, 0%
// rawUsed = 100 - 100 = 0; scaled = round(0 / 80 * 100) = 0; filled = 0 → all empty blocks
test('TC2: context at 100% remaining shows all-empty bar at 0%', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 100 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('░░░░░░░░░░'), 'stdout must include all-empty bar (0% used)');
  assert.ok(stdout.includes('0%'), 'stdout must include 0%');
});

// TC2b: 85% remaining (15% used) with no current_usage and unknown tier → percentage-only display (no token label)
test('TC2b: 15% used without tier shows percentage-only (no token label)', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M' },
    context_window: { remaining_percentage: 85 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('15%'), 'stdout must include 15%');
  assert.ok(!stdout.match(/\d+K\)/), 'stdout must NOT include token labels like 150K)');
  assert.ok(stdout.includes('\x1b[32m'), 'stdout must include green ANSI code (15% used < 30%)');
});

// TC3: 80% used (20% remaining) with 400K tokens → blinking red (>350K) for 1M context
test('TC3: 80% used with 400K tokens shows blinking red', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M (with 1M context)' },
    context_window: { remaining_percentage: 20, current_usage: { input_tokens: 400000 } },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('80%'), 'stdout must include 80%');
  assert.ok(stdout.includes('400K'), 'stdout must include token count 400K');
  assert.ok(stdout.includes('\x1b[5;31m'), 'stdout must include blinking red ANSI code');
});

// TC4: 49% used (51% remaining) with 50K tokens → green (<100K) for 1M context
test('TC4: 49% used with 50K tokens shows green', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M (with 1M context)' },
    context_window: { remaining_percentage: 51, current_usage: { input_tokens: 50000 } },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('49%'), 'stdout must include 49%');
  assert.ok(stdout.includes('50K'), 'stdout must include token count 50K');
  assert.ok(stdout.includes('\x1b[32m'), 'stdout must include green ANSI code \\x1b[32m');
});

// TC5: 64% used (36% remaining) with 150K tokens → yellow (100K-200K) for 1M context
test('TC5: 64% used with 150K tokens shows yellow', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'M (with 1M context)' },
    context_window: { remaining_percentage: 36, current_usage: { input_tokens: 150000 } },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.includes('64%'), 'stdout must include 64%');
  assert.ok(stdout.includes('150K'), 'stdout must include token count 150K');
  assert.ok(stdout.includes('\x1b[33m'), 'stdout must include yellow ANSI code \\x1b[33m');
});

// TC6: Malformed JSON input → exits 0, stdout is empty (silent fail)
test('TC6: malformed JSON input exits 0 with empty stdout (silent fail)', () => {
  const { stdout, exitCode } = runHook('this is not valid json');
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.strictEqual(stdout, '', 'stdout must be empty on malformed JSON input');
});

// TC7: Update available — output includes '/nf:update'
test('TC7: update available banner shows /nf:update in output', () => {
  const tempHome = makeTempDir('tc7');
  const cacheDir = path.join(tempHome, '.claude', 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, 'nf-update-check.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ update_available: true, latest: '1.0.1' }), 'utf8');

  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' } },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('/nf:update'), 'stdout must include /nf:update when update is available');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

// TC8: Task in progress — output includes the task's activeForm text
test('TC8: in-progress task is shown in statusline output', () => {
  const tempHome = makeTempDir('tc8');
  const todosDir = path.join(tempHome, '.claude', 'todos');
  fs.mkdirSync(todosDir, { recursive: true });

  const sessionId = 'sess123';
  const todosFile = path.join(todosDir, `${sessionId}-agent-0.json`);
  fs.writeFileSync(
    todosFile,
    JSON.stringify([{ status: 'in_progress', activeForm: 'Fix the thing' }]),
    'utf8'
  );

  try {
    const { stdout, exitCode } = runHook(
      { model: { display_name: 'M' }, session_id: sessionId },
      { HOME: tempHome }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.includes('Fix the thing'), 'stdout must include the in-progress task activeForm text');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

// TC9: "200K context detected from display_name scales thresholds correctly"
test('TC9: 200K context detected from display_name scales thresholds correctly', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'Opus 4.6 (200K context)' },
    context_window: { remaining_percentage: 85 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  // 15% used of 200K = 30K estimated tokens
  // 30K is above t1 (20K) but below t2 (40K) → YELLOW
  assert.ok(stdout.includes('15%'), 'stdout must include 15%');
  assert.ok(stdout.includes('30K'), 'stdout must include estimated 30K tokens');
  assert.ok(stdout.includes('\x1b[33m'), 'stdout must include yellow ANSI code');
});

// TC10: "1M context detected from display_name preserves existing thresholds"
test('TC10: 1M context detected from display_name preserves existing thresholds', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'Opus 4.6 (with 1M context)' },
    context_window: { remaining_percentage: 85 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  // 15% used of 1M = 150K estimated tokens → YELLOW (same as old TC2b)
  assert.ok(stdout.includes('15%'), 'stdout must include 15%');
  assert.ok(stdout.includes('150K'), 'stdout must include estimated 150K tokens');
  assert.ok(stdout.includes('\x1b[33m'), 'stdout must include yellow ANSI code');
});

// TC11: "explicit context_window_size takes priority over display_name"
test('TC11: explicit context_window_size takes priority over display_name', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'Opus 4.6 (with 1M context)' },
    context_window: { remaining_percentage: 85, context_window_size: 200000 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  // 15% used of 200K = 30K → YELLOW
  assert.ok(stdout.includes('15%'), 'stdout must include 15%');
  assert.ok(stdout.includes('30K'), 'stdout must include 30K (NOT 150K — proving explicit size wins)');
  assert.ok(stdout.includes('\x1b[33m'), 'stdout must include yellow ANSI code');
});

// TC12: "unknown context tier with no current_usage shows percentage-only (no token label)"
test('TC12: unknown context tier with no current_usage shows percentage-only (no token label)', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'SomeModel' },
    context_window: { remaining_percentage: 85 },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  // No context_window_size, no tier in display_name, no current_usage → tokenLabel is null
  assert.ok(stdout.includes('15%'), 'stdout must include 15%');
  assert.ok(!stdout.match(/\d+K\)/), 'stdout must NOT include token labels like 150K)');
});

// TC13: "200K session with actual token usage uses real tokens for color"
test('TC13: 200K session with actual token usage uses real tokens for color', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'Opus 4.6 (200K context)' },
    context_window: { remaining_percentage: 50, context_window_size: 200000, current_usage: { input_tokens: 80000 } },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  // 80K tokens with 200K context → above t3 (70K) → BLINKING RED
  assert.ok(stdout.includes('80K'), 'stdout must include 80K tokens');
  assert.ok(stdout.includes('\x1b[5;31m'), 'stdout must include blinking red ANSI code');
});

// TC14: "200K session with 15K tokens shows green (below 20K threshold)"
test('TC14: 200K session with 15K tokens shows green (below 20K threshold)', () => {
  const { stdout, exitCode } = runHook({
    model: { display_name: 'Opus 4.6 (200K context)' },
    context_window: { remaining_percentage: 90, current_usage: { input_tokens: 15000 } },
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  // 15K tokens with 200K context → below t1 (20K) → GREEN
  assert.ok(stdout.includes('15K'), 'stdout must include 15K tokens');
  assert.ok(stdout.includes('\x1b[32m'), 'stdout must include green ANSI code');
});
