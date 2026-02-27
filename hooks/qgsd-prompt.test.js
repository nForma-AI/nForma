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

// TC-PROMPT-N-CAP: --n 3 caps injected slot list to N-1=2 external slots
test('TC-PROMPT-N-CAP: --n 3 caps injected slot list to N-1=2 external slots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-nc-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1', 'claude-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase --n 3', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    // Must announce the override
    assert.ok(ctx.includes('QUORUM SIZE OVERRIDE (--n 3)'), 'must announce --n 3 override');
    // Must cap to 2 numbered step Task lines (N-1 = 2). Regex matches numbered steps, not header prose.
    const taskLineCount = (ctx.match(/\d+\. Task\(subagent_type="qgsd-quorum-slot-worker"/g) || []).length;
    assert.strictEqual(taskLineCount, 2, '--n 3 must produce exactly 2 slot-worker Task lines (N-1=2)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-SOLO: --n 1 injects SOLO MODE ACTIVE, no Task slot lines
test('TC-PROMPT-SOLO: --n 1 injects SOLO MODE ACTIVE, no Task slot lines', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-solo-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase --n 1', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('SOLO MODE ACTIVE (--n 1)'), 'must inject SOLO MODE ACTIVE marker');
    assert.ok(ctx.includes('<!-- QGSD_SOLO_MODE -->'), 'must include QGSD_SOLO_MODE XML comment');
    const taskLineCount = (ctx.match(/\d+\. Task\(subagent_type="qgsd-quorum-slot-worker"/g) || []).length;
    assert.strictEqual(taskLineCount, 0, '--n 1 solo mode must produce zero slot-worker Task lines');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-PREFER-SUB-DEFAULT: no preferSub config → defaults true, sub slots appear before api slots
test('TC-PROMPT-PREFER-SUB-DEFAULT: no preferSub config → defaults true, sub slots appear before api slots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-psub-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // sub-1 listed AFTER api-1 in quorum_active — default preferSub must reorder
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['api-slot-1', 'sub-slot-1'],
        agent_config: {
          'api-slot-1': { auth_type: 'api' },
          'sub-slot-1': { auth_type: 'sub' },
        },
        // No quorum.preferSub key → defaults to true
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    const subPos = ctx.indexOf('sub-slot-1');
    const apiPos = ctx.indexOf('api-slot-1');
    assert.ok(subPos !== -1, 'sub-slot-1 must appear in step list');
    assert.ok(apiPos !== -1, 'api-slot-1 must appear in step list');
    assert.ok(subPos < apiPos, 'sub slot must appear before api slot (preferSub default=true)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FAILOVER-RULE: injected context must instruct Claude to skip UNAVAIL slots.
// This is the runtime bridge that determines polledCount in QGSDQuorum.tla: Claude
// follows these injected instructions to skip unresponsive slot-workers, reducing
// polledCount from MaxSize to however many slots actually responded.
test('TC-PROMPT-FAILOVER-RULE: injected context includes skip-if-UNAVAIL failover rule', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-fr-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['gemini-1', 'opencode-1', 'copilot-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    // Two variants: simple "Failover rule: ...skip..." or structured "SLOT DISPATCH SEQUENCE (FALLBACK-01)..."
    // Both must reference UNAVAIL and contain "skip" (skip individual unavail slots or skip to next step).
    assert.ok(
      ctx.includes('Failover rule') || ctx.includes('SLOT DISPATCH SEQUENCE'),
      'injected context must contain a failover rule (simple or FALLBACK-01 structured)'
    );
    assert.ok(ctx.includes('UNAVAIL'), 'failover rule must reference UNAVAIL state');
    // Both variants instruct to "skip" unavail slots (simple: "skip it"; structured: "skip UNAVAIL").
    assert.ok(ctx.includes('skip'), 'failover rule must instruct to skip unresponsive slots');
    // Verify the rule explicitly says errors do not count toward the required total,
    // confirming that a failed slot does not reduce the consensus threshold.
    assert.ok(
      ctx.includes('do not count toward'),
      'failover rule must state that errors do not count toward required total'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FALLBACK-T1-PRIORITY: when sub-CLI slots exceed the fan-out cap, the injected
// instructions must name the unused sub-CLI slots (T1) in the Failover rule before any
// ccr/api slots (T2). This regression test prevents the bug where both primary slots
// (codex-1, gemini-1) were UNAVAIL and the fallback jumped directly to claude-1/claude-2
// instead of trying opencode-1 and copilot-1 first.
test('TC-PROMPT-FALLBACK-T1-PRIORITY: unused sub-CLI slots listed as T1 before ccr in Failover rule', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-t1-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // 4 sub slots, maxSize=3 → externalSlotCap=2 → 2 are dispatched, 2 are T1 unused
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'],
        quorum: { maxSize: 3 },
        agent_config: {
          'codex-1':    { auth_type: 'sub' },
          'gemini-1':   { auth_type: 'sub' },
          'opencode-1': { auth_type: 'sub' },
          'copilot-1':  { auth_type: 'sub' },
        },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    // Must use the FALLBACK-01 tiered rule, not the simple skip rule
    assert.ok(ctx.includes('FALLBACK-01'), 'Must use tiered FALLBACK-01 rule when T1 slots are unused');

    // T1 unused slots (opencode-1, copilot-1) must be named explicitly in the failover rule
    assert.ok(ctx.includes('opencode-1'), 'T1 unused slot opencode-1 must appear in failover rule');
    assert.ok(ctx.includes('copilot-1'), 'T1 unused slot copilot-1 must appear in failover rule');

    // The dispatched steps (1., 2.) must only contain the first 2 capped sub slots
    const dispatchedSlots = [...ctx.matchAll(/\d+\. Task\(subagent_type="qgsd-quorum-slot-worker", prompt="slot: (\S+)\\n/g)]
      .map(m => m[1]);
    assert.equal(dispatchedSlots.length, 2, 'Exactly 2 slots should be in the dispatch list (externalSlotCap=2)');
    assert.ok(!dispatchedSlots.includes('opencode-1'), 'opencode-1 should NOT be in initial dispatch (it is T1 unused)');
    assert.ok(!dispatchedSlots.includes('copilot-1'), 'copilot-1 should NOT be in initial dispatch (it is T1 unused)');

    // T1 step must appear BEFORE T2 step in the structured dispatch sequence
    const t1Pos = ctx.indexOf('Step 2 T1');
    const t2Pos = ctx.indexOf('Step 3 T2');
    assert.ok(t1Pos !== -1, 'Step 2 T1 label must appear in the structured sequence');
    assert.ok(t2Pos !== -1, 'Step 3 T2 label must appear in the structured sequence');
    assert.ok(t1Pos < t2Pos, 'T1 tier (Step 2) must appear before T2 tier (Step 3)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FALLBACK-ROUTINE: FAN_OUT_COUNT=2 (routine risk, 1 external slot) leaves 3 sub
// slots unused as T1. The structured sequence must name all 3 in Step 2.
test('TC-PROMPT-FALLBACK-ROUTINE: routine risk_level → FAN_OUT_COUNT=2, 3 T1 slots in sequence', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-routine-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'],
        quorum: { maxSize: 5 },
        agent_config: {
          'codex-1':    { auth_type: 'sub' },
          'gemini-1':   { auth_type: 'sub' },
          'opencode-1': { auth_type: 'sub' },
          'copilot-1':  { auth_type: 'sub' },
        },
      }),
      'utf8'
    );
    // Simulate routine risk_level via context_yaml in the hook payload
    const payload = {
      prompt: '/qgsd:plan-phase',
      cwd: tempDir,
      context_yaml: 'risk_level: routine\n',
    };
    const { stdout } = runHook(payload);
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    // FAN_OUT_COUNT=2 → externalSlotCap=1 → 1 primary, 3 T1 unused
    assert.ok(ctx.includes('FALLBACK-01'), 'Must use FALLBACK-01 when T1 slots exist');
    const dispatchedSlots = [...ctx.matchAll(/\d+\. Task\(subagent_type="qgsd-quorum-slot-worker", prompt="slot: (\S+)\\n/g)]
      .map(m => m[1]);
    assert.equal(dispatchedSlots.length, 1, 'Only 1 external slot dispatched for routine risk');

    // The 3 unused sub slots must appear in Step 2 T1 line
    assert.ok(ctx.includes('Step 2 T1 sub-CLI'), 'Step 2 T1 label must appear in sequence');
    const t1LineMatch = ctx.match(/Step 2 T1 sub-CLI:\s+\[([^\]]+)\]/);
    assert.ok(t1LineMatch, 'Step 2 T1 must list slots in brackets');
    const t1Slots = t1LineMatch[1].split(',').map(s => s.trim());
    assert.equal(t1Slots.length, 3, 'Step 2 T1 must have 3 unused slots');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FALLBACK-NO-T1: all sub slots fit within the cap → no T1 unused → simple rule.
test('TC-PROMPT-FALLBACK-NO-T1: all sub slots dispatched → no FALLBACK-01, simple rule', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-not1-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // 2 sub slots, maxSize=5 → externalSlotCap=4 → both sub slots fit, no T1 unused
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['gemini-1', 'opencode-1'],
        quorum: { maxSize: 5 },
        agent_config: {
          'gemini-1':   { auth_type: 'sub' },
          'opencode-1': { auth_type: 'sub' },
        },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    // No T1 unused → should NOT emit FALLBACK-01 or Step 2 T1
    assert.ok(!ctx.includes('FALLBACK-01'), 'Must NOT use FALLBACK-01 when all sub slots are dispatched');
    assert.ok(!ctx.includes('Step 2 T1'), 'Must NOT emit Step 2 T1 when no T1 slots exist');
    // Should use the simple failover rule
    assert.ok(ctx.includes('Failover rule'), 'Simple Failover rule must appear');
    assert.ok(ctx.includes('do not count toward'), 'Must still state errors don\'t count');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FALLBACK-T1-EXCLUDES-PRIMARIES: T1 list must not include slots already dispatched.
// Regression: if opencode-1 is in the primary dispatch, it must not also appear in Step 2 T1.
test('TC-PROMPT-FALLBACK-T1-EXCLUDES-PRIMARIES: T1 list excludes slots already in primary dispatch', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-excl-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // 4 sub slots, maxSize=4 → externalSlotCap=3 → 3 dispatched, 1 T1 unused (copilot-1)
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'],
        quorum: { maxSize: 4 },
        agent_config: {
          'codex-1':    { auth_type: 'sub' },
          'gemini-1':   { auth_type: 'sub' },
          'opencode-1': { auth_type: 'sub' },
          'copilot-1':  { auth_type: 'sub' },
        },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    assert.ok(ctx.includes('FALLBACK-01'), 'FALLBACK-01 must fire (1 T1 unused)');

    // The dispatched primary slots (Step 1) must NOT appear in the T1 line (Step 2)
    const t1LineMatch = ctx.match(/Step 2 T1 sub-CLI:\s+\[([^\]]+)\]/);
    assert.ok(t1LineMatch, 'Step 2 T1 must list slots');
    const t1Slots = new Set(t1LineMatch[1].split(',').map(s => s.trim()));

    const primaryLineMatch = ctx.match(/Step 1 PRIMARY:\s+\[([^\]]+)\]/);
    assert.ok(primaryLineMatch, 'Step 1 PRIMARY must list slots');
    const primarySlots = primaryLineMatch[1].split(',').map(s => s.trim());

    for (const primary of primarySlots) {
      assert.ok(!t1Slots.has(primary), `Primary slot "${primary}" must NOT appear in T1 list`);
    }
    // Only copilot-1 should be in T1
    assert.deepEqual([...t1Slots], ['copilot-1']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
