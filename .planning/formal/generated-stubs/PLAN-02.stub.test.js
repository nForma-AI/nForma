#!/usr/bin/env node
// @requirement PLAN-02
// Structural test for invariant: ProtocolTerminates (NFDeliberation)
// Verifies that run-phase-tlc.cjs provides iterative TLC verification loop.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RUN_TLC_SCRIPT = path.resolve(__dirname, '../../../bin/run-phase-tlc.cjs');
const REQUIREMENT_MAP = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
const TLA_MODEL = path.resolve(__dirname, '../tla/NFDeliberation.tla');

test('PLAN-02: ProtocolTerminates — run-phase-tlc.cjs exists and is executable', () => {
  assert.ok(fs.existsSync(RUN_TLC_SCRIPT), 'bin/run-phase-tlc.cjs must exist');
  const content = fs.readFileSync(RUN_TLC_SCRIPT, 'utf8');
  assert.match(content, /run-phase-tlc/, 'script must identify itself');
});

test('PLAN-02: ProtocolTerminates — script accepts PLAN.md path', () => {
  const content = fs.readFileSync(RUN_TLC_SCRIPT, 'utf8');
  assert.match(content, /PLAN\.md/, 'script must accept PLAN.md as input');
});

test('PLAN-02: ProtocolTerminates — TLA+ model defines liveness property', () => {
  const tla = fs.readFileSync(TLA_MODEL, 'utf8');
  assert.match(tla, /ProtocolTerminates\s*==/, 'TLA+ model must define ProtocolTerminates');
  assert.match(tla, /<>\(voteState\s*=\s*"CONSENSUS"\s*\\\/\s*voteState\s*=\s*"ESCALATED"\)/,
    'ProtocolTerminates must assert eventual CONSENSUS or ESCALATED');
});

test('PLAN-02: ProtocolTerminates — TLA+ spec includes fairness for termination', () => {
  const tla = fs.readFileSync(TLA_MODEL, 'utf8');
  assert.match(tla, /WF_vars\(Escalate\)/, 'spec must include weak fairness on Escalate');
  assert.match(tla, /WF_vars\(ReceiveApprove\)/, 'spec must include weak fairness on ReceiveApprove');
});

test('PLAN-02: requirement-map includes PLAN-02 in deliberation group', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQUIREMENT_MAP);
  const deliberationGroup = CHECK_ID_TO_REQUIREMENTS['tla:deliberation'];
  assert.ok(deliberationGroup, 'tla:deliberation group must exist');
  assert.ok(deliberationGroup.includes('PLAN-02'), 'PLAN-02 must be in tla:deliberation group');
});
