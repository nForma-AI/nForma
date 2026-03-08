#!/usr/bin/env node
// @requirement STOP-07
// Test: Stop hook blocks with decision:block and reason when quorum is missing
// Strategy: structural — verify block output format with decision and reason fields

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-stop.js');

test('STOP-07: nf-stop.js blocks with decision:block and descriptive reason when quorum missing', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify block decision is output as JSON with decision: 'block'
  assert.match(content, /decision:\s*['"]block['"]/,
    'nf-stop.js must output decision: "block" when quorum is missing');
  // Verify reason field includes tool names and instructions
  assert.match(content, /reason:\s*['"`]QUORUM REQUIRED/,
    'nf-stop.js block reason must start with "QUORUM REQUIRED"');
  // Verify reason mentions missing tool calls
  assert.match(content, /Missing tool calls for:/,
    'nf-stop.js block reason must mention missing tool calls');
  // Verify the block response is written to stdout (the decision channel)
  assert.match(content, /process\.stdout\.write\s*\(\s*JSON\.stringify\s*\(\s*\{[\s\S]*?decision/,
    'nf-stop.js must write block decision to stdout as JSON');
});
