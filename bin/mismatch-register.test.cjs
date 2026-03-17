#!/usr/bin/env node
'use strict';
// bin/mismatch-register.test.cjs
// Tests for mismatch register: JSONL format, resolution status, classification
// Requirements: SEM-02

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { buildMismatchRegister, buildMismatchEntry, isMethodologySkip } = require('./mismatch-register.cjs');

// ── Unit tests ───────────────────────────────────────────────────────────────

describe('isMethodologySkip', () => {
  it('returns false for quorum_start (always valid from IDLE)', () => {
    assert.strictEqual(isMethodologySkip({ action: 'quorum_start', phase: 'IDLE' }), false);
  });

  it('returns true for mid-session events (phase !== IDLE)', () => {
    assert.strictEqual(isMethodologySkip({ action: 'quorum_block', phase: 'DECIDING' }), true);
    assert.strictEqual(isMethodologySkip({ action: 'quorum_complete', phase: 'DECIDING' }), true);
  });

  it('returns false for IDLE-phase events other than quorum_start', () => {
    assert.strictEqual(isMethodologySkip({ action: 'circuit_break', phase: 'IDLE' }), false);
  });

  it('returns false for null/undefined input', () => {
    assert.strictEqual(isMethodologySkip(null), false);
    assert.strictEqual(isMethodologySkip(undefined), false);
  });
});

describe('buildMismatchEntry', () => {
  it('produces valid JSON with all required fields', () => {
    const entry = buildMismatchEntry(
      1,
      { ts: '2026-01-01T00:00:00Z', action: 'quorum_start', session_id: 'sess-1' },
      5, 'COLLECTING_VOTES', 'IDLE', 'state_mismatch', 'open', null, null
    );
    const json = JSON.stringify(entry);
    const parsed = JSON.parse(json);

    assert.strictEqual(parsed.id, 'MISMATCH-001');
    assert.strictEqual(parsed.resolution, 'open');
    assert.ok('l2_source' in parsed);
    assert.ok('l1_trace_ref' in parsed);
    assert.ok('expected_state' in parsed);
    assert.ok('actual_state' in parsed);
    assert.ok('divergence_type' in parsed);
  });

  it('defaults resolution to open for new mismatches', () => {
    const entry = buildMismatchEntry(2, { ts: '2026-01-01T00:00:00Z' }, 0, 'A', 'B', 'state_mismatch', undefined, null, null);
    assert.strictEqual(entry.resolution, 'open');
  });
});

describe('buildMismatchRegister', () => {
  it('produces entries array from conformance events', () => {
    const events = [
      { ts: '2026-01-01T00:00:00Z', action: 'quorum_start', phase: 'IDLE', slots_available: 2, outcome: null },
      { ts: '2026-01-01T00:00:01Z', action: 'quorum_block', phase: 'IDLE', outcome: 'BLOCK' },
    ];
    const result = buildMismatchRegister(events, {}, []);
    assert.ok(Array.isArray(result.entries), 'Should produce entries array');
    assert.ok(typeof result.summary.total_mismatches === 'number');
  });

  it('H1 methodology skip correctly classifies mid-session events as non-mismatches', () => {
    const events = [
      { ts: '2026-01-01T00:00:00Z', action: 'quorum_complete', phase: 'DECIDING', vote_result: 3, outcome: 'APPROVE' },
      { ts: '2026-01-01T00:00:01Z', action: 'quorum_block', phase: 'DECIDING', outcome: 'BLOCK' },
    ];
    const result = buildMismatchRegister(events, {}, []);
    // Both events have phase DECIDING -> methodology skip, NOT mismatches
    assert.strictEqual(result.summary.stats.methodology_skip, 2);
    assert.strictEqual(result.entries.length, 0, 'Mid-session events should not produce mismatches');
  });

  it('incorporates divergences.json entries with correct resolution', () => {
    const divergences = [
      {
        event: { ts: '2026-01-01T00:00:00Z', action: 'circuit_break', phase: 'DECIDING', _lineIndex: 5 },
        actualState: 'IDLE',
        expectedState: 'DECIDED',
        divergenceType: 'state_mismatch',
      },
    ];
    const result = buildMismatchRegister([], {}, divergences);
    assert.strictEqual(result.entries.length, 1);
    // phase=DECIDING -> H1 methodology skip -> resolution should be 'explained'
    assert.strictEqual(result.entries[0].resolution, 'explained');
    assert.ok(result.entries[0].resolution_notes.includes('H1'));
  });
});

// ── Integration tests ────────────────────────────────────────────────────────

describe('integration: JSONL output file', () => {
  it('reads real conformance events and produces valid JSONL', () => {
    const outputPath = path.join(__dirname, '..', '.planning', 'formal', 'semantics', 'mismatch-register.jsonl');

    // Run the script using spawnSync (no shell injection risk)
    const result = spawnSync(process.execPath, [path.join(__dirname, 'mismatch-register.cjs')], {
      cwd: path.join(__dirname, '..'),
      timeout: 30000,
    });
    assert.strictEqual(result.status, 0, 'Script should exit 0. stderr: ' + (result.stderr ? result.stderr.toString() : ''));

    assert.ok(fs.existsSync(outputPath), 'mismatch-register.jsonl should exist');

    const content = fs.readFileSync(outputPath, 'utf8');

    // Must NOT start with '[' (JSONL, not JSON array)
    // Empty file or file with only whitespace is valid when no mismatches exist.
    assert.ok(!content.startsWith('['), 'Must be JSONL format, not JSON array');

    // Each non-empty line must be valid JSON with required fields
    const lines = content.trim().split('\n').filter(l => l.trim());
    // lines.length may be 0 when conformance events show no mismatches — this is valid

    for (let i = 0; i < lines.length; i++) {
      const parsed = JSON.parse(lines[i]); // will throw if invalid
      assert.ok('resolution' in parsed, 'Line ' + i + ' must have resolution field');
      assert.ok(['open', 'explained', 'bug'].includes(parsed.resolution),
        'Line ' + i + ' resolution must be open/explained/bug, got: ' + parsed.resolution);
      assert.ok('id' in parsed, 'Line ' + i + ' must have id field');
      assert.ok('divergence_type' in parsed, 'Line ' + i + ' must have divergence_type');
    }
  });
});
