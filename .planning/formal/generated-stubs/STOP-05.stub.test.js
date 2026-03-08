#!/usr/bin/env node
// @requirement STOP-05
// Test: Stop hook reads transcript JSONL as authoritative source — no fast-path pre-check
// Strategy: constant — verify no last_assistant_message pre-check exists, JSONL is the only path

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-stop.js');

test('STOP-05: nf-stop.js uses transcript JSONL as authoritative quorum source with no fast-path pre-check', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify transcript_path is read and parsed as JSONL
  assert.match(content, /transcript_path/,
    'nf-stop.js must reference transcript_path');
  assert.match(content, /readFileSync\s*\(\s*input\.transcript_path/,
    'nf-stop.js must read transcript_path file synchronously');
  // Verify no fast-path pre-check using last_assistant_message
  assert.doesNotMatch(content, /last_assistant_message/,
    'nf-stop.js must NOT use last_assistant_message as a fast-path pre-check');
});
