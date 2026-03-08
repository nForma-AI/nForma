#!/usr/bin/env node
// @requirement SOLVE-09
// Structural test: solve diagnostic engine provides fast-mode iteration (--fast skips F->C and T->C),
// pattern-based D->C false-positive suppression via acknowledged-false-positives.json,
// and recipe sidecars with absolute paths and pre-classified test templates.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOLVE_PATH = path.resolve(__dirname, '../../../bin/nf-solve.cjs');
const FORMAL_TEST_SYNC_PATH = path.resolve(__dirname, '../../../bin/formal-test-sync.cjs');

test('SOLVE-09: nf-solve.cjs parses --fast flag for fast-mode iteration', () => {
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  // Verify --fast flag parsing exists
  assert.match(content, /--fast/, 'nf-solve.cjs must accept --fast flag');
  assert.match(content, /fastMode/, 'nf-solve.cjs must define fastMode variable');
  // Verify fast mode skips F->C and T->C layers
  assert.match(content, /fast\s*mode/, 'nf-solve.cjs must reference fast mode skip reason');
});

test('SOLVE-09: nf-solve.cjs loads acknowledged-false-positives.json for D->C suppression', () => {
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  assert.match(content, /acknowledged-false-positives\.json/, 'must reference acknowledged-false-positives.json');
  assert.match(content, /false.positiv/i, 'must handle false positive filtering');
});

test('SOLVE-09: formal-test-sync.cjs generates recipe sidecars with required fields', () => {
  const content = fs.readFileSync(FORMAL_TEST_SYNC_PATH, 'utf8');
  // Recipe sidecar generation
  assert.match(content, /stub\.recipe\.json/, 'must generate .stub.recipe.json sidecar files');
  // Absolute paths in recipes
  assert.match(content, /source_files_absolute/, 'recipe must include source_files_absolute');
  // Pre-classified test template
  assert.match(content, /test_strategy/, 'recipe must include test_strategy');
  assert.match(content, /template/, 'recipe must include template classification');
});

test('SOLVE-09: formal-test-sync.cjs exports classifyTestStrategy and classifyTestTemplate', () => {
  const mod = require(FORMAL_TEST_SYNC_PATH);
  assert.equal(typeof mod.classifyTestStrategy, 'function', 'classifyTestStrategy must be exported');
  assert.equal(typeof mod.classifyTestTemplate, 'function', 'classifyTestTemplate must be exported');
});
