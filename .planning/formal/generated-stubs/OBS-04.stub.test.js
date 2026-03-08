#!/usr/bin/env node
// @requirement OBS-04
// Structural test: Status shows recent UNAVAIL count per agent from quorum scoreboard
// Verifies that update-scoreboard.cjs tracks UNAVAIL results and computes per-agent stats

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scoreboardPath = path.resolve(__dirname, '../../../bin/update-scoreboard.cjs');
const scoreboardSrc = fs.readFileSync(scoreboardPath, 'utf8');

test('OBS-04: scoreboard recognizes UNAVAIL as a valid result code', () => {
  // UNAVAIL must be in valid results and in score deltas
  assert.match(scoreboardSrc, /UNAVAIL/);
  assert.match(scoreboardSrc, /VALID_RESULTS\s*=.*UNAVAIL/s);
});

test('OBS-04: scoreboard score delta for UNAVAIL is zero', () => {
  // UNAVAIL votes should not affect scoring
  assert.match(scoreboardSrc, /UNAVAIL:\s*0/);
});

test('OBS-04: scoreboard filters UNAVAIL from valid vote counts', () => {
  // computeDeliveryStats and computeFlakiness should exclude UNAVAIL from valid votes
  assert.match(scoreboardSrc, /!==\s*'UNAVAIL'/);
});

test('OBS-04: scoreboard exports computeDeliveryStats and computeFlakiness', () => {
  const mod = require(scoreboardPath);
  assert.equal(typeof mod.computeDeliveryStats, 'function');
  assert.equal(typeof mod.computeFlakiness, 'function');
});

test('OBS-04: computeFlakiness tracks per-slot verdicts across rounds', () => {
  // computeFlakiness iterates per-slot and computes from trailing window
  assert.match(scoreboardSrc, /function computeFlakiness/);
  assert.match(scoreboardSrc, /allSlots/);
  assert.match(scoreboardSrc, /verdictWindow/);
});
