#!/usr/bin/env node
'use strict';
// bin/run-prism.test.cjs
// Integration tests for scoreboard-to-PRISM -const injection in run-prism.cjs.
// No PRISM installation required — tests capture the Args log line which is
// printed before PRISM is spawned.
// Requirements: PRISM-01, PRISM-02

const { test }      = require('node:test');
const assert        = require('node:assert');
const { spawnSync } = require('child_process');
const fs            = require('fs');
const path          = require('path');
const os            = require('os');

const RUN_PRISM = path.join(__dirname, 'run-prism.cjs');

// ── Fixture helper ──────────────────────────────────────────────────────────
// Builds a minimal quorum-scoreboard.json fixture.
// votesFn(slotName, roundIndex) → vote code, e.g. 'TP', 'UNAVAIL', 'FP'
function makeScoreboard(nRounds, votesFn) {
  const rounds = [];
  const slots  = ['gemini', 'opencode', 'copilot', 'codex'];
  for (let i = 0; i < nRounds; i++) {
    const votes = { claude: 'TP' };  // Claude always present; excluded from rates
    for (const slot of slots) {
      votes[slot] = votesFn ? votesFn(slot, i) : 'TP';
    }
    rounds.push({ date: '02-26', task: `r${i}`, round: 1, votes });
  }
  return { models: {}, rounds };
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('conservative priors used and logged when no scoreboard exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-prism-test-'));
  try {
    // No .planning/ directory — scoreboard absent
    const result = spawnSync(process.execPath, [RUN_PRISM], {
      encoding: 'utf8',
      cwd:      tmpDir,
      env:      { ...process.env, PRISM_BIN: 'prism' },
    });
    // Conservative priors must appear in the Args log line
    assert.match(result.stdout, /Args:.*-const tp_rate=0\.85/,
      'Args line should have -const tp_rate=0.85 (prior)');
    assert.match(result.stdout, /Args:.*-const unavail=0\.15/,
      'Args line should have -const unavail=0.15 (prior)');
    // Warning should mention no scoreboard
    assert.match(result.stderr, /No scoreboard/i,
      'stderr should note no scoreboard found');
    // "Injected from scoreboard" must NOT appear (priors, not empirical)
    assert.doesNotMatch(result.stdout, /Injected from scoreboard/,
      '"Injected from scoreboard" must not appear when using priors');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('empirical rates injected from fixture scoreboard with all-TP votes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-prism-test-'));
  try {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    // 10 rounds, all slots voting TP → tpRate=1.0, unavailRate=0.0
    const scoreboard = makeScoreboard(10, () => 'TP');
    fs.writeFileSync(
      path.join(planningDir, 'quorum-scoreboard.json'),
      JSON.stringify(scoreboard, null, 2)
    );

    const result = spawnSync(process.execPath, [RUN_PRISM], {
      encoding: 'utf8',
      cwd:      tmpDir,
      env:      { ...process.env, PRISM_BIN: 'prism' },
    });
    // tpRate=1.0 (or 1), unavailRate=0 (or 0.0)
    assert.match(result.stdout, /Args:.*-const tp_rate=1(\.0+)?(?:\s|$)/,
      'Args line should have -const tp_rate=1');
    assert.match(result.stdout, /-const unavail=0(\.0+)?(?:\s|$)/,
      'Args line should have -const unavail=0');
    assert.match(result.stdout, /Injected from scoreboard/,
      '"Injected from scoreboard" should appear');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('mixed votes produce correct aggregate rates', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-prism-test-'));
  try {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    // 4 rounds: each slot votes TP 3x and UNAVAIL 1x
    // Per slot: tpRate = 3/4 = 0.75, unavailRate = 1/4 = 0.25
    // Aggregate across 4 slots: tpRate = 0.75, unavailRate = 0.25
    const scoreboard = makeScoreboard(4, (_slot, i) => i < 3 ? 'TP' : 'UNAVAIL');
    fs.writeFileSync(
      path.join(planningDir, 'quorum-scoreboard.json'),
      JSON.stringify(scoreboard, null, 2)
    );

    const result = spawnSync(process.execPath, [RUN_PRISM], {
      encoding: 'utf8',
      cwd:      tmpDir,
      env:      { ...process.env, PRISM_BIN: 'prism' },
    });
    assert.match(result.stdout, /-const tp_rate=0\.75/,
      'Args line should have -const tp_rate=0.75');
    assert.match(result.stdout, /-const unavail=0\.25/,
      'Args line should have -const unavail=0.25');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('caller -const tp_rate override wins over scoreboard value', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-prism-test-'));
  try {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    // All-TP scoreboard would produce tp_rate=1.0
    const scoreboard = makeScoreboard(10, () => 'TP');
    fs.writeFileSync(
      path.join(planningDir, 'quorum-scoreboard.json'),
      JSON.stringify(scoreboard, null, 2)
    );

    // Caller overrides tp_rate with 0.42
    const result = spawnSync(
      process.execPath,
      [RUN_PRISM, '-const', 'tp_rate=0.42'],
      {
        encoding: 'utf8',
        cwd:      tmpDir,
        env:      { ...process.env, PRISM_BIN: 'prism' },
      }
    );
    // Caller value must appear
    assert.match(result.stdout, /-const tp_rate=0\.42/,
      'Caller -const tp_rate=0.42 must appear in Args');
    // Scoreboard value must NOT appear
    assert.doesNotMatch(result.stdout, /-const tp_rate=1(\.0+)?(?:\s|$)/,
      'Scoreboard tp_rate=1 must not appear (caller overrides)');
    // unavail should still be injected from scoreboard (0.0)
    assert.match(result.stdout, /-const unavail=0(\.0+)?(?:\s|$)/,
      'unavail from scoreboard should still be injected');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
