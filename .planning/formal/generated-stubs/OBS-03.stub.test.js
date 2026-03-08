#!/usr/bin/env node
// @requirement OBS-03
// Structural test: Each slot gets a flakiness score from recent UNAVAIL/timeout
// frequency; high-flakiness slots deprioritized in dispatch ordering.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'bin', 'update-scoreboard.cjs'), 'utf8');

test('OBS-03 — update-scoreboard.cjs defines computeFlakiness function', () => {
  assert.match(SRC, /function\s+computeFlakiness/, 'must define computeFlakiness function');
});

test('OBS-03 — flakiness score is computed from UNAVAIL/TIMEOUT frequency', () => {
  assert.match(SRC, /flakiness_score/, 'must compute and store flakiness_score per slot');
  assert.match(SRC, /UNAVAIL/, 'must count UNAVAIL as flakiness indicator');
  assert.match(SRC, /TIMEOUT/, 'must count TIMEOUT as flakiness indicator');
});

test('OBS-03 — flakiness uses a sliding window of recent verdicts', () => {
  // computeFlakiness accepts windowSize parameter
  assert.match(SRC, /windowSize/, 'must use a configurable window size for flakiness calculation');
  assert.match(SRC, /recent_verdicts/, 'must track recent_verdicts per slot');
});
