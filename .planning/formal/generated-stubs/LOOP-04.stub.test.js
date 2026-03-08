#!/usr/bin/env node
// @requirement LOOP-04
// Test: propose-debug-invariants.cjs mines TLA+ invariant candidates from debug sessions
// Formal property: StartDebugMine (QGSDSpecGeneration.tla) — structural verification

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'bin', 'propose-debug-invariants.cjs');

test('LOOP-04: propose-debug-invariants.cjs exists', () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'bin/propose-debug-invariants.cjs must exist');
});

test('LOOP-04: script exports mineTransitions function pattern', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /function\s+mineTransitions/, 'script must define mineTransitions function for transition mining');
});

test('LOOP-04: script exports mineRootCauses function pattern', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /function\s+mineRootCauses/, 'script must define mineRootCauses function for root cause mining');
});

test('LOOP-04: script exports mineInvariantCandidates function pattern', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /function\s+mineInvariantCandidates/, 'script must define mineInvariantCandidates function');
});

test('LOOP-04: script reads quorum-debug-latest.md artifact', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /quorum-debug-latest\.md/, 'script must read quorum-debug-latest.md debug artifact');
});

test('LOOP-04: script supports --non-interactive mode', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /--non-interactive/, 'script must support --non-interactive flag for CI usage');
});

test('LOOP-04: StartDebugMine action defined in QGSDSpecGeneration.tla', () => {
  const tlaPath = path.join(PROJECT_ROOT, '.planning', 'formal', 'tla', 'QGSDSpecGeneration.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /StartDebugMine\s*==/, 'StartDebugMine action must be defined in QGSDSpecGeneration.tla');
  assert.match(content, /@requirement LOOP-04/, 'StartDebugMine must be tagged with @requirement LOOP-04');
});
