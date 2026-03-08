#!/usr/bin/env node
// @requirement SOLVE-12
// Structural test: nf:solve autoClose phase upgrades generated TODO test stubs
// to implementation-aware tests using recipe metadata before convergence.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AUTO_CLOSE_PATH = path.resolve(__dirname, '../../../bin/autoClosePtoF.cjs');
const FORMAL_TEST_SYNC_PATH = path.resolve(__dirname, '../../../bin/formal-test-sync.cjs');
const SOLVE_PATH = path.resolve(__dirname, '../../../bin/nf-solve.cjs');

test('SOLVE-12: autoClosePtoF module exports autoClosePtoF function', () => {
  const mod = require(AUTO_CLOSE_PATH);
  assert.equal(typeof mod.autoClosePtoF, 'function', 'autoClosePtoF must be exported');
});

test('SOLVE-12: autoClosePtoF returns empty actions for zero-residual input', () => {
  const { autoClosePtoF } = require(AUTO_CLOSE_PATH);
  const result = autoClosePtoF({ residual: 0 });
  assert.deepStrictEqual(result, { actions_taken: [], entries_processed: 0 },
    'zero residual must produce no actions');
});

test('SOLVE-12: autoClosePtoF returns empty actions for null input', () => {
  const { autoClosePtoF } = require(AUTO_CLOSE_PATH);
  const result = autoClosePtoF(null);
  assert.deepStrictEqual(result, { actions_taken: [], entries_processed: 0 },
    'null input must produce no actions');
});

test('SOLVE-12: formal-test-sync generates recipe sidecars that enable stub upgrade', () => {
  const content = fs.readFileSync(FORMAL_TEST_SYNC_PATH, 'utf8');
  // Recipe sidecars are generated alongside stubs for upgrade context
  assert.match(content, /stub\.recipe\.json/, 'must generate recipe sidecar files');
  assert.match(content, /requirement_text/, 'recipe must include requirement_text for stub upgrade');
  assert.match(content, /import_hint/, 'recipe must include import_hint for stub upgrade');
  assert.match(content, /test_strategy/, 'recipe must include test_strategy for stub upgrade');
  assert.match(content, /template_boilerplate/, 'recipe must include template_boilerplate for stub upgrade');
});

test('SOLVE-12: nf-solve.cjs source references autoClose in convergence pipeline', () => {
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  assert.match(content, /autoClose/i, 'nf-solve.cjs must reference autoClose in convergence pipeline');
});
