#!/usr/bin/env node
'use strict';
/** @requirement SEM-03 — validates semantic scoring to gate enrichment to auto-promotion E2E pipeline */

/**
 * test/e2e-semantic-promotion-pipeline.test.cjs
 * End-to-end integration test for the semantic scoring -> gate enrichment -> auto-promotion pipeline.
 *
 * Validates: SEM-03, SEM-04, PROMO-02, PROMO-03, PROMO-04
 * Uses real exported functions from bin/ scripts (no mocks).
 *
 * Phase: v0.34-06 — E2E Integration Test
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { enrichGateFile } = require('../bin/compute-semantic-scores.cjs');
const { autoPromote } = require('../bin/promote-gate-maturity.cjs');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a minimal fixture directory mimicking .planning/formal/ structure.
 */
function createFixtureDir(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-e2e-sem-'));
  const gatesDir = path.join(tmpDir, 'gates');
  fs.mkdirSync(gatesDir, { recursive: true });

  // Gate files — schema_version '2', wiring scores only (no semantic_score initially)
  fs.writeFileSync(path.join(gatesDir, 'gate-a-grounding.json'), JSON.stringify({
    schema_version: '2',
    wiring_evidence_score: opts.wiringA != null ? opts.wiringA : 1.0,
  }));
  fs.writeFileSync(path.join(gatesDir, 'gate-b-abstraction.json'), JSON.stringify({
    schema_version: '2',
    wiring_purpose_score: opts.wiringB != null ? opts.wiringB : 1.0,
  }));
  fs.writeFileSync(path.join(gatesDir, 'gate-c-validation.json'), JSON.stringify({
    schema_version: '2',
    wiring_coverage_score: opts.wiringC != null ? opts.wiringC : 1.0,
  }));

  // model-registry.json with one SOFT_GATE model
  const registry = {
    '.alloy/quorum-votes.als': {
      gate_maturity: 'SOFT_GATE',
      evidence_readiness: { score: 3, total: 5 },
      source_layer: 'L3',
      last_updated: new Date().toISOString(),
    },
  };
  const registryPath = path.join(tmpDir, 'model-registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  // per-model-gates.json — all gates pass
  const perModelGates = {
    models: {
      '.alloy/quorum-votes.als': {
        gate_a: { pass: true, score: 1.0 },
        gate_b: { pass: true, score: 1.0 },
        gate_c: { pass: true, score: 1.0 },
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

  // check-results.ndjson — no counterexamples
  fs.writeFileSync(path.join(tmpDir, 'check-results.ndjson'), '{"result":"no_counterexample"}\n');

  return { tmpDir, gatesDir, registryPath, changelogPath, perModelGatesPath, solveStatePath };
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

/**
 * Enrich gate files using the REAL enrichGateFile() from compute-semantic-scores.cjs.
 * @param {string} gatesDir - Path to gates directory
 * @param {{ A: number, B: number, C: number }} scores - Semantic scores per gate
 */
function enrichGates(gatesDir, scores) {
  const files = {
    A: 'gate-a-grounding.json',
    B: 'gate-b-abstraction.json',
    C: 'gate-c-validation.json',
  };
  for (const [label, filename] of Object.entries(files)) {
    const filePath = path.join(gatesDir, filename);
    const gateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const enriched = enrichGateFile(gateData, scores[label], {
      evaluated_candidates: 1, confirmed: 1, rejected: 0, maybe: 0,
      computed: new Date().toISOString(),
    });
    fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2));
  }
}

/**
 * Simulate one nf-solve.cjs iteration.
 * Mirrors nf-solve.cjs checkCleanSession() thresholds: wiring >= 1.0, semantic >= 0.8, formalPass.
 */
function simulateSolveIteration(tmpDir, opts = {}) {
  const gatesDir = path.join(tmpDir, 'gates');

  // Step 1: Enrich gates with semantic scores if provided
  if (opts.semantic) {
    enrichGates(gatesDir, opts.semantic);
  }

  // Step 2: Evaluate cleanliness (mirrors nf-solve.cjs checkCleanSession())
  const GATE_FILES = {
    A: { file: 'gate-a-grounding.json', wiringKey: 'wiring_evidence_score' },
    B: { file: 'gate-b-abstraction.json', wiringKey: 'wiring_purpose_score' },
    C: { file: 'gate-c-validation.json', wiringKey: 'wiring_coverage_score' },
  };

  const wiring = {};
  const semantic = {};
  for (const [label, cfg] of Object.entries(GATE_FILES)) {
    const gateData = JSON.parse(fs.readFileSync(path.join(gatesDir, cfg.file), 'utf8'));
    wiring[label] = gateData[cfg.wiringKey] != null ? gateData[cfg.wiringKey] : 0;
    semantic[label] = gateData.semantic_score != null ? gateData.semantic_score : 0;
  }

  const formalPass = opts.formalPass !== false;
  const wiringClean = wiring.A >= 1.0 && wiring.B >= 1.0 && wiring.C >= 1.0;
  const semanticClean = semantic.A >= 0.8 && semantic.B >= 0.8 && semantic.C >= 0.8;
  const isClean = wiringClean && semanticClean && formalPass;

  // Step 3-5: Update solve-state.json
  const solveStatePath = path.join(tmpDir, 'solve-state.json');
  const state = JSON.parse(fs.readFileSync(solveStatePath, 'utf8'));
  const prevClean = state.consecutive_clean_sessions || 0;
  const newClean = isClean ? prevClean + 1 : 0;
  state.consecutive_clean_sessions = newClean;
  fs.writeFileSync(solveStatePath, JSON.stringify(state, null, 2));

  return { isClean, consecutive: newClean };
}

// ── Test 1: E2E-SEM-1 ──────────────────────────────────────────────────────

test('E2E-SEM-1: gate files enriched with semantic_score via enrichGateFile()', () => {
  const { tmpDir, gatesDir } = createFixtureDir();

  try {
    // Verify initial state: no semantic_score, schema_version '2'
    const gateABefore = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-a-grounding.json'), 'utf8'));
    assert.equal(gateABefore.semantic_score, undefined, 'gate-a should have no semantic_score before enrichment');
    assert.equal(gateABefore.schema_version, '2', 'gate-a should be schema_version 2 before enrichment');

    // Enrich using real enrichGateFile()
    enrichGates(gatesDir, { A: 0.85, B: 0.9, C: 0.88 });

    // Verify enrichment results
    const gateA = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-a-grounding.json'), 'utf8'));
    const gateB = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-b-abstraction.json'), 'utf8'));
    const gateC = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-c-validation.json'), 'utf8'));

    assert.equal(gateA.semantic_score, 0.85, 'gate-a semantic_score should be 0.85');
    assert.equal(gateA.schema_version, '3', 'gate-a schema_version should be bumped to 3');
    assert.equal(gateB.semantic_score, 0.9, 'gate-b semantic_score should be 0.9');
    assert.equal(gateB.schema_version, '3', 'gate-b schema_version should be bumped to 3');
    assert.equal(gateC.semantic_score, 0.88, 'gate-c semantic_score should be 0.88');
    assert.equal(gateC.schema_version, '3', 'gate-c schema_version should be bumped to 3');

    // Wiring scores preserved through enrichment
    assert.equal(gateA.wiring_evidence_score, 1.0, 'gate-a wiring_evidence_score preserved');
    assert.equal(gateB.wiring_purpose_score, 1.0, 'gate-b wiring_purpose_score preserved');
    assert.equal(gateC.wiring_coverage_score, 1.0, 'gate-c wiring_coverage_score preserved');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 2: E2E-SEM-2 ──────────────────────────────────────────────────────

test('E2E-SEM-2: semantic_score fields persist across multiple enrichment cycles', () => {
  const { tmpDir, gatesDir } = createFixtureDir();

  try {
    // Step 1 — Enrichment cycle 1
    enrichGates(gatesDir, { A: 0.85, B: 0.9, C: 0.88 });

    const gateA1 = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-a-grounding.json'), 'utf8'));
    assert.equal(gateA1.semantic_score, 0.85, 'cycle 1: gate-a semantic_score should be 0.85');
    assert.equal(gateA1.schema_version, '3', 'cycle 1: gate-a schema_version should be 3');

    // Step 2 — Simulate external gate rewrite (spread operator preserves fields)
    for (const filename of ['gate-a-grounding.json', 'gate-b-abstraction.json', 'gate-c-validation.json']) {
      const filePath = path.join(gatesDir, filename);
      const gateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Simulate compute-per-model-gates.cjs rewriting with spread
      const rewritten = { ...gateData, wiring_evidence_score: 1.0 };
      fs.writeFileSync(filePath, JSON.stringify(rewritten, null, 2));
    }

    // Step 3 — Assert preservation after external rewrite
    const gateA2 = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-a-grounding.json'), 'utf8'));
    assert.equal(gateA2.semantic_score, 0.85, 'semantic_score preserved after external rewrite');
    assert.equal(gateA2.schema_version, '3', 'schema_version preserved after external rewrite');

    // Step 4 — Enrichment cycle 2 with different scores
    enrichGates(gatesDir, { A: 0.9, B: 0.95, C: 0.92 });

    const gateA3 = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-a-grounding.json'), 'utf8'));
    const gateB3 = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-b-abstraction.json'), 'utf8'));
    const gateC3 = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-c-validation.json'), 'utf8'));

    assert.equal(gateA3.semantic_score, 0.9, 'cycle 2: gate-a semantic_score updated to 0.9');
    assert.equal(gateB3.semantic_score, 0.95, 'cycle 2: gate-b semantic_score updated to 0.95');
    assert.equal(gateC3.semantic_score, 0.92, 'cycle 2: gate-c semantic_score updated to 0.92');
    assert.equal(gateA3.schema_version, '3', 'cycle 2: schema_version still 3');

    // semantic_metadata updated (not stale from cycle 1)
    assert.ok(gateA3.semantic_metadata, 'semantic_metadata should be present after cycle 2');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 3: E2E-PROMO-1 ────────────────────────────────────────────────────

test('E2E-PROMO-1: 3 consecutive clean sessions trigger auto-promotion', () => {
  const { tmpDir, registryPath, changelogPath, perModelGatesPath } = createFixtureDir({
    cleanSessions: 0,
  });

  try {
    // Iteration 1
    const r1 = simulateSolveIteration(tmpDir, { semantic: { A: 0.85, B: 0.9, C: 0.88 } });
    assert.equal(r1.isClean, true, 'iteration 1 should be clean');
    assert.equal(r1.consecutive, 1, 'iteration 1 consecutive should be 1');

    // Iteration 2
    const r2 = simulateSolveIteration(tmpDir, { semantic: { A: 0.85, B: 0.9, C: 0.88 } });
    assert.equal(r2.isClean, true, 'iteration 2 should be clean');
    assert.equal(r2.consecutive, 2, 'iteration 2 consecutive should be 2');

    // Iteration 3
    const r3 = simulateSolveIteration(tmpDir, { semantic: { A: 0.85, B: 0.9, C: 0.88 } });
    assert.equal(r3.isClean, true, 'iteration 3 should be clean');
    assert.equal(r3.consecutive, 3, 'iteration 3 consecutive should be 3');

    // Now call autoPromote() with real function
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const perModelGates = JSON.parse(fs.readFileSync(perModelGatesPath, 'utf8'));
    const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    const solveState = { consecutive_clean_sessions: 3 };

    const result = autoPromote(solveState, perModelGates, registry, changelog, {
      checkResults: [{ result: 'pass', tool: 'alloy', check_id: 'alloy:quorum-votes' }],
    });

    assert.equal(result.promoted.length, 1, 'should promote 1 model');
    assert.equal(registry['.alloy/quorum-votes.als'].gate_maturity, 'HARD_GATE',
      'model should be promoted to HARD_GATE');
    assert.equal(changelog.length, 1, 'should have 1 changelog entry');
    assert.equal(changelog[0].trigger, 'auto_promotion', 'trigger should be auto_promotion');
    assert.equal(changelog[0].consecutive_clean_sessions, 3, 'consecutive_clean_sessions should be 3');
    assert.equal(changelog[0].from_level, 'SOFT_GATE', 'from_level should be SOFT_GATE');
    assert.equal(changelog[0].to_level, 'HARD_GATE', 'to_level should be HARD_GATE');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 4: E2E-PROMO-2 ────────────────────────────────────────────────────

test('E2E-PROMO-2: regression resets consecutive_clean_sessions to 0', () => {
  const { tmpDir, gatesDir } = createFixtureDir({ cleanSessions: 0 });

  try {
    // Run 3 clean iterations
    for (let i = 0; i < 3; i++) {
      simulateSolveIteration(tmpDir, { semantic: { A: 0.85, B: 0.9, C: 0.88 } });
    }
    const stateAfter3 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'solve-state.json'), 'utf8'));
    assert.equal(stateAfter3.consecutive_clean_sessions, 3, 'should have 3 clean sessions');

    // Iteration 4: semantic regression — gate A drops below 0.8
    const r4 = simulateSolveIteration(tmpDir, { semantic: { A: 0.75, B: 0.9, C: 0.88 } });
    assert.equal(r4.isClean, false, 'iteration 4 should not be clean (A=0.75 < 0.8)');
    assert.equal(r4.consecutive, 0, 'regression should reset consecutive to 0');

    // Verify on disk
    const stateOnDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'solve-state.json'), 'utf8'));
    assert.equal(stateOnDisk.consecutive_clean_sessions, 0, 'solve-state.json should have 0 consecutive');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Test 5: E2E-PROMO-3 ────────────────────────────────────────────────────

test('E2E-PROMO-3: promotion-changelog.json has all PROMO-04 required fields', () => {
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

    assert.equal(result.promoted.length, 1, 'should promote 1 model');
    assert.equal(changelog.length, 1, 'should have 1 changelog entry');

    const entry = changelog[0];

    // PROMO-04: All 8 required fields
    assert.ok(typeof entry.model === 'string' && entry.model.length > 0,
      'model field must be non-empty string');
    assert.equal(entry.from_level, 'SOFT_GATE', 'from_level must be SOFT_GATE');
    assert.equal(entry.to_level, 'HARD_GATE', 'to_level must be HARD_GATE');
    assert.ok(typeof entry.timestamp === 'string', 'timestamp must be a string');
    assert.ok(!isNaN(Date.parse(entry.timestamp)), 'timestamp must be valid ISO 8601');
    assert.ok('session_id' in entry, 'session_id field must exist');
    assert.equal(entry.trigger, 'auto_promotion', 'trigger must be auto_promotion');
    assert.ok(entry.consecutive_clean_sessions >= 3,
      'consecutive_clean_sessions must be >= 3');
    assert.ok('evidence_readiness' in entry, 'evidence_readiness field must exist');
    assert.ok(typeof entry.evidence_readiness === 'object',
      'evidence_readiness must be an object');
    assert.ok('score' in entry.evidence_readiness,
      'evidence_readiness must have score key');
    assert.ok('total' in entry.evidence_readiness,
      'evidence_readiness must have total key');
  } finally {
    cleanup(tmpDir);
  }
});
