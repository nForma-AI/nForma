#!/usr/bin/env node
// @requirement STOP-01
// Verify: Stop hook reads transcript JSONL for tool_use entries matching configured quorum model names
// Strategy: constant — assert the stop hook source contains the expected patterns

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const stopHookPath = path.join(ROOT, 'hooks', 'nf-stop.js');

test('STOP-01: stop hook reads transcript JSONL', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // Must read transcript_path from input
  assert.match(content, /transcript_path/,
    'Stop hook should reference transcript_path from input');

  // Must read and split JSONL lines
  assert.match(content, /readFileSync.*transcript/,
    'Stop hook should read transcript file');

  assert.match(content, /split\(['"]\\n['"]\)/,
    'Stop hook should split transcript into lines');
});

test('STOP-01: stop hook scans for tool_use entries', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // Must check for tool_use type in message content blocks
  assert.match(content, /tool_use/,
    'Stop hook should check for tool_use entries in transcript');

  assert.match(content, /block\.type/,
    'Stop hook should inspect block.type in content arrays');
});

test('STOP-01: stop hook matches configured quorum model names via agent pool', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // Must have buildAgentPool for deriving slot/prefix pairs from config
  assert.match(content, /buildAgentPool/,
    'Stop hook should define buildAgentPool for quorum model matching');

  // Must have deriveMissingToolName that knows quorum model keys
  assert.match(content, /deriveMissingToolName/,
    'Stop hook should define deriveMissingToolName for model-specific tool names');

  // deriveMissingToolName must handle the core quorum models: codex, gemini, opencode, copilot
  assert.match(content, /modelKey\s*===\s*['"]codex['"]/,
    'deriveMissingToolName should handle codex');
  assert.match(content, /modelKey\s*===\s*['"]gemini['"]/,
    'deriveMissingToolName should handle gemini');
  assert.match(content, /modelKey\s*===\s*['"]opencode['"]/,
    'deriveMissingToolName should handle opencode');
  assert.match(content, /modelKey\s*===\s*['"]copilot['"]/,
    'deriveMissingToolName should handle copilot');
});
