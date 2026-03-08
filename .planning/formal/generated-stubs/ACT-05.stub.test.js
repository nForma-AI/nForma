#!/usr/bin/env node
// @requirement ACT-05
// Structural test: execute-phase writes activity at every stage boundary

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EP_PATH = path.join(process.env.HOME, '.claude/nf/workflows/execute-phase.md');

test('ACT-05: execute-phase workflow uses activity-set calls', () => {
  const content = fs.readFileSync(EP_PATH, 'utf8');
  assert.match(content, /activity-set/, 'execute-phase must call activity-set');
});

test('ACT-05: execute-phase tracks executing_plan stage boundary', () => {
  const content = fs.readFileSync(EP_PATH, 'utf8');
  assert.match(content, /executing_plan/, 'must track executing_plan sub_activity');
});

test('ACT-05: execute-phase tracks checkpoint_verify stage boundary', () => {
  const content = fs.readFileSync(EP_PATH, 'utf8');
  assert.match(content, /checkpoint_verify/, 'must track checkpoint_verify sub_activity');
});

test('ACT-05: execute-phase tracks debug_loop stage boundary', () => {
  const content = fs.readFileSync(EP_PATH, 'utf8');
  assert.match(content, /debug_loop/, 'must track debug_loop sub_activity');
});

test('ACT-05: execute-phase tracks awaiting_human_verify stage boundary', () => {
  const content = fs.readFileSync(EP_PATH, 'utf8');
  assert.match(content, /awaiting_human_verify/, 'must track awaiting_human_verify sub_activity');
});

test('ACT-05: execute-phase tracks verifying_phase stage boundary', () => {
  const content = fs.readFileSync(EP_PATH, 'utf8');
  assert.match(content, /verifying_phase/, 'must track verifying_phase sub_activity');
});

test('ACT-05: TLA+ model defines StageTransition action for ACT-05', () => {
  const tlaPath = path.join(__dirname, '../tla/QGSDActivityTracking.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /StageTransition\s*==/, 'TLA+ model must define StageTransition action');
  assert.match(content, /@requirement ACT-05/, 'TLA+ model must tag ACT-05 requirement');
});
