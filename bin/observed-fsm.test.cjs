#!/usr/bin/env node
'use strict';
// bin/observed-fsm.test.cjs
// Tests for observed FSM: transition extraction, model comparison, coverage metrics
// Requirements: SEM-04

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  buildObservedFSM,
  extractModelTransitions,
  normalizeState,
  replayPerEvent,
  mergeAdjacencyMaps,
  compareWithModel,
} = require('./observed-fsm.cjs');

// ── Unit tests ───────────────────────────────────────────────────────────────

describe('normalizeState', () => {
  it('returns string values as-is', () => {
    assert.strictEqual(normalizeState('IDLE'), 'IDLE');
  });

  it('extracts key from single-key objects', () => {
    assert.strictEqual(normalizeState({ COLLECTING_VOTES: 'active' }), 'COLLECTING_VOTES');
  });
});

describe('extractModelTransitions', () => {
  it('extracts transitions from a simple config', () => {
    const config = {
      states: {
        IDLE: { on: { START: [{ target: 'ACTIVE' }] } },
        ACTIVE: { on: { STOP: [{ target: 'IDLE' }] } },
      },
    };
    const transitions = extractModelTransitions(config, '');
    assert.ok(transitions.length >= 2);
    assert.ok(transitions.some(t => t.from === 'IDLE' && t.event === 'START'));
    assert.ok(transitions.some(t => t.from === 'ACTIVE' && t.event === 'STOP'));
  });
});

describe('replayPerEvent', () => {
  it('builds correct adjacency map from small inline event array', () => {
    const { mapToXStateEvent } = require('./validate-traces.cjs');
    const machinePath = path.join(__dirname, '..', 'dist', 'machines', 'nf-workflow.machine.js');
    const { createActor, nfWorkflowMachine } = require(machinePath);

    const events = [
      { action: 'quorum_start', phase: 'IDLE', slots_available: 2 },
      { action: 'quorum_start', phase: 'IDLE', slots_available: 3 },
      { action: 'circuit_break', phase: 'IDLE' },
    ];

    const result = replayPerEvent(events, mapToXStateEvent, createActor, nfWorkflowMachine);

    // All 3 events should be mapped
    assert.strictEqual(result.mapped, 3);
    assert.strictEqual(result.unmapped, 0);

    // IDLE -> QUORUM_START should be in adjacency map
    assert.ok(result.adjacencyMap['IDLE'], 'Should have IDLE state');
    assert.ok(result.adjacencyMap['IDLE']['QUORUM_START'], 'Should have QUORUM_START from IDLE');
    assert.strictEqual(result.adjacencyMap['IDLE']['QUORUM_START'].count, 2);

    // IDLE -> CIRCUIT_BREAK -> IDLE (self-loop)
    assert.ok(result.adjacencyMap['IDLE']['CIRCUIT_BREAK'], 'Should have CIRCUIT_BREAK from IDLE');
    assert.strictEqual(result.adjacencyMap['IDLE']['CIRCUIT_BREAK'].to_state, 'IDLE');
  });
});

describe('compareWithModel', () => {
  it('correctly identifies missing transitions', () => {
    const observed = {
      'IDLE': { 'START': { to_state: 'ACTIVE', count: 5, source: 'per_event' } },
    };
    const modelTransitions = [
      { from: 'IDLE', event: 'START', to: 'ACTIVE' },
      { from: 'ACTIVE', event: 'STOP', to: 'IDLE' },
    ];
    const result = compareWithModel(observed, modelTransitions);
    assert.strictEqual(result.matching.length, 1);
    assert.strictEqual(result.missing_in_observed.length, 1);
    assert.strictEqual(result.missing_in_observed[0].from, 'ACTIVE');
  });

  it('detects transitions observed but not in model', () => {
    const observed = {
      'IDLE': { 'UNKNOWN_EVT': { to_state: 'WEIRD', count: 1, source: 'per_session' } },
    };
    const modelTransitions = [];
    const result = compareWithModel(observed, modelTransitions);
    assert.strictEqual(result.missing_in_model.length, 1);
    assert.strictEqual(result.missing_in_model[0].event, 'UNKNOWN_EVT');
  });
});

describe('mergeAdjacencyMaps', () => {
  it('marks transitions seen in both modes as both', () => {
    const mapA = { 'IDLE': { 'START': { to_state: 'ACTIVE', count: 5, source: 'per_event' } } };
    const mapB = { 'IDLE': { 'START': { to_state: 'ACTIVE', count: 3, source: 'per_session' } } };
    const merged = mergeAdjacencyMaps(mapA, mapB);
    assert.strictEqual(merged['IDLE']['START'].source, 'both');
    // per_event count is authoritative
    assert.strictEqual(merged['IDLE']['START'].count, 5);
  });

  it('adds per-session-only transitions', () => {
    const mapA = { 'IDLE': { 'START': { to_state: 'ACTIVE', count: 5, source: 'per_event' } } };
    const mapB = { 'ACTIVE': { 'STOP': { to_state: 'IDLE', count: 2, source: 'per_session' } } };
    const merged = mergeAdjacencyMaps(mapA, mapB);
    assert.ok(merged['ACTIVE'], 'Should have ACTIVE state from per-session');
    assert.strictEqual(merged['ACTIVE']['STOP'].source, 'per_session');
  });
});

describe('coverage metrics', () => {
  it('computes coverage correctly from small event set', () => {
    const events = [
      { action: 'quorum_start', phase: 'IDLE', slots_available: 2 },
      { action: 'undefined', phase: 'IDLE' }, // unmapped
    ];
    const result = buildObservedFSM(events, {});
    assert.strictEqual(result.coverage.total_events, 2);
    assert.strictEqual(result.coverage.mapped_events, 1);
    assert.strictEqual(result.coverage.unmapped_events, 1);
    assert.strictEqual(result.coverage.vocabulary_coverage, 0.5);
  });
});

// ── Integration tests ────────────────────────────────────────────────────────

describe('integration: observed-fsm.json output', () => {
  it('reads real traces and produces valid observed FSM', () => {
    const outputPath = path.join(__dirname, '..', '.planning', 'formal', 'semantics', 'observed-fsm.json');

    // Run the script
    const result = spawnSync(process.execPath, [path.join(__dirname, 'observed-fsm.cjs')], {
      cwd: path.join(__dirname, '..'),
      timeout: 60000,
    });
    assert.strictEqual(result.status, 0, 'Script should exit 0. stderr: ' + (result.stderr ? result.stderr.toString() : ''));

    assert.ok(fs.existsSync(outputPath), 'observed-fsm.json should exist');
    const fsm = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Must have observed states
    assert.ok(fsm.states_observed.length > 0, 'Must have observed states');

    // Vocabulary coverage must be < 1.0 (5,649+ unmapped events exist)
    assert.ok(fsm.coverage.vocabulary_coverage < 1.0,
      'Vocab coverage must be < 1.0, got: ' + fsm.coverage.vocabulary_coverage);

    // Must NOT be an XState machine definition
    assert.ok(!('initial' in fsm), 'Must NOT have XState "initial" key');
    assert.ok(!('states' in fsm), 'Must NOT have XState "states" key');

    // Must have required structure
    assert.ok('observed_transitions' in fsm);
    assert.ok('model_comparison' in fsm);
    assert.ok('coverage' in fsm);
    assert.ok('replay_modes' in fsm);
    assert.ok('schema_version' in fsm);
  });

  it('per-session replay captures multi-step transitions', () => {
    const outputPath = path.join(__dirname, '..', '.planning', 'formal', 'semantics', 'observed-fsm.json');
    const fsm = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    // Per-session should have replayed some sessions
    assert.ok(fsm.replay_modes.sessions_replayed > 0,
      'Should have replayed sessions, got: ' + fsm.replay_modes.sessions_replayed);
    assert.ok(fsm.replay_modes.per_session_transitions > 0,
      'Should have per-session transitions, got: ' + fsm.replay_modes.per_session_transitions);
  });
});
