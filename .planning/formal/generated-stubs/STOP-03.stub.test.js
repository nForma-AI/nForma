#!/usr/bin/env node
// @requirement STOP-03
// Test: Stop hook checks hook_event_name — if SubagentStop, exits 0 immediately (subagent exclusion)
// Strategy: structural — verify source code contains the SubagentStop guard

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-stop.js');

test('STOP-03: nf-stop.js checks hook_event_name for SubagentStop and exits early', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify the SubagentStop guard exists in source
  assert.match(content, /hook_event_name\s*===?\s*['"]SubagentStop['"]/,
    'nf-stop.js must check hook_event_name === "SubagentStop"');
  // Verify it calls process.exit(0) for subagent exclusion
  assert.match(content, /SubagentStop[\s\S]{0,100}process\.exit\(0\)/,
    'SubagentStop check must be followed by process.exit(0)');
});
