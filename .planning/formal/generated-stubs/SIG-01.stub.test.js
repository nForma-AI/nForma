#!/usr/bin/env node
// @requirement SIG-01
// Structural test for: detect-coverage-gaps.cjs
// Formal model: .planning/formal/alloy/signal-analysis-tools.als
// Requirement: detect-coverage-gaps.cjs diffs TLC states vs conformance traces to produce coverage-gaps.md

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SIG-01 — structural: detect-coverage-gaps.cjs exports detectCoverageGaps function', () => {
  const mod = require(path.join(ROOT, 'bin', 'detect-coverage-gaps.cjs'));
  assert.equal(typeof mod.detectCoverageGaps, 'function', 'detectCoverageGaps must be a function');
});

test('SIG-01 — structural: detect-coverage-gaps.cjs exports parseTlcStates function', () => {
  const mod = require(path.join(ROOT, 'bin', 'detect-coverage-gaps.cjs'));
  assert.equal(typeof mod.parseTlcStates, 'function', 'parseTlcStates must be a function');
});

test('SIG-01 — structural: detect-coverage-gaps.cjs exports parseTraceStates function', () => {
  const mod = require(path.join(ROOT, 'bin', 'detect-coverage-gaps.cjs'));
  assert.equal(typeof mod.parseTraceStates, 'function', 'parseTraceStates must be a function');
});

test('SIG-01 — structural: parseTlcStates returns state set for known spec', () => {
  const mod = require(path.join(ROOT, 'bin', 'detect-coverage-gaps.cjs'));
  const result = mod.parseTlcStates('NFQuorum');
  assert.ok(result !== null, 'parseTlcStates must return a result for NFQuorum');
  assert.equal(result.specName, 'NFQuorum');
  assert.ok(result.states instanceof Set, 'states must be a Set');
  assert.ok(result.states.size > 0, 'states must contain at least one state');
});

test('SIG-01 — structural: parseTlcStates returns null for unknown spec', () => {
  const mod = require(path.join(ROOT, 'bin', 'detect-coverage-gaps.cjs'));
  const result = mod.parseTlcStates('NonExistentSpec');
  assert.equal(result, null, 'parseTlcStates must return null for unknown spec');
});

test('SIG-01 — structural: detectCoverageGaps returns status object', () => {
  const mod = require(path.join(ROOT, 'bin', 'detect-coverage-gaps.cjs'));
  // Call with a non-existent log path to get no-traces status
  const result = mod.detectCoverageGaps({ logPath: '/non/existent/path.jsonl' });
  assert.ok(result.status, 'detectCoverageGaps must return an object with status');
  assert.equal(result.status, 'no-traces', 'non-existent log should yield no-traces status');
});
