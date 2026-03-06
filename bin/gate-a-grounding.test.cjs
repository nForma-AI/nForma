#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { computeGateA, isMethodologySkip, checkGenuineViolation } = require('./gate-a-grounding.cjs');

// ── Unit tests: isMethodologySkip ───────────────────────────────────────────

describe('isMethodologySkip', () => {
  it('returns false for quorum_start (always valid from IDLE)', () => {
    assert.strictEqual(isMethodologySkip({ action: 'quorum_start', phase: 'COLLECTING' }), false);
  });

  it('returns true for mid-session non-quorum_start events', () => {
    assert.strictEqual(isMethodologySkip({ action: 'circuit_break', phase: 'COLLECTING_VOTES' }), true);
  });

  it('returns false for IDLE-phase events', () => {
    assert.strictEqual(isMethodologySkip({ action: 'circuit_break', phase: 'IDLE' }), false);
  });

  it('returns false for null input', () => {
    assert.strictEqual(isMethodologySkip(null), false);
  });
});

// ── Unit tests: explains definition ─────────────────────────────────────────

describe('explains definition', () => {
  it('vocabulary-mapped + xstate_valid = explained', () => {
    // An event that is in vocabulary and has a valid XState mapping from IDLE
    const events = [{ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'quorum_start', slots_available: 0 }];
    const vocab = { vocabulary: { quorum_start: { xstate_event: 'QUORUM_START' } } };
    const result = computeGateA(events, vocab, null, null);
    assert.strictEqual(result.explained, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.grounding_score, 1.0);
  });

  it('vocabulary-mapped + methodology_skip = explained', () => {
    // Mid-session event that gets H1 methodology skip
    const events = [{ ts: '2026-01-01T00:00:00Z', phase: 'COLLECTING_VOTES', action: 'quorum_complete', slots_available: 0 }];
    const vocab = { vocabulary: { quorum_complete: { xstate_event: 'VOTES_COLLECTED' } } };
    const result = computeGateA(events, vocab, null, null);
    assert.strictEqual(result.explained, 1, 'methodology_skip should count as explained');
    assert.strictEqual(result.methodology.h1_methodology_skips, 1);
  });

  it('NOT vocabulary-mapped = unexplained (instrumentation_bug)', () => {
    const events = [{ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'unknown_action', slots_available: 0 }];
    const vocab = { vocabulary: { quorum_start: {} } };
    const result = computeGateA(events, vocab, null, null);
    assert.strictEqual(result.explained, 0);
    assert.strictEqual(result.unexplained_counts.instrumentation_bug, 1);
  });

  it('grounding_score arithmetic with known dataset', () => {
    // 10 events: 8 IDLE quorum_start (explained), 2 unknown (unexplained)
    const events = [];
    for (let i = 0; i < 8; i++) {
      events.push({ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'quorum_start', slots_available: 0 });
    }
    for (let i = 0; i < 2; i++) {
      events.push({ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'unknown_action', slots_available: 0 });
    }
    const vocab = { vocabulary: { quorum_start: { xstate_event: 'QUORUM_START' } } };
    const result = computeGateA(events, vocab, null, null);
    assert.strictEqual(result.total, 10);
    assert.strictEqual(result.explained, 8);
    assert.ok(Math.abs(result.grounding_score - 0.8) < 0.001);
  });

  it('classification buckets are mutually exclusive', () => {
    const events = [
      { ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'quorum_start', slots_available: 0 },
      { ts: '2026-01-01T00:00:01Z', phase: 'IDLE', action: 'unknown_action', slots_available: 0 },
    ];
    const vocab = { vocabulary: { quorum_start: { xstate_event: 'QUORUM_START' } } };
    const result = computeGateA(events, vocab, null, null);
    const unexpTotal = result.unexplained_counts.instrumentation_bug +
      result.unexplained_counts.model_gap +
      result.unexplained_counts.genuine_violation;
    assert.strictEqual(unexpTotal, result.total - result.explained, 'Unexplained counts must sum to total - explained');
  });
});

// ── Unit tests: graceful degradation ────────────────────────────────────────

describe('graceful degradation', () => {
  it('works without invariant-catalog.json', () => {
    const events = [{ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'quorum_start', slots_available: 0 }];
    const vocab = { vocabulary: { quorum_start: { xstate_event: 'QUORUM_START' } } };
    const result = computeGateA(events, vocab, null, null);
    assert.ok(result.grounding_score >= 0);
    assert.strictEqual(result.unexplained_counts.genuine_violation, 0);
    assert.ok(result.warnings.some(w => w.includes('invariant-catalog')));
  });

  it('works without mismatch-register.jsonl', () => {
    const events = [{ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'quorum_start', slots_available: 0 }];
    const vocab = { vocabulary: { quorum_start: { xstate_event: 'QUORUM_START' } } };
    const result = computeGateA(events, vocab, { schema_version: '1', invariants: [] }, null);
    assert.ok(result.grounding_score >= 0);
    assert.ok(result.warnings.some(w => w.includes('mismatch-register')));
  });

  it('handles malformed invariant catalog gracefully', () => {
    const events = [{ ts: '2026-01-01T00:00:00Z', phase: 'IDLE', action: 'quorum_start', slots_available: 0 }];
    const vocab = { vocabulary: { quorum_start: { xstate_event: 'QUORUM_START' } } };
    // Missing invariants array
    const result = computeGateA(events, vocab, { schema_version: '1' }, null);
    assert.ok(result.grounding_score >= 0);
  });
});

// ── Integration tests ───────────────────────────────────────────────────────

describe('integration', () => {
  it('grounding_score > 0.50 (regression guard)', () => {
    const gatePath = path.join(ROOT, '.planning', 'formal', 'gates', 'gate-a-grounding.json');
    assert.ok(fs.existsSync(gatePath), 'gate-a-grounding.json should exist');
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    assert.ok(gate.grounding_score > 0.50,
      `REGRESSION WARNING: score ${gate.grounding_score} < 0.50`);
  });

  it('target_met is boolean', () => {
    const gatePath = path.join(ROOT, '.planning', 'formal', 'gates', 'gate-a-grounding.json');
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    assert.strictEqual(typeof gate.target_met, 'boolean');
  });

  it('unexplained_counts sum equals total - explained', () => {
    const gatePath = path.join(ROOT, '.planning', 'formal', 'gates', 'gate-a-grounding.json');
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    const unexpTotal = gate.unexplained_counts.instrumentation_bug +
      gate.unexplained_counts.model_gap +
      gate.unexplained_counts.genuine_violation;
    assert.strictEqual(unexpTotal, gate.total - gate.explained,
      `Unexplained ${unexpTotal} != total - explained (${gate.total - gate.explained})`);
  });

  it('methodology section documents the locked definition', () => {
    const gatePath = path.join(ROOT, '.planning', 'formal', 'gates', 'gate-a-grounding.json');
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    assert.ok(gate.methodology.explains_definition.includes('vocabulary_mapped'));
    assert.ok(gate.methodology.explains_definition.includes('xstate_valid'));
    assert.ok(gate.methodology.explains_definition.includes('methodology_skip'));
  });

  it('has schema_version and generated timestamp', () => {
    const gatePath = path.join(ROOT, '.planning', 'formal', 'gates', 'gate-a-grounding.json');
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    assert.strictEqual(gate.schema_version, '1');
    assert.ok(gate.generated);
  });
});
