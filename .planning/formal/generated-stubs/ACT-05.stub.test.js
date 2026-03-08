#!/usr/bin/env node
// @requirement ACT-05
// Auto-generated stub for uncovered invariant: StageTransition

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const executePhaseWorkflow = fs.readFileSync(
  path.resolve(__dirname, '../../../core/workflows/execute-phase.md'),
  'utf8'
);

test('ACT-05 — StageTransition: execute-phase writes activity at plan execution entry', () => {
  assert.match(executePhaseWorkflow, /activity-set.*executing_plan/s,
    'execute-phase must write activity with sub_activity=executing_plan');
});

test('ACT-05 — StageTransition: execute-phase writes activity at checkpoint:verify', () => {
  assert.match(executePhaseWorkflow, /activity-set.*checkpoint_verify/s,
    'execute-phase must write activity with sub_activity=checkpoint_verify');
});

test('ACT-05 — StageTransition: execute-phase writes activity at debug loop', () => {
  assert.match(executePhaseWorkflow, /activity-set.*debug_loop/s,
    'execute-phase must write activity with sub_activity=debug_loop');
});

test('ACT-05 — StageTransition: execute-phase writes activity at awaiting_human_verify', () => {
  assert.match(executePhaseWorkflow, /activity-set.*awaiting_human_verify/s,
    'execute-phase must write activity with sub_activity=awaiting_human_verify');
});

test('ACT-05 — StageTransition: execute-phase writes activity at verifying_phase', () => {
  assert.match(executePhaseWorkflow, /activity-set.*verifying_phase/s,
    'execute-phase must write activity with sub_activity=verifying_phase');
});
