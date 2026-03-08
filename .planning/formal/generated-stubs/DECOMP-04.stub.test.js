#!/usr/bin/env node
// @requirement DECOMP-04
// Structural test: generate-traceability-matrix.cjs includes state_space section per model

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/generate-traceability-matrix.cjs');

test('DECOMP-04: generate-traceability-matrix.cjs contains state_space section logic', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must call loadStateSpaceAnalysis to get state-space data
  assert.match(content, /loadStateSpaceAnalysis/, 'should call loadStateSpaceAnalysis');

  // Must build a state_space section keyed by model file
  assert.match(content, /stateSpaceSection/, 'should build stateSpaceSection object');

  // Must include risk_level per model in the state_space output
  assert.match(content, /risk_level/, 'should include risk_level per model');

  // Must attach state_space to the final matrix output
  assert.match(content, /state_space:\s*stateSpaceSection/, 'should attach state_space to matrix output');
});

test('DECOMP-04: state_space section includes per-model fields', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Per-model state_space entry should include these fields
  assert.match(content, /estimated_states/, 'should include estimated_states');
  assert.match(content, /has_unbounded/, 'should include has_unbounded');
  assert.match(content, /unbounded_domains/, 'should include unbounded_domains');
  assert.match(content, /variable_count/, 'should include variable_count');
  assert.match(content, /constant_count/, 'should include constant_count');
});
