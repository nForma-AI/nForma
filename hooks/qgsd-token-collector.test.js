#!/usr/bin/env node
// Test suite for hooks/qgsd-token-collector.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-token-collector.test.js
//
// Each test spawns the hook as a child process with a mock stdin JSON payload,
// writes fixture JSONL transcript to an isolated tmpdir, asserts stdout/exitCode/file output.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-token-collector.js');

// Helper: create isolated tmpdir per test
function makeTmpDir() {
  return path.join(os.tmpdir(), 'qgsd-tc-' + Date.now() + '-' + Math.random().toString(36).slice(2));
}

// Helper: run the hook with a given stdin JSON payload, using tmpDir as cwd
function runHook(stdinPayload, tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// Helper: read token-usage.jsonl from tmpDir
function readTokenLog(tmpDir) {
  const logPath = path.join(tmpDir, '.planning', 'telemetry', 'token-usage.jsonl');
  if (!fs.existsSync(logPath)) return null;
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
  return lines.map(l => JSON.parse(l));
}

// Helper: write a fixture transcript to tmpDir
function writeTranscript(tmpDir, entries) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const transcriptPath = path.join(tmpDir, 'transcript.jsonl');
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(transcriptPath, content, 'utf8');
  return transcriptPath;
}

test('normal case: appends correct record to token-usage.jsonl', () => {
  const tmpDir = makeTmpDir();
  const transcriptPath = writeTranscript(tmpDir, [
    {
      type: 'assistant',
      message: {
        usage: {
          input_tokens: 100,
          output_tokens: 25,
          cache_creation_input_tokens: 5000,
          cache_read_input_tokens: 200,
        },
      },
      isSidechain: false,
      isApiErrorMessage: false,
    },
  ]);

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    session_id: 'sess1',
    agent_id: 'agent1',
    agent_transcript_path: transcriptPath,
    last_assistant_message: 'slot: claude-1\nvote: APPROVE\nrationale: looks good',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const records = readTokenLog(tmpDir);
  assert.ok(records && records.length === 1, 'Expected exactly 1 record');
  assert.equal(records[0].slot, 'claude-1');
  assert.equal(records[0].input_tokens, 100);
  assert.equal(records[0].output_tokens, 25);
  assert.equal(records[0].cache_creation_input_tokens, 5000);
  assert.equal(records[0].cache_read_input_tokens, 200);
  assert.equal(records[0].session_id, 'sess1');
  assert.equal(records[0].agent_id, 'agent1');
});

test('isSidechain entries are excluded', () => {
  const tmpDir = makeTmpDir();
  const transcriptPath = writeTranscript(tmpDir, [
    {
      type: 'assistant',
      message: { usage: { input_tokens: 999, output_tokens: 999 } },
      isSidechain: true,
      isApiErrorMessage: false,
    },
    {
      type: 'assistant',
      message: { usage: { input_tokens: 50, output_tokens: 10 } },
      isSidechain: false,
      isApiErrorMessage: false,
    },
  ]);

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    session_id: 's1',
    agent_id: 'a1',
    agent_transcript_path: transcriptPath,
    last_assistant_message: 'slot: claude-1\nvote: APPROVE',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const records = readTokenLog(tmpDir);
  assert.ok(records && records.length === 1);
  // Only the non-sidechain entry counts: 50 input, 10 output
  assert.equal(records[0].input_tokens, 50);
  assert.equal(records[0].output_tokens, 10);
});

test('isApiErrorMessage entries are excluded', () => {
  const tmpDir = makeTmpDir();
  const transcriptPath = writeTranscript(tmpDir, [
    {
      type: 'assistant',
      message: { usage: { input_tokens: 500, output_tokens: 100 } },
      isSidechain: false,
      isApiErrorMessage: true,
    },
  ]);

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    session_id: 's1',
    agent_id: 'a1',
    agent_transcript_path: transcriptPath,
    last_assistant_message: 'slot: claude-2\nvote: APPROVE',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const records = readTokenLog(tmpDir);
  assert.ok(records && records.length === 1);
  // Error entries excluded → 0 tokens summed
  assert.equal(records[0].input_tokens, 0);
  assert.equal(records[0].output_tokens, 0);
});

test('null transcript path: exits 0 and writes null record', () => {
  const tmpDir = makeTmpDir();

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    session_id: 's1',
    agent_id: 'a1',
    agent_transcript_path: null,
    last_assistant_message: 'slot: claude-1\nvote: APPROVE',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const records = readTokenLog(tmpDir);
  assert.ok(records && records.length === 1, 'Expected 1 null record');
  assert.equal(records[0].input_tokens, null);
  assert.equal(records[0].output_tokens, null);
});

test('non-qgsd agent type: exits 0, no file written', () => {
  const tmpDir = makeTmpDir();

  const payload = {
    agent_type: 'other',
    session_id: 's1',
    agent_id: 'a1',
    agent_transcript_path: null,
    last_assistant_message: 'hello',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const records = readTokenLog(tmpDir);
  assert.equal(records, null, 'No file should be written for non-qgsd agents');
});

test('slot resolution: fallback to last_assistant_message when no correlation file', () => {
  const tmpDir = makeTmpDir();
  const transcriptPath = writeTranscript(tmpDir, [
    {
      type: 'assistant',
      message: { usage: { input_tokens: 75, output_tokens: 15 } },
      isSidechain: false,
      isApiErrorMessage: false,
    },
  ]);

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    session_id: 's1',
    agent_id: 'a2',
    agent_transcript_path: transcriptPath,
    last_assistant_message: 'slot: gemini-1\nvote: APPROVE\nrationale: good',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const records = readTokenLog(tmpDir);
  assert.ok(records && records.length === 1);
  assert.equal(records[0].slot, 'gemini-1');
});

test('slot resolution: correlation file exists with slot: null, falls back to last_assistant_message', () => {
  const tmpDir = makeTmpDir();
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Write a correlation file with slot: null
  const corrFile = path.join(planningDir, 'quorum-slot-corr-a1.json');
  fs.writeFileSync(corrFile, JSON.stringify({ agent_id: 'a1', slot: null, ts: new Date().toISOString() }), 'utf8');

  const transcriptPath = writeTranscript(tmpDir, [
    {
      type: 'assistant',
      message: { usage: { input_tokens: 200, output_tokens: 40 } },
      isSidechain: false,
      isApiErrorMessage: false,
    },
  ]);

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    session_id: 's1',
    agent_id: 'a1',
    agent_transcript_path: transcriptPath,
    last_assistant_message: 'slot: claude-2\nvote: APPROVE',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  // Correlation file should be deleted after reading
  assert.equal(fs.existsSync(corrFile), false, 'Correlation file should be deleted after reading');

  const records = readTokenLog(tmpDir);
  assert.ok(records && records.length === 1);
  // slot: null in corr file → fallback to last_assistant_message → claude-2
  assert.equal(records[0].slot, 'claude-2');
});
