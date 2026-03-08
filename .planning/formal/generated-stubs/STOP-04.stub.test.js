#!/usr/bin/env node
// @requirement STOP-04
// Test: Stop hook scopes transcript search to current turn only (lines since last user message boundary)
// Strategy: structural — verify getCurrentTurnLines function exists and is used

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-stop.js');

test('STOP-04: nf-stop.js defines getCurrentTurnLines for current-turn scoping', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify getCurrentTurnLines function is defined
  assert.match(content, /function\s+getCurrentTurnLines\s*\(/,
    'nf-stop.js must define getCurrentTurnLines function');
  // Verify it scans backward for user messages (last user boundary)
  assert.match(content, /for\s*\(\s*let\s+i\s*=\s*lines\.length\s*-\s*1/,
    'getCurrentTurnLines must scan backward from end of lines');
  // Verify getCurrentTurnLines is called in main flow
  assert.match(content, /getCurrentTurnLines\s*\(\s*lines\s*\)/,
    'getCurrentTurnLines must be called with transcript lines in main flow');
});
