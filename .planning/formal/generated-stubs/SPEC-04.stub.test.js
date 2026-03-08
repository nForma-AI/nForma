#!/usr/bin/env node
// @requirement SPEC-04
// Structural test: verify QGSDSpecGeneration.tla defines StartPhaseSpec and
// generate-phase-spec.cjs translates PLAN.md truths to TLA+ PROPERTY stubs.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

test('SPEC-04: QGSDSpecGeneration.tla exists and defines StartPhaseSpec', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDSpecGeneration.tla');
  assert.ok(fs.existsSync(tlaPath), 'QGSDSpecGeneration.tla must exist');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /StartPhaseSpec\s*==/, 'must define StartPhaseSpec action');
});

test('SPEC-04: TLA+ model encodes stubs-bounded-by-truths invariant', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDSpecGeneration.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /StubsBoundedByTruths/, 'must define StubsBoundedByTruths invariant');
  assert.match(content, /stubsGenerated\s*=<\s*truthsRead/, 'stubs must be bounded by truths read');
});

test('SPEC-04: TLA+ model encodes all-truths-covered-when-done invariant', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDSpecGeneration.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /AllTruthsCoveredWhenDone/, 'must define AllTruthsCoveredWhenDone invariant');
  assert.match(content, /phaseSpecState\s*=\s*"done"\s*=>\s*stubsGenerated\s*=\s*truthsRead/, 'done state implies all truths have stubs');
});

test('SPEC-04: generate-phase-spec.cjs exists and parses must_haves truths', () => {
  const srcPath = path.join(ROOT, 'bin', 'generate-phase-spec.cjs');
  assert.ok(fs.existsSync(srcPath), 'generate-phase-spec.cjs must exist');
  const content = fs.readFileSync(srcPath, 'utf8');
  assert.match(content, /must_haves/, 'must parse must_haves from PLAN.md');
  assert.match(content, /truths/, 'must parse truths array');
  assert.match(content, /SPEC-04/, 'must reference SPEC-04 requirement');
});
