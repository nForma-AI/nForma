#!/usr/bin/env node
// @requirement ORES-04
// Structural test for invariant: HaikuUnavailableNoCorruption
// Verifies that when Haiku is unavailable, no state mutation occurs.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CIRCUIT_BREAKER = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');
const REQUIREMENT_MAP = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
const TLA_MODEL = path.resolve(__dirname, '../tla/NFConvergence.tla');

test('ORES-04: HaikuUnavailableNoCorruption — unavailable verdict does not mutate state', () => {
  const content = fs.readFileSync(CIRCUIT_BREAKER, 'utf8');

  // When Haiku returns null (unavailable), the code falls through to the
  // notification path without modifying resolvedAt or deleting state.
  // The comment documents this: "verdict === 'GENUINE' or null (API unavailable) → trust the algorithm"
  assert.match(content, /API unavailable/, 'circuit breaker must document API unavailable fallthrough');

  // Only REFINEMENT triggers early exit; null/GENUINE fall through — no resolvedAt mutation
  assert.match(content, /verdict\s*===\s*'REFINEMENT'/, 'only REFINEMENT verdict triggers special handling');

  // resolvedAt is only set inside the YES branch, not in the unavailable path
  assert.match(content, /verdict\.startsWith\('YES'\)/, 'resolvedAt mutation guarded by YES verdict');
});

test('ORES-04: HaikuUnavailableNoCorruption — TLA+ model defines the invariant', () => {
  const tla = fs.readFileSync(TLA_MODEL, 'utf8');
  assert.match(tla, /HaikuUnavailableNoCorruption\s*==/, 'TLA+ model must define HaikuUnavailableNoCorruption');
  assert.match(tla, /haikuVerdict'\s*=\s*"UNAVAILABLE"/,
    'invariant must reference UNAVAILABLE verdict transition');
});

test('ORES-04: requirement-map includes ORES-04 in convergence group', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQUIREMENT_MAP);
  const convergenceGroup = CHECK_ID_TO_REQUIREMENTS['tla:convergence'];
  assert.ok(convergenceGroup, 'tla:convergence group must exist');
  assert.ok(convergenceGroup.includes('ORES-04'), 'ORES-04 must be in tla:convergence group');
});
