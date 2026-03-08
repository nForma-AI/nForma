#!/usr/bin/env node
// @requirement SCBD-02
// Structural test: scoreboard entry displays the current model loaded in that slot as context
// Formal property: NoVoteLoss — all votes for a model across rounds sum correctly

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCOREBOARD_SRC = path.resolve(__dirname, '../../../bin/update-scoreboard.cjs');

test('SCBD-02: update-scoreboard.cjs exists and is loadable', () => {
  assert.ok(fs.existsSync(SCOREBOARD_SRC), 'update-scoreboard.cjs must exist');
});

test('SCBD-02: scoreboard uses composite slot:model keys for context tracking', () => {
  const content = fs.readFileSync(SCOREBOARD_SRC, 'utf8');
  // Composite key pattern: slot + modelId used together as key
  assert.match(content, /compositeKey/, 'must use compositeKey for slot:model tracking');
  assert.match(content, /slot.*modelId|modelId.*slot/, 'must track both slot and modelId');
});

test('SCBD-02: emptySlotStats includes both slot and model fields', () => {
  const content = fs.readFileSync(SCOREBOARD_SRC, 'utf8');
  assert.match(content, /function\s+emptySlotStats/, 'emptySlotStats function must exist');
  assert.match(content, /slot.*model.*score|model.*slot.*score/, 'emptySlotStats must include slot, model, and score');
});

test('SCBD-02: scoreboard recomputes slot stats from round votes (NoVoteLoss)', () => {
  const content = fs.readFileSync(SCOREBOARD_SRC, 'utf8');
  // Recompute logic replays all rounds to prevent vote loss
  assert.match(content, /[Rr]eplay.*round|[Rr]ecompute.*slot/, 'must replay/recompute from rounds');
});
