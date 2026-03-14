#!/usr/bin/env node
// Test suite for hooks/nf-prompt.js
// Uses Node.js built-in test runner: node --test hooks/nf-prompt.test.js
//
// Each test spawns the hook as a child process with mock stdin.
// The hook reads JSON from stdin and writes JSON to stdout.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'nf-prompt.js');

// Helper: run the hook with a given stdin payload, return { stdout, stderr, exitCode }
// When the payload contains a `cwd` field, HOME is overridden to the cwd so that
// the hook's loadConfig reads only the project-level nf.json (no global config leak).
// NF_SKIP_PREFLIGHT=1 is set by default to bypass quorum-preflight.cjs CLI probes and
// keep tests fast. Pass { NF_SKIP_PREFLIGHT: '0' } in extraEnv to test the preflight path.
function runHook(stdinPayload, extraEnv) {
  const payload = typeof stdinPayload === 'string' ? stdinPayload : JSON.stringify(stdinPayload);
  const cwdFromPayload = typeof stdinPayload === 'object' && stdinPayload.cwd;
  const env = { ...process.env, NF_SKIP_PREFLIGHT: '1', ...(extraEnv || {}) };
  if (cwdFromPayload) {
    env.HOME = cwdFromPayload; // isolate from ~/.claude/nf.json
  }
  const result = spawnSync('node', [HOOK_PATH], {
    input: payload,
    encoding: 'utf8',
    timeout: 5000,
    env,
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-tc9-'));
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
// When quorum_active is configured, the step list must contain nf-quorum-slot-worker Tasks
// and must NOT contain mcp__*__* tool names (the escape hatch must be absent).
test('TC11: activeSlots path uses Task dispatch syntax (not direct MCP calls)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-tc11-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    assert.ok(
      ctx.includes('nf-quorum-slot-worker'),
      'instructions must contain nf-quorum-slot-worker Task dispatch syntax'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC12: activeSlots path — no mcp__*__* tool names in injected instructions
// The escape hatch "fall back to direct MCP calls" must be absent entirely.
test('TC12: activeSlots path has no mcp__*__* tool names in instructions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-tc12-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-tc13-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-tc10-'));
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-nc-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1', 'claude-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase --n 3', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    // Must announce the override
    assert.ok(ctx.includes('--n 3') && ctx.includes('QUORUM REQUIRED'), 'must announce --n 3 override in QUORUM REQUIRED header');
    // Must cap to 2 numbered step Task lines (N-1 = 2). Regex matches numbered steps, not header prose.
    const taskLineCount = (ctx.match(/\d+\. Task\(subagent_type="nf-quorum-slot-worker"/g) || []).length;
    assert.strictEqual(taskLineCount, 2, '--n 3 must produce exactly 2 slot-worker Task lines (N-1=2)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-SOLO: --n 1 injects SOLO MODE ACTIVE, no Task slot lines
test('TC-PROMPT-SOLO: --n 1 injects SOLO MODE ACTIVE, no Task slot lines', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-solo-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase --n 1', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('SOLO MODE ACTIVE (--n 1)'), 'must inject SOLO MODE ACTIVE marker');
    assert.ok(ctx.includes('<!-- NF_SOLO_MODE -->'), 'must include NF_SOLO_MODE XML comment');
    const taskLineCount = (ctx.match(/\d+\. Task\(subagent_type="nf-quorum-slot-worker"/g) || []).length;
    assert.strictEqual(taskLineCount, 0, '--n 1 solo mode must produce zero slot-worker Task lines');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-PREFER-SUB-DEFAULT: no preferSub config → defaults true, sub slots appear before api slots
test('TC-PROMPT-PREFER-SUB-DEFAULT: preferSub=true reorders sub slots before api slots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-psub-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // sub-1 listed AFTER api-1 in quorum_active — preferSub must reorder
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({
        quorum_active: ['api-slot-1', 'sub-slot-1'],
        agent_config: {
          'api-slot-1': { auth_type: 'api' },
          'sub-slot-1': { auth_type: 'sub' },
        },
        quorum: { preferSub: true },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    const subPos = ctx.indexOf('sub-slot-1');
    const apiPos = ctx.indexOf('api-slot-1');
    assert.ok(subPos !== -1, 'sub-slot-1 must appear in step list');
    assert.ok(apiPos !== -1, 'api-slot-1 must appear in step list');
    assert.ok(subPos < apiPos, 'sub slot must appear before api slot (preferSub=true)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FAILOVER-RULE: injected context must instruct Claude to skip UNAVAIL slots.
// This is the runtime bridge that determines polledCount in NFQuorum.tla: Claude
// follows these injected instructions to skip unresponsive slot-workers, reducing
// polledCount from MaxSize to however many slots actually responded.
test('TC-PROMPT-FAILOVER-RULE: injected context includes skip-if-UNAVAIL failover rule', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-fr-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-t1-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // 4 sub slots, maxSize=3 → externalSlotCap=2 → 2 are dispatched, 2 are T1 unused
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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
    const dispatchedSlots = [...ctx.matchAll(/\d+\. Task\(subagent_type="nf-quorum-slot-worker", prompt="slot: (\S+)\\n/g)]
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-routine-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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
    const dispatchedSlots = [...ctx.matchAll(/\d+\. Task\(subagent_type="nf-quorum-slot-worker", prompt="slot: (\S+)\\n/g)]
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-not1-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // 2 sub slots, maxSize=5 → externalSlotCap=4 → both sub slots fit, no T1 unused
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-excl-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // 4 sub slots, maxSize=4 → externalSlotCap=3 → 3 dispatched, 1 T1 unused (copilot-1)
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
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

// TC-PROMPT-FALLBACK-AUTHTYPE-DYNAMIC: T1/T2 classification must be driven by runtime auth_type,
// NOT by slot naming convention. A "ccr" named slot with auth_type=sub must land in T1;
// a "native CLI" named slot with auth_type=api must land in T2.
test('TC-PROMPT-FALLBACK-AUTHTYPE-DYNAMIC: T1/T2 classification driven by auth_type, not slot name', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-authtype-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // Non-standard config: claude-1 (typically T2 name) → auth_type=sub (→ T1)
    //                      codex-1 (typically T1 name) → auth_type=api (→ T2)
    // maxSize=3 → externalSlotCap=2 → dispatch gemini-1 + claude-1 (ordered by sub-first preference)
    // T1 unused = sub slots not in dispatch: none extra sub here
    // Actually: orderedSlots = sub-first: gemini-1(sub), claude-1(sub), codex-1(api)
    // cappedSlots (externalSlotCap=2) = [gemini-1, claude-1]
    // T1_UNUSED = sub slots not in capped = [] (both sub slots are dispatched)
    // T2 = [codex-1] (api)
    // Result: no FALLBACK-01, simple Failover rule (no T1 unused)
    //
    // Better scenario for the test: add a third sub slot to ensure T1 unused exists.
    // quorum_active: [gemini-1(sub), claude-1(sub), claude-2(sub), codex-1(api)]
    // maxSize=3 → externalSlotCap=2 → dispatch [gemini-1, claude-1]
    // T1_UNUSED = [claude-2] (sub, not dispatched)
    // T2 = [codex-1] (api)
    // FALLBACK-01 must fire with claude-2 in Step 2 T1 and codex-1 in Step 3 T2
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({
        quorum_active: ['gemini-1', 'claude-1', 'claude-2', 'codex-1'],
        quorum: { maxSize: 3 },
        agent_config: {
          'gemini-1': { auth_type: 'sub' },
          'claude-1': { auth_type: 'sub' },  // normally api — overridden to sub
          'claude-2': { auth_type: 'sub' },  // normally api — overridden to sub
          'codex-1':  { auth_type: 'api' },  // normally sub — overridden to api
        },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    // FALLBACK-01 must fire — claude-2 is an unused sub slot
    assert.ok(ctx.includes('FALLBACK-01'), 'FALLBACK-01 must fire when unused sub slot (claude-2) exists');

    // claude-2 is sub but not dispatched → must appear in Step 2 T1
    const t1LineMatch = ctx.match(/Step 2 T1 sub-CLI:\s+\[([^\]]+)\]/);
    assert.ok(t1LineMatch, 'Step 2 T1 must list slots');
    const t1Slots = t1LineMatch[1].split(',').map(s => s.trim());
    assert.ok(t1Slots.includes('claude-2'), 'claude-2 (auth_type=sub) must appear in T1 despite its "ccr" name');

    // codex-1 is api → must appear in Step 3 T2, NOT in Step 2 T1
    assert.ok(!t1Slots.includes('codex-1'), 'codex-1 (auth_type=api) must NOT appear in T1 despite its "native CLI" name');
    const t2LineMatch = ctx.match(/Step 3 T2 ccr:\s+\[([^\]]+)\]/);
    assert.ok(t2LineMatch, 'Step 3 T2 must list slots');
    const t2Slots = t2LineMatch[1].split(',').map(s => s.trim());
    assert.ok(t2Slots.includes('codex-1'), 'codex-1 (auth_type=api) must appear in T2 despite its "native CLI" name');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FALLBACK-T2-EXCLUDES-PRIMARIES: an api slot dispatched as primary must NOT
// appear in Step 3 T2. Regression for the bug where t2Slots filtered all non-sub slots
// without excluding cappedSlots, causing primary api slots to appear in both Step 1 and Step 3.
test('TC-PROMPT-FALLBACK-T2-EXCLUDES-PRIMARIES: api slots dispatched as primary excluded from T2 list', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-t2excl-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // Config: api-slot-A dispatched as primary (externalSlotCap=1); sub-slot-B is T1 unused;
    // api-slot-C is the only genuine T2. api-slot-A must NOT appear in T2.
    // quorum_active: ['api-slot-A', 'sub-slot-B', 'api-slot-C']
    // preferSub: false → orderedSlots order preserved: api-slot-A, sub-slot-B, api-slot-C
    // maxSize=2 → externalSlotCap=1 → cappedSlots=[api-slot-A]
    // t1Unused = sub slots not in capped = [sub-slot-B]
    // t2Slots (correct) = api slots not in capped = [api-slot-C]   (excludes api-slot-A)
    // t2Slots (buggy)   = all api slots           = [api-slot-A, api-slot-C]  (includes primary!)
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({
        quorum_active: ['api-slot-A', 'sub-slot-B', 'api-slot-C'],
        quorum: { maxSize: 2, preferSub: false },
        agent_config: {
          'api-slot-A': { auth_type: 'api' },
          'sub-slot-B': { auth_type: 'sub' },
          'api-slot-C': { auth_type: 'api' },
        },
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    assert.ok(ctx.includes('FALLBACK-01'), 'FALLBACK-01 must fire (sub-slot-B is T1 unused)');

    const t2LineMatch = ctx.match(/Step 3 T2 ccr:\s+\[([^\]]+)\]/);
    assert.ok(t2LineMatch, 'Step 3 T2 must be present');
    const t2Slots = t2LineMatch[1].split(',').map(s => s.trim());

    assert.ok(!t2Slots.includes('api-slot-A'), 'api-slot-A is primary — must NOT appear in Step 3 T2');
    assert.ok(t2Slots.includes('api-slot-C'), 'api-slot-C is the only genuine T2 slot');

    const primaryLineMatch = ctx.match(/Step 1 PRIMARY:\s+\[([^\]]+)\]/);
    assert.ok(primaryLineMatch, 'Step 1 PRIMARY must be present');
    const primarySlots = primaryLineMatch[1].split(',').map(s => s.trim());
    assert.ok(primarySlots.includes('api-slot-A'), 'api-slot-A must appear in Step 1 PRIMARY');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG: when agent_config is {} (empty), all slots
// default to auth_type='api'. With maxSize high enough to fit all slots, t1Unused
// is empty AND no T2 overflow → simple failover rule, no FALLBACK-01.
// The test verifies: (a) no FALLBACK-01 label appears, (b) the simple failover rule
// IS present, (c) dispatched slot names appear in Task() lines.
test('TC-PROMPT-FALLBACK-EMPTY-AGENTCONFIG: empty agent_config → no T1, simple failover rule', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-emptyac-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // quorum_active set with known slots but agent_config is empty {}
    // All slots default to auth_type='api' — no sub slots → no T1 unused
    // maxSize=5 ensures all 4 slots fit within the cap (no T2 overflow)
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({
        quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'],
        quorum: { maxSize: 5 },
        agent_config: {},
      }),
      'utf8'
    );
    const { stdout, exitCode } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.length > 0, 'stdout must contain quorum injection');

    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;

    // (a) No FALLBACK-01 — all api slots fit within fan-out cap, no overflow
    assert.ok(!ctx.includes('FALLBACK-01'), 'Must NOT use FALLBACK-01 when all slots fit (no T1/T2 overflow)');

    // (b) Simple failover rule must be present
    assert.ok(ctx.includes('Failover rule'), 'Simple Failover rule must appear when no fallback tiers exist');
    assert.ok(ctx.includes('do not count toward'), 'Failover rule must state errors do not count');

    // (c) Dispatched slot names must appear in Task() lines
    const taskLines = ctx.match(/Task\(subagent_type="nf-quorum-slot-worker"/g) || [];
    assert.ok(taskLines.length > 0, 'At least one slot-worker Task must be dispatched');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── Profile Guard Tests ─────────────────────────────────────────────────────

// TC-PROFILE-MINIMAL-EXIT: hook_profile=minimal → nf-prompt exits 0 with no output
test('TC-PROFILE-MINIMAL-EXIT: hook_profile=minimal exits 0 with no output', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-profile-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({ hook_profile: 'minimal' }),
      'utf8'
    );

    // A planning command that would normally trigger quorum injection
    const { stdout, exitCode } = runHook({
      prompt: '/nf:plan-phase 03',
      cwd: tempDir,
    });

    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — minimal profile skips nf-prompt entirely');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-STRICT-QUORUM-ON-NON-QUORUM-CMD: hook_profile=strict → /nf:execute-phase gets quorum injection
test('TC-STRICT-QUORUM-ON-NON-QUORUM-CMD: strict mode injects quorum for non-quorum command', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-strict-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({
        hook_profile: 'strict',
        quorum_active: ['codex-1', 'gemini-1'],
      }),
      'utf8'
    );

    // /nf:execute-phase is NOT in default quorum_commands list
    // Strict mode should still inject quorum instructions
    const { stdout, exitCode } = runHook({
      prompt: '/nf:execute-phase 03',
      cwd: tempDir,
    });

    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.ok(stdout.length > 0, 'stdout must contain quorum injection — strict mode matches execute-phase');
    const parsed = JSON.parse(stdout);
    assert.ok(parsed.hookSpecificOutput, 'output must have hookSpecificOutput');
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
      'additionalContext must include "QUORUM REQUIRED" for strict mode'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PREFLIGHT-1: runPreflightFilter fail-open when preflight is bypassed (NF_SKIP_PREFLIGHT=1)
// Verifies that when NF_SKIP_PREFLIGHT=1 (the default in runHook), the hook proceeds
// to normal dispatch without probing or short-circuiting.
test('TC-PREFLIGHT-1: runPreflightFilter fail-open — hook dispatches normally when preflight bypassed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-pf1-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.clone');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'], quorum_commands: ['/nf:plan-phase'] }),
      'utf8'
    );
    // runHook defaults to NF_SKIP_PREFLIGHT=1 — verifies fail-open path dispatches normally
    const { stdout, exitCode } = runHook({ prompt: '/nf:plan-phase test', cwd: tempDir });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 — fail-open path proceeds normally');
    assert.ok(stdout.length > 0, 'stdout must contain dispatch instructions (fail-open dispatches normally)');
    assert.ok(!stdout.includes('NF_ALL_SLOTS_DOWN'), 'fail-open must not produce NF_ALL_SLOTS_DOWN marker');
    const pf1Parsed = JSON.parse(stdout);
    assert.ok(pf1Parsed.hookSpecificOutput, 'output must have hookSpecificOutput');
    assert.ok(
      pf1Parsed.hookSpecificOutput.additionalContext.includes('QUORUM REQUIRED'),
      'fail-open must still inject QUORUM REQUIRED dispatch instructions'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// TC-PREFLIGHT-2: NF_SKIP_PREFLIGHT=0 with real preflight present does not crash
// Ensures that when NF_SKIP_PREFLIGHT is disabled and quorum-preflight.cjs is available,
// the hook completes without crashing (fail-open behavior on probe results).
test('TC-PREFLIGHT-2: NF_SKIP_PREFLIGHT=0 with real preflight present does not crash', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-prompt-pf2-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'nf.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    // Run with NF_SKIP_PREFLIGHT=0 and extended timeout to allow real probe to complete.
    // HOME overridden to tempDir so no global ~/.claude/nf.json is loaded.
    // With an isolated HOME, preflight binary probes will fail (no real CLIs configured),
    // and the hook must fail-open and still emit valid dispatch instructions.
    const payload = JSON.stringify({ prompt: '/nf:plan-phase test', cwd: tempDir });
    const pf2Env = { ...process.env, NF_SKIP_PREFLIGHT: '0', HOME: tempDir };
    const pf2Result = spawnSync('node', [HOOK_PATH], {
      input: payload,
      encoding: 'utf8',
      timeout: 12000, // longer timeout to allow up to 6s preflight probe
      env: pf2Env,
    });
    assert.strictEqual(pf2Result.status, 0, 'exit code must be 0 — fail-open on probe failure or unavail result');
    assert.ok(typeof pf2Result.stdout === 'string', 'stdout must be a string');
    assert.ok(pf2Result.stdout.length > 0, 'stdout must be non-empty (dispatch or all-down message)');
    // Either normal dispatch or NF_ALL_SLOTS_DOWN — both are valid outcomes
    const hasDispatch = pf2Result.stdout.includes('QUORUM REQUIRED') || pf2Result.stdout.includes('NF_ALL_SLOTS_DOWN');
    assert.ok(hasDispatch, 'must emit either QUORUM REQUIRED dispatch or NF_ALL_SLOTS_DOWN message');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
