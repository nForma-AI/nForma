#!/usr/bin/env node
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { checkGateB, resolveL2Link } = require('./gate-b-abstraction.cjs');

// ── Unit tests: resolveL2Link ───────────────────────────────────────────────

describe('resolveL2Link', () => {
  it('returns true for valid L2 dot-path (observed-fsm.json)', () => {
    const result = resolveL2Link({
      layer: 'L2',
      artifact: 'semantics/observed-fsm.json',
      ref: 'observed_transitions.IDLE.QUORUM_START',
    });
    assert.strictEqual(result, true);
  });

  it('returns false for broken L2 dot-path', () => {
    const result = resolveL2Link({
      layer: 'L2',
      artifact: 'semantics/observed-fsm.json',
      ref: 'observed_transitions.NONEXISTENT.EVENT',
    });
    assert.strictEqual(result, false);
  });

  it('returns true for valid array filter ref (invariant-catalog.json)', () => {
    const result = resolveL2Link({
      layer: 'L2',
      artifact: 'semantics/invariant-catalog.json',
      ref: 'invariants[config=MCQGSDQuorum]',
    });
    assert.strictEqual(result, true);
  });

  it('returns false for non-existent array filter', () => {
    const result = resolveL2Link({
      layer: 'L2',
      artifact: 'semantics/invariant-catalog.json',
      ref: 'invariants[config=MCNonExistent]',
    });
    assert.strictEqual(result, false);
  });

  it('returns true for JSONL file (mismatch-register.jsonl)', () => {
    const result = resolveL2Link({
      layer: 'L2',
      artifact: 'semantics/mismatch-register.jsonl',
      ref: 'entries',
    });
    assert.strictEqual(result, true);
  });

  it('returns false for non-existent artifact', () => {
    const result = resolveL2Link({
      layer: 'L2',
      artifact: 'semantics/nonexistent.json',
      ref: 'anything',
    });
    assert.strictEqual(result, false);
  });

  it('returns false for null/undefined link', () => {
    assert.strictEqual(resolveL2Link(null), false);
    assert.strictEqual(resolveL2Link(undefined), false);
    assert.strictEqual(resolveL2Link({}), false);
  });

  it('returns true for wildcard ref (sessions[*].actions)', () => {
    const result = resolveL2Link({
      layer: 'L1',
      artifact: 'evidence/trace-corpus-stats.json',
      ref: 'sessions[*].actions',
    });
    // Should resolve: sessions array exists
    assert.strictEqual(result, true);
  });
});

// ── Unit tests: checkGateB ──────────────────────────────────────────────────

describe('checkGateB', () => {
  it('entry with empty derived_from is orphaned', () => {
    const artifacts = [{
      name: 'test.json',
      entries: [{ id: 'TEST-1', derived_from: [] }],
    }];
    const result = checkGateB(artifacts);
    assert.strictEqual(result.orphaned_entries, 1);
    assert.strictEqual(result.grounded_entries, 0);
  });

  it('entry with missing derived_from is orphaned', () => {
    const artifacts = [{
      name: 'test.json',
      entries: [{ id: 'TEST-1' }],
    }];
    const result = checkGateB(artifacts);
    assert.strictEqual(result.orphaned_entries, 1);
  });

  it('entry with valid derived_from is grounded', () => {
    const artifacts = [{
      name: 'test.json',
      entries: [{
        id: 'TEST-1',
        derived_from: [
          { layer: 'L2', artifact: 'semantics/observed-fsm.json', ref: 'observed_transitions.IDLE.QUORUM_START' },
        ],
      }],
    }];
    const result = checkGateB(artifacts);
    assert.strictEqual(result.grounded_entries, 1);
    assert.strictEqual(result.orphaned_entries, 0);
  });

  it('gate_b_score computation is correct', () => {
    const artifacts = [{
      name: 'test.json',
      entries: [
        {
          id: 'TEST-1',
          derived_from: [
            { layer: 'L2', artifact: 'semantics/observed-fsm.json', ref: 'observed_transitions.IDLE.QUORUM_START' },
          ],
        },
        { id: 'TEST-2', derived_from: [] },
      ],
    }];
    const result = checkGateB(artifacts);
    assert.strictEqual(result.gate_b_score, 0.5);
    assert.strictEqual(result.target_met, false);
  });
});

// ── Integration tests with real data ────────────────────────────────────────

describe('integration: real L3 artifacts', () => {
  const ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
  const FORMAL = path.join(ROOT, '.planning', 'formal');
  const REASONING_DIR = path.join(FORMAL, 'reasoning');

  let result;

  before(() => {
    const l3Artifacts = [];

    const hazardPath = path.join(REASONING_DIR, 'hazard-model.json');
    if (fs.existsSync(hazardPath)) {
      const hm = JSON.parse(fs.readFileSync(hazardPath, 'utf8'));
      l3Artifacts.push({ name: 'hazard-model.json', entries: hm.hazards || [] });
    }

    const fmPath = path.join(REASONING_DIR, 'failure-mode-catalog.json');
    if (fs.existsSync(fmPath)) {
      const fm = JSON.parse(fs.readFileSync(fmPath, 'utf8'));
      l3Artifacts.push({ name: 'failure-mode-catalog.json', entries: fm.failure_modes || [] });
    }

    const rhPath = path.join(REASONING_DIR, 'risk-heatmap.json');
    if (fs.existsSync(rhPath)) {
      const rh = JSON.parse(fs.readFileSync(rhPath, 'utf8'));
      l3Artifacts.push({ name: 'risk-heatmap.json', entries: rh.transitions || [] });
    }

    result = checkGateB(l3Artifacts);
  });

  it('all entries are grounded (score = 1.0)', () => {
    assert.strictEqual(result.gate_b_score, 1.0, `Expected 1.0 but got ${result.gate_b_score}`);
    assert.strictEqual(result.target_met, true);
  });

  it('gate-b-abstraction.json has correct schema', () => {
    assert.strictEqual(result.schema_version, '1');
    assert.ok(result.generated);
    assert.strictEqual(typeof result.total_entries, 'number');
    assert.strictEqual(typeof result.grounded_entries, 'number');
    assert.strictEqual(typeof result.orphaned_entries, 'number');
    assert.ok(Array.isArray(result.orphans));
    assert.strictEqual(result.target, 1.0);
  });

  it('total entries equals sum of all L3 artifact entries', () => {
    // 16 hazards + 32 failure modes + 16 risk heatmap = 64
    assert.strictEqual(result.total_entries, 64);
  });

  it('zero orphans', () => {
    assert.strictEqual(result.orphaned_entries, 0);
    assert.strictEqual(result.orphans.length, 0);
  });
});
