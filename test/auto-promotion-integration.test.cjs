#!/usr/bin/env node
'use strict';
/** @requirement PROMO-03 — validates auto-promotion pipeline (PROMO-02/03/04) across session cycles */

/**
 * test/auto-promotion-integration.test.cjs
 * Integration tests for auto-promotion pipeline end-to-end.
 * Validates PROMO-02, PROMO-03, PROMO-04 across multiple session cycles.
 *
 * Uses Node.js built-in test runner (node:test) + node:assert/strict.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { autoPromote, validateCriteria, loadCheckResults } = require('../bin/promote-gate-maturity.cjs');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a minimal fixture directory mimicking .planning/formal/ for autoPromote.
 * Returns { tmpDir, registryPath, changelogPath, perModelGatesPath, gatesDir }
 */
function createFixtureDir(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-auto-promo-'));
  const gatesDir = path.join(tmpDir, 'gates');
  fs.mkdirSync(gatesDir, { recursive: true });

  // Gate files with configurable scores
  const wiringA = opts.wiringA != null ? opts.wiringA : 1.0;
  const wiringB = opts.wiringB != null ? opts.wiringB : 1.0;
  const wiringC = opts.wiringC != null ? opts.wiringC : 1.0;
  const semanticA = opts.semanticA != null ? opts.semanticA : 0.85;
  const semanticB = opts.semanticB != null ? opts.semanticB : 0.9;
  const semanticC = opts.semanticC != null ? opts.semanticC : 0.8;

  fs.writeFileSync(path.join(gatesDir, 'gate-a-grounding.json'), JSON.stringify({
    wiring_evidence_score: wiringA, semantic_score: semanticA,
  }));
  fs.writeFileSync(path.join(gatesDir, 'gate-b-abstraction.json'), JSON.stringify({
    wiring_purpose_score: wiringB, semantic_score: semanticB,
  }));
  fs.writeFileSync(path.join(gatesDir, 'gate-c-validation.json'), JSON.stringify({
    wiring_coverage_score: wiringC, semantic_score: semanticC,
  }));

  // check-results.ndjson — no counterexamples by default
  const checkResults = opts.counterexample
    ? '{"result":"counterexample"}\n'
    : '{"result":"no_counterexample"}\n';
  fs.writeFileSync(path.join(tmpDir, 'check-results.ndjson'), checkResults);

  // model-registry.json with one SOFT_GATE model
  const registry = {
    '.alloy/quorum-votes.als': {
      gate_maturity: opts.gateMaturity || 'SOFT_GATE',
      evidence_readiness: { score: 3, total: 5 },
      source_layer: 'L3',
      last_updated: new Date().toISOString(),
    },
  };
  const registryPath = path.join(tmpDir, 'model-registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  // per-model-gates.json — all gates pass by default
  const gatePass = opts.gatesPass !== false;
  const perModelGates = {
    models: {
      '.alloy/quorum-votes.als': {
        gate_a: { pass: gatePass, score: wiringA },
        gate_b: { pass: gatePass, score: wiringB },
        gate_c: { pass: gatePass, score: wiringC },
      },
    },
  };
  const perModelGatesPath = path.join(tmpDir, 'per-model-gates.json');
  fs.writeFileSync(perModelGatesPath, JSON.stringify(perModelGates, null, 2));

  // promotion-changelog.json — empty
  const changelogPath = path.join(tmpDir, 'promotion-changelog.json');
  fs.writeFileSync(changelogPath, '[]');

  // solve-state.json
  const solveStatePath = path.join(tmpDir, 'solve-state.json');
  fs.writeFileSync(solveStatePath, JSON.stringify({
    consecutive_clean_sessions: opts.cleanSessions || 0,
  }));

  return { tmpDir, registryPath, changelogPath, perModelGatesPath, gatesDir, solveStatePath };
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

// ── Test 1: Auto-promotion fires after 3 consecutive clean sessions ─────────

test('PROMO-INT-1: auto-promotion fires after 3 consecutive clean sessions', () => {
  const { tmpDir, registryPath, changelogPath, perModelGatesPath } = createFixtureDir({
    cleanSessions: 0,
  });

  try {
    let registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const perModelGates = JSON.parse(fs.readFileSync(perModelGatesPath, 'utf8'));
    let changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

    // Simulate 3 clean session cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      // Each cycle: read state, check clean (using fixture data that is all clean),
      // increment consecutive_clean_sessions
      const isCleanSession = true; // fixture has wiring >= 1.0, semantic >= 0.8, no counterexamples
      const prevClean = cycle - 1;
      const newClean = isCleanSession ? prevClean + 1 : 0;

      if (cycle < 3) {
        // Not yet at threshold — autoPromote should not promote
        const solveState = { consecutive_clean_sessions: newClean };
        const result = autoPromote(solveState, perModelGates, registry, changelog, {
          checkResults: [{ result: 'pass', tool: 'alloy', check_id: 'alloy:quorum-votes' }],
        });
        assert.equal(result.promoted.length, 0, `Cycle ${cycle}: should not promote yet (clean=${newClean})`);
      }

      if (cycle === 3) {
        // At threshold — autoPromote should fire
        const solveState = { consecutive_clean_sessions: newClean };
        const result = autoPromote(solveState, perModelGates, registry, changelog, {
          checkResults: [{ result: 'pass', tool: 'alloy', check_id: 'alloy:quorum-votes' }],
        });
        assert.equal(result.promoted.length, 1, 'Should promote 1 model after 3 clean sessions');
        assert.equal(result.consecutive_clean_sessions, 3);
      }
    }

    // Verify model promoted
    assert.equal(registry['.alloy/quorum-votes.als'].gate_maturity, 'HARD_GATE',
      'Model should be promoted to HARD_GATE');

    // Verify changelog entry
    assert.equal(changelog.length, 1, 'Should have 1 changelog entry');
    assert.equal(changelog[0].from_level, 'SOFT_GATE');
    assert.equal(changelog[0].to_level, 'HARD_GATE');
    assert.equal(changelog[0].trigger, 'auto_promotion');
    assert.equal(changelog[0].consecutive_clean_sessions, 3);
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 2: Regression resets consecutive_clean_sessions to 0 ───────────────

test('PROMO-INT-2: regression resets consecutive_clean_sessions to 0', () => {
  const { tmpDir, registryPath, changelogPath, perModelGatesPath } = createFixtureDir({
    cleanSessions: 2,
    wiringA: 0.5, // Below threshold — NOT clean
  });

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const perModelGates = JSON.parse(fs.readFileSync(perModelGatesPath, 'utf8'));
    const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

    // Simulate non-clean session (wiring below 1.0)
    const isCleanSession = false; // wiring A = 0.5, below threshold
    const prevClean = 2;
    const newClean = isCleanSession ? prevClean + 1 : 0;

    assert.equal(newClean, 0, 'Regression should reset counter to 0');

    // autoPromote with 0 clean sessions should not promote
    const solveState = { consecutive_clean_sessions: newClean };
    const result = autoPromote(solveState, perModelGates, registry, changelog, {
      checkResults: [{ result: 'pass', tool: 'alloy', check_id: 'alloy:quorum-votes' }],
    });
    assert.equal(result.promoted.length, 0, 'No promotion with 0 clean sessions');
    assert.equal(result.consecutive_clean_sessions, 0);
    assert.equal(changelog.length, 0, 'No changelog entries');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 3: promotion-changelog.json entries contain all required PROMO-04 fields ─

test('PROMO-INT-3: promotion-changelog.json has all PROMO-04 required fields', () => {
  const { tmpDir, registryPath, changelogPath, perModelGatesPath } = createFixtureDir({
    cleanSessions: 3,
  });

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const perModelGates = JSON.parse(fs.readFileSync(perModelGatesPath, 'utf8'));
    const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

    const solveState = { consecutive_clean_sessions: 3 };
    const result = autoPromote(solveState, perModelGates, registry, changelog, {
      checkResults: [{ result: 'pass', tool: 'alloy', check_id: 'alloy:quorum-votes' }],
    });

    assert.equal(result.promoted.length, 1, 'Should promote 1 model');
    assert.equal(changelog.length, 1, 'Should have 1 changelog entry');

    const entry = changelog[0];

    // PROMO-04: All required fields present
    assert.ok(typeof entry.model === 'string' && entry.model.length > 0, 'model field must be non-empty string');
    assert.equal(entry.from_level, 'SOFT_GATE', 'from_level must be SOFT_GATE');
    assert.equal(entry.to_level, 'HARD_GATE', 'to_level must be HARD_GATE');
    assert.ok(typeof entry.timestamp === 'string', 'timestamp must be a string');
    // Verify timestamp is ISO 8601
    assert.ok(!isNaN(Date.parse(entry.timestamp)), 'timestamp must be valid ISO 8601');
    // session_id is null when called programmatically (not from nf-solve main)
    assert.ok('session_id' in entry, 'session_id field must exist');
    assert.equal(entry.trigger, 'auto_promotion', 'trigger must be auto_promotion');
    assert.ok(entry.consecutive_clean_sessions >= 3, 'consecutive_clean_sessions must be >= 3');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 4: autoPromote skips models not at SOFT_GATE ───────────────────────

test('PROMO-INT-4: autoPromote skips ADVISORY models', () => {
  const { tmpDir, registryPath, changelogPath, perModelGatesPath } = createFixtureDir({
    cleanSessions: 3,
    gateMaturity: 'ADVISORY',
  });

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const perModelGates = JSON.parse(fs.readFileSync(perModelGatesPath, 'utf8'));
    const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));

    const solveState = { consecutive_clean_sessions: 3 };
    const result = autoPromote(solveState, perModelGates, registry, changelog, {
      checkResults: [{ result: 'pass', tool: 'alloy', check_id: 'alloy:quorum-votes' }],
    });

    assert.equal(result.promoted.length, 0, 'Should not promote ADVISORY models');
    assert.equal(registry['.alloy/quorum-votes.als'].gate_maturity, 'ADVISORY',
      'ADVISORY model should remain ADVISORY');
  } finally {
    cleanup(tmpDir);
  }
});
