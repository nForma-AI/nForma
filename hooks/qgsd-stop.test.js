#!/usr/bin/env node
// Test suite for hooks/qgsd-stop.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-stop.test.js
//
// Each test spawns the hook as a child process with mock stdin and a synthetic
// JSONL transcript written to a temp file. Captures stdout + exit code.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-stop.js');

// Helper: write a temp JSONL file and return its path
function writeTempTranscript(lines) {
  const tmpFile = path.join(os.tmpdir(), `qgsd-stop-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(tmpFile, lines.join('\n') + '\n', 'utf8');
  return tmpFile;
}

// Helper: run the hook with a given stdin JSON payload, return { stdout, exitCode }
function runHook(stdinPayload) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// Helper: run the hook with a given stdin JSON payload and additional env vars
// Used for TC11-TC13 to inject QGSD_CLAUDE_JSON for deterministic MCP availability testing
function runHookWithEnv(stdinPayload, extraEnv) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, ...extraEnv },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// JSONL builder helpers
function userLine(content, uuid = 'user-1') {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
    timestamp: '2026-02-20T00:00:00Z',
    uuid,
  });
}

function assistantLine(contentBlocks, uuid = 'assistant-1') {
  return JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: contentBlocks,
      stop_reason: contentBlocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
    },
    timestamp: '2026-02-20T00:01:00Z',
    uuid,
  });
}

function toolUseBlock(name) {
  return { type: 'tool_use', id: `toolu_${name}`, name, input: { content: 'test plan' } };
}

function bashCommitBlock(commitCmd) {
  return { type: 'tool_use', id: 'toolu_bash', name: 'Bash', input: { command: commitCmd } };
}

// --- Test Cases ---

// Test 1: stop_hook_active: true → exit 0, no stdout (infinite loop guard)
test('TC1: stop_hook_active true exits immediately with no output', () => {
  const tmpFile = writeTempTranscript([userLine('/gsd:plan-phase 1')]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: true,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (no block decision)');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 2: hook_event_name SubagentStop → exit 0, no stdout (subagent exclusion)
test('TC2: SubagentStop exits immediately with no output', () => {
  const tmpFile = writeTempTranscript([userLine('/gsd:plan-phase 1')]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'SubagentStop',
      transcript_path: tmpFile,
      last_assistant_message: 'SubagentStop response',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 3: transcript_path nonexistent → exit 0, no stdout (fail-open)
test('TC3: nonexistent transcript_path exits 0 with no output (fail-open)', () => {
  const { stdout, exitCode } = runHook({
    stop_hook_active: false,
    hook_event_name: 'Stop',
    transcript_path: '/nonexistent/path/that/does/not/exist.jsonl',
    last_assistant_message: '',
  });
  assert.strictEqual(exitCode, 0, 'exit code must be 0');
  assert.strictEqual(stdout, '', 'stdout must be empty');
});

// Test 4: transcript with no planning command in current turn → exit 0, no stdout
test('TC4: no planning command in current turn passes (no block)', () => {
  const tmpFile = writeTempTranscript([
    userLine('What time is it?'),
    assistantLine([{ type: 'text', text: 'It is noon.' }]),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'It is noon.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (no block needed)');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 5: /gsd:plan-phase in current turn + all 3 quorum tool_use blocks → exit 0, no stdout
test('TC5: planning command with all three quorum tool calls passes', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1'),
    assistantLine([
      toolUseBlock('mcp__codex-cli__review'),
      toolUseBlock('mcp__gemini-cli__gemini'),
      toolUseBlock('mcp__opencode__opencode'),
    ]),
    assistantLine([{ type: 'text', text: 'Here is the plan.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (quorum complete)');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 5b: /qgsd:plan-phase — quorum present → pass (mirrors TC5 with /qgsd: prefix)
test('TC5b: /qgsd:plan-phase — quorum present → pass', () => {
  const tmpFile = writeTempTranscript([
    userLine('/qgsd:plan-phase 1'),
    assistantLine([
      toolUseBlock('mcp__codex-cli__review'),
      toolUseBlock('mcp__gemini-cli__gemini'),
      toolUseBlock('mcp__opencode__opencode'),
    ]),
    assistantLine([{ type: 'text', text: 'Here is the plan.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — /qgsd: prefix recognized and quorum complete');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 6: /gsd:plan-phase in current turn + only codex tool_use → block with decision:block
// TC6 updated (step 1a): includes a PLAN.md artifact commit so GUARD 5 classifies this as a
// decision turn, preserving the invariant: quorum-command + decision-turn + partial quorum = block.
test('TC6: planning command with only codex tool call triggers block', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1'),
    assistantLine([
      toolUseBlock('mcp__codex-cli__review'),
    ]),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "feat: plan" --files 04-01-PLAN.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'Here is the plan.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 even when blocking');
    assert.ok(stdout.length > 0, 'stdout must contain block decision JSON');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block', 'decision must be "block"');
    assert.ok(parsed.reason.startsWith('QUORUM REQUIRED:'), 'reason must start with QUORUM REQUIRED:');
    // Should name the missing tools
    assert.ok(parsed.reason.includes('mcp__gemini-cli__'), 'reason must name missing gemini tool');
    assert.ok(parsed.reason.includes('mcp__opencode__'), 'reason must name missing opencode tool');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 7: /gsd:plan-phase in OLD turn (before current turn boundary) → exit 0, no stdout (scope filter)
test('TC7: planning command only in old turn (before boundary) is not in scope', () => {
  const tmpFile = writeTempTranscript([
    // Old turn: planning command + assistant response (but no quorum)
    userLine('/gsd:plan-phase 1', 'old-user'),
    assistantLine([{ type: 'text', text: 'Old response, no quorum done.' }], 'old-assistant'),
    // New turn: unrelated user message (this becomes the current turn boundary)
    userLine('Thanks, looks good.', 'new-user'),
    assistantLine([{ type: 'text', text: 'Great!' }], 'new-assistant'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Great!',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (old turn planning not in scope)');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 8: malformed JSONL lines → skip gracefully, hook still works
test('TC8: malformed JSONL lines are skipped gracefully', () => {
  const tmpFile = writeTempTranscript([
    'this is not valid json',
    userLine('/gsd:plan-phase 1'),
    '{broken json: [',
    assistantLine([
      toolUseBlock('mcp__codex-cli__review'),
      toolUseBlock('mcp__gemini-cli__gemini'),
      toolUseBlock('mcp__opencode__opencode'),
    ]),
    'another bad line',
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty (quorum found despite malformed lines)');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 9: config file missing → DEFAULT_CONFIG used, hook still works
// TC9 updated (step 1a): includes a RESEARCH.md artifact commit so GUARD 5 classifies this as a
// decision turn, preserving the invariant: quorum-command + decision-turn + no quorum = block.
test('TC9: missing config file falls back to DEFAULT_CONFIG', () => {
  // This test passes because the hook uses DEFAULT_CONFIG when ~/.claude/qgsd.json is absent.
  // The existing tests already exercise this (no config file written during tests).
  // Explicitly verify: a planning command without quorum gets blocked with default model names.
  const tmpFile = writeTempTranscript([
    userLine('/gsd:research-phase 1'),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "docs: research" --files 04-RESEARCH.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'No quorum calls here.' }]),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'No quorum calls here.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 even when blocking');
    assert.ok(stdout.length > 0, 'stdout must contain block decision');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block');
    assert.ok(parsed.reason.includes('QUORUM REQUIRED:'), 'reason must include QUORUM REQUIRED');
    // Default config model tool prefixes should be in the reason
    assert.ok(
      parsed.reason.includes('mcp__codex-cli__') ||
      parsed.reason.includes('mcp__gemini-cli__') ||
      parsed.reason.includes('mcp__opencode__'),
      'reason must name at least one default model tool'
    );
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// Test 10: Regression — quorum calls interleaved with tool_result user messages
// This reproduces the live false-positive: getCurrentTurnLines() must skip
// tool_result user messages and use the human text message as the boundary.
function toolResultLine(toolUseId, resultContent, uuid) {
  return JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: resultContent }],
    },
    timestamp: '2026-02-20T00:01:00Z',
    uuid: uuid || `tr-${toolUseId}`,
  });
}

test('TC10: quorum calls interleaved with tool_result user messages are in scope', () => {
  // Simulates a multi-tool turn: human message → tool calls → tool_results → more calls
  // The quorum calls appear between intermediate tool_result user messages.
  // getCurrentTurnLines() must find the human message as the boundary, not a tool_result.
  const tmpFile = writeTempTranscript([
    // Human turn starts here
    userLine('/gsd:plan-phase 1', 'human-msg'),
    // First batch of tool calls (non-quorum — e.g., Task/Bash)
    assistantLine([toolUseBlock('Bash')], 'assistant-1'),
    toolResultLine('toolu_Bash', 'bash output', 'tr-1'),
    // Second batch — quorum calls
    assistantLine([
      toolUseBlock('mcp__codex-cli__review'),
    ], 'assistant-2'),
    toolResultLine('toolu_codex', 'codex review result', 'tr-2'),
    assistantLine([
      toolUseBlock('mcp__gemini-cli__gemini'),
    ], 'assistant-3'),
    toolResultLine('toolu_gemini', 'gemini result', 'tr-3'),
    assistantLine([
      toolUseBlock('mcp__opencode__opencode'),
    ], 'assistant-4'),
    // Final tool_result before the final assistant text
    toolResultLine('toolu_opencode', 'opencode result', 'tr-4'),
    assistantLine([{ type: 'text', text: 'Here is the plan with quorum complete.' }], 'assistant-5'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan with quorum complete.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — quorum calls are in scope despite tool_result boundaries');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// ── TC11-TC13: Fail-open unavailability detection ──────────────────────────────
//
// These tests use QGSD_CLAUDE_JSON env var to inject a deterministic ~/.claude.json
// substitute. The hook must read this env var via:
//   const claudeJsonPath = process.env.QGSD_CLAUDE_JSON || path.join(os.homedir(), '.claude.json');
// This env var is for testing only — production always uses ~/.claude.json.
//
// TC11: Model prefix not in mcpServers → unavailable → fail-open (pass)
// TC12: Partial availability — one model unavailable (pass), one available+missing (block)
// TC13: MCP-06 regression — renamed prefix matched correctly (pass)

// TC11: opencode prefix not in mcpServers (empty servers) → unavailable → pass (fail-open)
test('TC11: model prefix not in mcpServers → unavailable → fail-open pass', () => {
  // Create temp ~/.claude.json substitute with empty mcpServers
  const claudeJsonTmp = path.join(os.tmpdir(), `qgsd-claude-tc11-${Date.now()}.json`);
  fs.writeFileSync(claudeJsonTmp, JSON.stringify({ mcpServers: {} }), 'utf8');

  // Transcript: quorum command issued, but no quorum tool_use calls at all
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1', 'human-msg'),
    assistantLine([{ type: 'text', text: 'Here is the plan.' }], 'assistant-1'),
  ]);

  try {
    // Config requires codex-cli prefix; empty mcpServers → codex-cli unavailable → pass
    const configPayload = JSON.stringify({
      quorum_commands: ['plan-phase'],
      fail_mode: 'open',
      required_models: {
        codex: { tool_prefix: 'mcp__codex-cli__', required: true },
      },
    });
    const configTmp = path.join(os.tmpdir(), `qgsd-cfg-tc11-${Date.now()}.json`);
    const qgsdConfigDir = path.join(os.tmpdir(), `qgsd-home-tc11-${Date.now()}`);
    fs.mkdirSync(qgsdConfigDir, { recursive: true });
    fs.writeFileSync(path.join(qgsdConfigDir, 'qgsd.json'), configPayload, 'utf8');

    const { stdout, exitCode } = runHookWithEnv(
      {
        stop_hook_active: false,
        hook_event_name: 'Stop',
        transcript_path: tmpFile,
        last_assistant_message: 'Here is the plan.',
      },
      {
        QGSD_CLAUDE_JSON: claudeJsonTmp,
        HOME: qgsdConfigDir, // Makes loadConfig() read from our temp ~/.claude/qgsd.json
      }
    );
    assert.strictEqual(exitCode, 0, 'exit code must be 0 — unavailable model → fail-open pass');
    assert.strictEqual(stdout, '', 'stdout must be empty — no block for unavailable model');
  } finally {
    fs.unlinkSync(tmpFile);
    fs.unlinkSync(claudeJsonTmp);
  }
});

// TC12: Partial availability — gemini not in mcpServers (unavailable → skip), codex IS in mcpServers but not called → block
// TC12 updated (step 1a): includes a PLAN.md artifact commit so GUARD 5 classifies this as a
// decision turn, preserving the invariant: quorum-command + decision-turn + available-but-missing = block.
test('TC12: partial availability — unavailable model skipped, available-but-missing model blocks', () => {
  // Create temp ~/.claude.json with only codex-cli in mcpServers (gemini absent)
  const claudeJsonTmp = path.join(os.tmpdir(), `qgsd-claude-tc12-${Date.now()}.json`);
  fs.writeFileSync(claudeJsonTmp, JSON.stringify({ mcpServers: { 'codex-cli': {} } }), 'utf8');

  // Transcript: quorum command issued, PLAN.md artifact commit, no quorum calls
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1', 'human-msg'),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "feat: plan" --files 04-01-PLAN.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'Here is the plan.' }], 'assistant-1'),
  ]);

  try {
    const configPayload = JSON.stringify({
      quorum_commands: ['plan-phase'],
      fail_mode: 'open',
      required_models: {
        codex:  { tool_prefix: 'mcp__codex-cli__',  required: true },
        gemini: { tool_prefix: 'mcp__gemini-cli__', required: true },
      },
    });
    const qgsdConfigDir = path.join(os.tmpdir(), `qgsd-home-tc12-${Date.now()}`);
    fs.mkdirSync(qgsdConfigDir, { recursive: true });
    fs.writeFileSync(path.join(qgsdConfigDir, 'qgsd.json'), configPayload, 'utf8');

    const { stdout, exitCode } = runHookWithEnv(
      {
        stop_hook_active: false,
        hook_event_name: 'Stop',
        transcript_path: tmpFile,
        last_assistant_message: 'Here is the plan.',
      },
      {
        QGSD_CLAUDE_JSON: claudeJsonTmp,
        HOME: qgsdConfigDir,
      }
    );
    // codex IS in mcpServers but was not called → block
    assert.strictEqual(exitCode, 0, 'exit code must be 0 — hook communicates via stdout JSON, not exit code');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block', 'should block — codex available+missing');
    assert.ok(parsed.reason.includes('codex') || parsed.reason.includes('mcp__codex-cli__'), 'block reason should name codex');
  } finally {
    fs.unlinkSync(tmpFile);
    fs.unlinkSync(claudeJsonTmp);
  }
});

// TC13: MCP-06 regression — renamed prefix matched correctly (pass when called)
test('TC13: MCP-06 regression — renamed prefix detected and matched correctly', () => {
  // Config has a custom prefix (renamed MCP server); mcpServers has that server; transcript has a call
  const claudeJsonTmp = path.join(os.tmpdir(), `qgsd-claude-tc13-${Date.now()}.json`);
  fs.writeFileSync(claudeJsonTmp, JSON.stringify({ mcpServers: { 'my-custom-codex': {} } }), 'utf8');

  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1', 'human-msg'),
    assistantLine([toolUseBlock('mcp__my-custom-codex__review')], 'assistant-1'),
    assistantLine([{ type: 'text', text: 'Plan with custom codex.' }], 'assistant-2'),
  ]);

  try {
    const configPayload = JSON.stringify({
      quorum_commands: ['plan-phase'],
      fail_mode: 'open',
      required_models: {
        custom: { tool_prefix: 'mcp__my-custom-codex__', required: true },
      },
    });
    const qgsdConfigDir = path.join(os.tmpdir(), `qgsd-home-tc13-${Date.now()}`);
    fs.mkdirSync(qgsdConfigDir, { recursive: true });
    fs.writeFileSync(path.join(qgsdConfigDir, 'qgsd.json'), configPayload, 'utf8');

    const { stdout, exitCode } = runHookWithEnv(
      {
        stop_hook_active: false,
        hook_event_name: 'Stop',
        transcript_path: tmpFile,
        last_assistant_message: 'Plan with custom codex.',
      },
      {
        QGSD_CLAUDE_JSON: claudeJsonTmp,
        HOME: qgsdConfigDir,
      }
    );
    // custom prefix IS in mcpServers AND was called → pass
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — renamed prefix found evidence → pass');
  } finally {
    fs.unlinkSync(tmpFile);
    fs.unlinkSync(claudeJsonTmp);
  }
});

// ── TC14-TC19: GUARD 5 — Decision turn detection (SCOPE-01/02/03/05/06/07) ─────────────────────
//
// TC14: intermediate plan-phase turn (no artifact commit, no marker) → PASS (not a decision turn)
// TC15: final plan-phase turn with PLAN.md artifact committed → QUORUM REQUIRED (decision turn)
// TC16: map-codebase turn (codebase/*.md commit, no artifact pattern match) → PASS
// TC17: new-project routing turn (no artifact commit, no marker) → PASS
// TC18: discuss-phase final turn with CONTEXT.md artifact committed → QUORUM REQUIRED
// TC19: verify-work turn with <!-- GSD_DECISION --> marker in last text block → QUORUM REQUIRED

// TC14: intermediate plan-phase turn — assistant spawns an agent, no artifact commit, no marker
test('TC14: intermediate plan-phase turn (no artifact commit, no marker) passes without quorum block', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1'),
    assistantLine([{ type: 'text', text: 'Spawning researcher agent...' }]),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Spawning researcher agent...',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — intermediate turn is not a decision turn');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC15: final plan-phase turn — PLAN.md artifact committed + no quorum calls → QUORUM REQUIRED
test('TC15: final plan-phase turn with PLAN.md artifact committed blocks when quorum missing', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1'),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "feat: plan" --files 04-01-PLAN.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'Here is the plan.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the plan.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 even when blocking');
    assert.ok(stdout.length > 0, 'stdout must contain block decision JSON');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block', 'decision must be "block"');
    assert.ok(parsed.reason.startsWith('QUORUM REQUIRED:'), 'reason must start with QUORUM REQUIRED:');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC16: map-codebase turn — commits codebase/STACK.md (no artifact pattern match) → PASS
// Guards against Pitfall 2 from RESEARCH.md: bare STACK.md must NOT trigger artifact detection.
test('TC16: map-codebase turn with codebase/*.md commit passes without quorum block', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1'),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "docs: codebase" --files .planning/codebase/STACK.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'Codebase mapped.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Codebase mapped.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — codebase/*.md is not a planning artifact');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC17: new-project routing turn — assistant asks a question, no artifact commit, no marker → PASS
test('TC17: new-project routing turn (questioning step) passes without quorum block', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:new-project'),
    assistantLine([{ type: 'text', text: 'What do you want to build?' }]),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'What do you want to build?',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0');
    assert.strictEqual(stdout, '', 'stdout must be empty — routing/questioning turn is not a decision turn');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC18: discuss-phase final turn — CONTEXT.md artifact committed + no quorum calls → QUORUM REQUIRED
test('TC18: discuss-phase final turn with CONTEXT.md artifact committed blocks when quorum missing', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:discuss-phase 4'),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "docs: context" --files 04-CONTEXT.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'Here are the filtered questions.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here are the filtered questions.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 even when blocking');
    assert.ok(stdout.length > 0, 'stdout must contain block decision JSON');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block', 'decision must be "block"');
    assert.ok(parsed.reason.startsWith('QUORUM REQUIRED:'), 'reason must start with QUORUM REQUIRED:');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC19: verify-work turn with <!-- GSD_DECISION --> in last assistant text block → QUORUM REQUIRED
test('TC19: verify-work turn with decision marker in last assistant text block blocks when quorum missing', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:verify-work'),
    assistantLine([{ type: 'text', text: 'Verification complete.\n\n<!-- GSD_DECISION -->' }]),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Verification complete.\n\n<!-- GSD_DECISION -->',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 even when blocking');
    assert.ok(stdout.length > 0, 'stdout must contain block decision JSON');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block', 'decision must be "block"');
    assert.ok(parsed.reason.startsWith('QUORUM REQUIRED:'), 'reason must start with QUORUM REQUIRED:');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// ── TC20/TC20b/TC20c: @file-expansion false-positive regression ───────────────────────────────
//
// When Claude Code expands a workflow file (e.g. quick.md) via @-reference, the expanded content
// is appended to the user message body. Workflow files often mention other /qgsd: commands by name
// (e.g. "If you meant /qgsd:new-project, run that instead."). The old JSON.stringify full-body
// scan would match these mentions and trigger a false-positive GUARD 4 hit.
//
// Fix: hasQuorumCommand reads the <command-name> XML tag first. This tag is injected by Claude
// Code only for real slash command invocations — never in @file-expanded content. When the tag
// is present, only the tag value is tested; the body is never scanned.
//
// TC20  — false-positive regression: /qgsd:quick tag, body mentions /qgsd:new-project → pass
// TC20b — positive control: /qgsd:new-project real tag, questioning turn → pass (GUARD 5)
// TC20c — end-to-end: /qgsd:new-project real tag + decision turn + no quorum → block

// Helper: build a user JSONL line whose message.content begins with the <command-name> XML tag
// (simulating Claude Code's injection for real slash command invocations) followed by the body.
function userLineWithTag(commandTag, bodyText, uuid) {
  const content = '<command-name>' + commandTag + '</command-name>\n\n' + bodyText;
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
    timestamp: '2026-02-20T00:00:00Z',
    uuid: uuid || 'user-tagged',
  });
}

// TC20 — The false-positive regression:
// User invokes /qgsd:quick (tag = "/qgsd:quick"); body contains "new-project" text from
// expanded quick.md workflow. With the fix, the tag is read first ("/qgsd:quick" is not in
// quorum_commands) → GUARD 4 returns false → exit 0. Body is never scanned.
test('TC20: @file-expanded body containing /qgsd:new-project text does not false-positive when real command is /qgsd:quick', () => {
  const expandedBody =
    'Execute the quick task.\n\n' +
    'If you meant /qgsd:new-project, run that instead. ' +
    'See /qgsd:new-project documentation for details.';
  const tmpFile = writeTempTranscript([
    userLineWithTag('/qgsd:quick', expandedBody, 'user-quick'),
    assistantLine([{ type: 'text', text: 'Running quick task.' }], 'assistant-1'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Running quick task.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 — /qgsd:quick is not a quorum command');
    assert.strictEqual(stdout, '', 'stdout must be empty — new-project in body must not trigger GUARD 4');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC20b — Positive control: new-project IS the real command (tag present), but no artifact commit
// and no decision marker — GUARD 5 passes (routing/questioning turn).
// Verifies the XML tag strategy correctly identifies real /qgsd:new-project invocations.
test('TC20b: real /qgsd:new-project tag on a questioning turn passes (GUARD 5 — not a decision turn)', () => {
  const tmpFile = writeTempTranscript([
    userLineWithTag('/qgsd:new-project', 'I want to start a new project.', 'user-np'),
    assistantLine([{ type: 'text', text: 'What do you want to build?' }], 'assistant-1'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'What do you want to build?',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 — questioning turn is not a decision turn');
    assert.strictEqual(stdout, '', 'stdout must be empty — GUARD 5 passes, no artifact or marker');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// TC20c — End-to-end: new-project IS real (tag) + ROADMAP.md artifact commit (decision turn) + no quorum → block
// Verifies real /qgsd:new-project invocations still trigger quorum enforcement on decision turns.
test('TC20c: real /qgsd:new-project tag on a decision turn blocks when quorum missing', () => {
  const tmpFile = writeTempTranscript([
    userLineWithTag('/qgsd:new-project', 'Build a task management app.', 'user-np2'),
    assistantLine([
      bashCommitBlock('node /path/gsd-tools.cjs commit "docs: roadmap" --files ROADMAP.md'),
    ], 'assistant-commit'),
    assistantLine([{ type: 'text', text: 'Here is the roadmap.' }], 'assistant-2'),
  ]);
  try {
    const { stdout, exitCode } = runHook({
      stop_hook_active: false,
      hook_event_name: 'Stop',
      transcript_path: tmpFile,
      last_assistant_message: 'Here is the roadmap.',
    });
    assert.strictEqual(exitCode, 0, 'exit code must be 0 even when blocking');
    assert.ok(stdout.length > 0, 'stdout must contain block decision JSON');
    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.decision, 'block', 'decision must be "block"');
    assert.ok(parsed.reason.startsWith('QUORUM REQUIRED:'), 'reason must start with QUORUM REQUIRED:');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
