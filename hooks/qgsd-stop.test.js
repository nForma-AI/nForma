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

// Test 6: /gsd:plan-phase in current turn + only codex tool_use → block with decision:block
test('TC6: planning command with only codex tool call triggers block', () => {
  const tmpFile = writeTempTranscript([
    userLine('/gsd:plan-phase 1'),
    assistantLine([
      toolUseBlock('mcp__codex-cli__review'),
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
test('TC9: missing config file falls back to DEFAULT_CONFIG', () => {
  // This test passes because the hook uses DEFAULT_CONFIG when ~/.claude/qgsd.json is absent.
  // The existing tests already exercise this (no config file written during tests).
  // Explicitly verify: a planning command without quorum gets blocked with default model names.
  const tmpFile = writeTempTranscript([
    userLine('/gsd:research-phase 1'),
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
