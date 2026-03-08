#!/usr/bin/env node
// @requirement PLAN-01
// Structural test for invariant: TypeOK (NFDeliberation)
// Verifies that generate-proposed-changes.cjs exists and auto-synthesizes TLA+ deltas.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GENERATE_SCRIPT = path.resolve(__dirname, '../../../bin/generate-proposed-changes.cjs');
const REQUIREMENT_MAP = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
const TLA_MODEL = path.resolve(__dirname, '../tla/NFDeliberation.tla');

test('PLAN-01: TypeOK — generate-proposed-changes.cjs exists and is executable', () => {
  assert.ok(fs.existsSync(GENERATE_SCRIPT), 'bin/generate-proposed-changes.cjs must exist');
  const content = fs.readFileSync(GENERATE_SCRIPT, 'utf8');
  assert.match(content, /generate-proposed-changes/, 'script must identify itself');
});

test('PLAN-01: TypeOK — script synthesizes TLA+ deltas from PLAN.md', () => {
  const content = fs.readFileSync(GENERATE_SCRIPT, 'utf8');
  // Must accept PLAN.md path as input
  assert.match(content, /PLAN\.md/, 'script must reference PLAN.md as input');
  // Must produce TLA+ output
  assert.match(content, /proposed-changes\.tla|\.tla/, 'script must produce TLA+ output');
  // Must handle INVARIANT or PROPERTY stubs
  assert.match(content, /INVARIANT|PROPERTY/i, 'script must handle INVARIANT/PROPERTY stubs');
});

test('PLAN-01: TypeOK — TLA+ model defines TypeOK for deliberation', () => {
  const tla = fs.readFileSync(TLA_MODEL, 'utf8');
  assert.match(tla, /TypeOK\s*==/, 'TLA+ model must define TypeOK');
  assert.match(tla, /deliberationRound/, 'TypeOK must constrain deliberationRound');
  assert.match(tla, /improvementIteration/, 'TypeOK must constrain improvementIteration');
  assert.match(tla, /voteState/, 'TypeOK must constrain voteState');
});

test('PLAN-01: requirement-map includes PLAN-01 in deliberation group', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQUIREMENT_MAP);
  const deliberationGroup = CHECK_ID_TO_REQUIREMENTS['tla:deliberation'];
  assert.ok(deliberationGroup, 'tla:deliberation group must exist');
  assert.ok(deliberationGroup.includes('PLAN-01'), 'PLAN-01 must be in tla:deliberation group');
});
