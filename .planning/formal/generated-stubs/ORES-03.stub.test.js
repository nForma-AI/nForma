#!/usr/bin/env node
// @requirement ORES-03
// Structural test for invariant: ResolvedAtWriteOnce
// Verifies that resolvedAt is write-once in the circuit breaker source.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CIRCUIT_BREAKER = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');
const REQUIREMENT_MAP = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
const TLA_MODEL = path.resolve(__dirname, '../tla/NFConvergence.tla');

test('ORES-03: ResolvedAtWriteOnce — resolvedAt is set only when not already resolved', () => {
  const content = fs.readFileSync(CIRCUIT_BREAKER, 'utf8');

  // The write-once guard: resolvedAt is only set inside a block that filters
  // for activeKeys (entries where resolvedAt is NOT already set)
  assert.match(content, /activeKeys/, 'circuit breaker should filter for activeKeys (unresolved entries)');
  assert.match(content, /\.resolvedAt\s*=/, 'circuit breaker should set resolvedAt');

  // The guard condition: activeKeys filters entries without resolvedAt
  assert.match(content, /!log\[k\]\.resolvedAt/, 'activeKeys filter must exclude already-resolved entries');
});

test('ORES-03: ResolvedAtWriteOnce — TLA+ model defines the invariant', () => {
  const tla = fs.readFileSync(TLA_MODEL, 'utf8');
  assert.match(tla, /ResolvedAtWriteOnce\s*==/, 'TLA+ model must define ResolvedAtWriteOnce');
  assert.match(tla, /logWritten\s*=\s*TRUE\s*=>\s*logWritten'\s*=\s*TRUE/,
    'ResolvedAtWriteOnce must assert logWritten stays TRUE once set');
});

test('ORES-03: requirement-map includes ORES-03 in convergence group', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQUIREMENT_MAP);
  const convergenceGroup = CHECK_ID_TO_REQUIREMENTS['tla:convergence'];
  assert.ok(convergenceGroup, 'tla:convergence group must exist');
  assert.ok(convergenceGroup.includes('ORES-03'), 'ORES-03 must be in tla:convergence group');
});
