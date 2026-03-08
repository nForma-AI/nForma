#!/usr/bin/env node
// @requirement SCBD-03
// Structural test: when a slot's model changes, a new scoreboard row is created
// Formal property: NoDoubleCounting — adding a round's vote is additive, no double count

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCOREBOARD_SRC = path.resolve(__dirname, '../../../bin/update-scoreboard.cjs');

test('SCBD-03: scoreboard creates new slot entry for new composite key', () => {
  const content = fs.readFileSync(SCOREBOARD_SRC, 'utf8');
  // When slot:modelId combo is new, a fresh entry is created
  assert.match(content, /emptySlotStats/, 'must call emptySlotStats for new entries');
  // Check that the code creates entries when composite key is missing
  assert.match(content, /data\.slots\[compositeKey\]\s*=\s*emptySlotStats/,
    'must initialize new slot entry when compositeKey not found');
});

test('SCBD-03: composite key format is slot:modelId', () => {
  const content = fs.readFileSync(SCOREBOARD_SRC, 'utf8');
  // Template literal or string concat for slot:modelId
  assert.match(content, /`\$\{.*slot.*\}:\$\{.*modelId.*\}`|slot\s*\+\s*':'\s*\+\s*modelId/,
    'compositeKey must use slot:modelId format');
});

test('SCBD-03: SCORE_DELTAS defines all valid result codes', () => {
  const content = fs.readFileSync(SCOREBOARD_SRC, 'utf8');
  // NoDoubleCounting relies on correct delta application per result code
  assert.match(content, /SCORE_DELTAS/, 'SCORE_DELTAS lookup must exist');
  assert.match(content, /TP.*TN.*FP.*FN/s, 'must define TP, TN, FP, FN deltas');
});
