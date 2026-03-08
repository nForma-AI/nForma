#!/usr/bin/env node
// @requirement ORES-05
// Structural test for invariant: ConvergenceEventuallyResolves
// Verifies that the system has a path to resolve oscillations (logWritten=TRUE).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CIRCUIT_BREAKER = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');
const REQUIREMENT_MAP = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
const TLA_MODEL = path.resolve(__dirname, '../tla/NFConvergence.tla');

test('ORES-05: ConvergenceEventuallyResolves — circuit breaker has resolution path', () => {
  const content = fs.readFileSync(CIRCUIT_BREAKER, 'utf8');

  // The HaikuReturnsYES action sets resolvedAt, achieving logWritten=TRUE
  assert.match(content, /resolvedAt\s*=\s*now/, 'circuit breaker must set resolvedAt on resolution');

  // State file deletion occurs after log write (LogBeforeDelete satisfied)
  assert.match(content, /writeOscillationLog/, 'resolution must write to oscillation log');
  assert.match(content, /circuit.breaker.cleared/i, 'resolution must signal breaker cleared');
});

test('ORES-05: ConvergenceEventuallyResolves — escalation path exists for non-consensus', () => {
  const content = fs.readFileSync(CIRCUIT_BREAKER, 'utf8');

  // If no consensus after max rounds, requirement ORES-05 says escalate to human.
  // The circuit breaker achieves this by keeping the breaker active (deny decisions)
  // until Haiku confirms resolution — the human sees the deny reason.
  assert.match(content, /permissionDecision.*deny/s, 'breaker must deny tools when active');
  assert.match(content, /buildBlockReason/, 'breaker must provide block reason for human escalation');
});

test('ORES-05: ConvergenceEventuallyResolves — TLA+ model defines the liveness property', () => {
  const tla = fs.readFileSync(TLA_MODEL, 'utf8');
  assert.match(tla, /ConvergenceEventuallyResolves\s*==/, 'TLA+ model must define ConvergenceEventuallyResolves');
  assert.match(tla, /<>\(logWritten\s*=\s*TRUE\)/, 'liveness property must assert eventual resolution');
  // Weak fairness on HaikuReturnsYES ensures progress
  assert.match(tla, /WF_vars\(HaikuReturnsYES\)/, 'spec must include weak fairness on HaikuReturnsYES');
});

test('ORES-05: requirement-map includes ORES-05 in convergence group', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQUIREMENT_MAP);
  const convergenceGroup = CHECK_ID_TO_REQUIREMENTS['tla:convergence'];
  assert.ok(convergenceGroup, 'tla:convergence group must exist');
  assert.ok(convergenceGroup.includes('ORES-05'), 'ORES-05 must be in tla:convergence group');
});
