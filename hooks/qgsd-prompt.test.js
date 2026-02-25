#!/usr/bin/env node
// Test suite for hooks/qgsd-prompt.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-prompt.test.js
//
// Each test spawns the hook as a child process with mock stdin.
// The hook reads JSON from stdin and writes JSON to stdout.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-prompt.js');

// Helper: run the hook with a given stdin payload, return { stdout, stderr, exitCode }
function runHook(stdinPayload, extraEnv) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: typeof stdinPayload === 'string' ? stdinPayload : JSON.stringify(stdinPayload),
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

// TC1: non-planning command exits 0 with no stdout output
// /qgsd:execute-phase is NOT in default quorum_commands → silent pass
test('TC1: non-planning command (/qgsd:execute-phase) exits 0 with no stdout', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/qgsd:execute-phase',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.strictEqual(stdout, '', 'stdout must be empty for non-planning command');
});

// TC2: planning command triggers quorum injection
// /qgsd:plan-phase is in quorum_commands → should inject additionalContext with "QUORUM REQUIRED"
test('TC2: planning command (/qgsd:plan-phase) triggers quorum injection', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/qgsd:plan-phase 03-auth',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.length > 0, 'stdout must contain quorum injection JSON');
  const parsed = JSON.parse(stdout);
  assert.ok(parsed.hookSpecificOutput, 'output must have hookSpecificOutput');
  assert.ok(
    parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
    'additionalContext must include "QUORUM REQUIRED"'
  );
});

// TC3: /gsd:plan-phase (GSD prefix) also triggers injection
// The hook accepts both /gsd: and /qgsd: prefixes via the ^\\s*\\/q?gsd: pattern
test('TC3: /gsd:plan-phase (GSD prefix) also triggers quorum injection', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/gsd:plan-phase 03-auth',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.length > 0, 'stdout must contain quorum injection JSON');
  const parsed = JSON.parse(stdout);
  assert.ok(
    parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
    'additionalContext must include "QUORUM REQUIRED"'
  );
});

// TC4: /qgsd:research-phase triggers injection
test('TC4: /qgsd:research-phase triggers quorum injection', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/qgsd:research-phase',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.length > 0, 'stdout must contain quorum injection JSON');
  const parsed = JSON.parse(stdout);
  assert.ok(
    parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
    'additionalContext must include "QUORUM REQUIRED"'
  );
});

// TC5: /qgsd:verify-work triggers injection
test('TC5: /qgsd:verify-work triggers quorum injection', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/qgsd:verify-work',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.length > 0, 'stdout must contain quorum injection JSON');
  const parsed = JSON.parse(stdout);
  assert.ok(
    parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
    'additionalContext must include "QUORUM REQUIRED"'
  );
});

// TC6: /qgsd:discuss-phase triggers injection
test('TC6: /qgsd:discuss-phase triggers quorum injection', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/qgsd:discuss-phase',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.ok(stdout.length > 0, 'stdout must contain quorum injection JSON');
  const parsed = JSON.parse(stdout);
  assert.ok(
    parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
    'additionalContext must include "QUORUM REQUIRED"'
  );
});

// TC7: malformed JSON stdin exits 0 with no output (fail-open)
test('TC7: malformed JSON stdin exits 0 with no output (fail-open)', () => {
  const { stdout, exitCode } = runHook('not json');
  assert.strictEqual(exitCode, 0, 'exit code must be 0 — fail-open on malformed input');
  assert.strictEqual(stdout, '', 'stdout must be empty — fail-open produces no output');
});

// TC8: prefix boundary — /qgsd:plan-phase-extra does NOT trigger (trailing non-space after command)
// The regex uses (\s|$) word boundary, so "plan-phase-extra" must not match "plan-phase"
test('TC8: /qgsd:plan-phase-extra does NOT trigger injection (word boundary enforced)', () => {
  const { stdout, exitCode } = runHook({
    prompt: '/qgsd:plan-phase-extra something',
    cwd: process.cwd(),
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.strictEqual(stdout, '', 'stdout must be empty — word boundary prevents false match');
});

// TC9: circuit breaker active in temp dir → injects resolution context
// Creates a temp git repo with .claude/circuit-breaker-state.json { active: true }
test('TC9: circuit breaker active → injects CIRCUIT BREAKER ACTIVE context', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-tc9-'));
  try {
    // Init git repo so isBreakerActive can find the git root
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });

    // Write circuit breaker state file
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'circuit-breaker-state.json'),
      JSON.stringify({ active: true }),
      'utf8'
    );

    const { stdout, exitCode } = runHook({
      prompt: '/qgsd:execute-phase',
      cwd: tempDir,
    });

    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.length > 0, 'stdout must contain circuit breaker injection JSON');
    const parsed = JSON.parse(stdout);
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes('CIRCUIT BREAKER ACTIVE'),
      'additionalContext must include "CIRCUIT BREAKER ACTIVE"'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC11: activeSlots path — instructions use Task dispatch syntax, not direct MCP calls
// When quorum_active is configured, the step list must contain qgsd-quorum-slot-worker Tasks
// and must NOT contain mcp__*__* tool names (the escape hatch must be absent).
test('TC11: activeSlots path uses Task dispatch syntax (not direct MCP calls)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-tc11-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    assert.ok(
      ctx.includes('qgsd-quorum-slot-worker'),
      'instructions must contain qgsd-quorum-slot-worker Task dispatch syntax'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC12: activeSlots path — no mcp__*__* tool names in injected instructions
// The escape hatch "fall back to direct MCP calls" must be absent entirely.
test('TC12: activeSlots path has no mcp__*__* tool names in instructions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-tc12-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    // The escape hatch was "fall back to direct MCP calls" + a step list of "Call mcp__X__Y".
    // The NEVER directive legitimately contains "mcp__*__*" as a warning, so we test for
    // the actual escape hatch phrases, not a generic mcp__ regex.
    assert.ok(
      !ctx.includes('fall back to direct MCP calls'),
      'instructions must NOT contain the fallback escape hatch phrase'
    );
    assert.ok(
      !(/\bCall mcp__[a-z]/.test(ctx)),
      'instructions must NOT contain "Call mcp__<slot>" step lines'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC13: activeSlots path — model_preferences override block is suppressed
// Even when model_preferences is configured, mcp__*__* names must not appear
// (the !activeSlots guard must prevent the AGENT_TOOL_MAP block from running).
test('TC13: activeSlots path suppresses model_preferences override (no mcp__ leak)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-tc13-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['codex-1', 'gemini-1'],
        model_preferences: { 'codex-1': 'gpt-5-turbo' },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    // The AGENT_TOOL_MAP block generates "When calling mcp__<slot>__<tool>, include model=..."
    // This must not appear when activeSlots is configured.
    assert.ok(
      !(/When calling mcp__[a-z]/.test(ctx)),
      'model_preferences override block must not inject "When calling mcp__<slot>" when activeSlots is configured'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC10: circuit breaker disabled flag → does NOT inject resolution context
// Same temp dir setup but state = { active: true, disabled: true }
test('TC10: circuit breaker disabled flag → no injection (silent pass)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-tc10-'));
  try {
    // Init git repo
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });

    // Write circuit breaker state with disabled: true
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'circuit-breaker-state.json'),
      JSON.stringify({ active: true, disabled: true }),
      'utf8'
    );

    const { stdout, exitCode } = runHook({
      prompt: '/qgsd:execute-phase',
      cwd: tempDir,
    });

    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — disabled breaker produces no injection');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
