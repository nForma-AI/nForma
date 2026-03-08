#!/usr/bin/env node
// @requirement OBS-02
// Structural test: Scoreboard tracks quorum delivery rate -- percentage of calls
// that achieved target vote count (3/3 vs degraded 2/3).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'bin', 'update-scoreboard.cjs'), 'utf8');

test('OBS-02 — update-scoreboard.cjs defines computeDeliveryStats function', () => {
  assert.match(SRC, /function\s+computeDeliveryStats/, 'must define computeDeliveryStats function');
});

test('OBS-02 — delivery_stats structure includes total_rounds and target_vote_count', () => {
  assert.match(SRC, /total_rounds/, 'must track total_rounds in delivery_stats');
  assert.match(SRC, /target_vote_count/, 'must track target_vote_count in delivery_stats');
  assert.match(SRC, /achieved_by_outcome/, 'must track achieved_by_outcome breakdown');
});

test('OBS-02 — delivery stats distinguishes UNAVAIL votes from valid votes', () => {
  assert.match(SRC, /UNAVAIL/, 'must handle UNAVAIL votes');
  assert.match(SRC, /TIMEOUT/, 'must handle TIMEOUT votes');
});
