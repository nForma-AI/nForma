#!/usr/bin/env node
// @requirement VERIFY-05
// Structural test: Planner includes System Integration Awareness section
// requiring wiring tasks, and verifier includes Orphaned Producer Check (Step 5.5).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('VERIFY-05: planner agent includes System Integration Awareness section', () => {
  const src = fs.readFileSync(path.join(ROOT, 'agents', 'nf-planner.md'), 'utf8');
  assert.match(src, /System Integration Awareness/, 'planner must include System Integration Awareness section');
});

test('VERIFY-05: planner references wiring tasks for new artifacts', () => {
  const src = fs.readFileSync(path.join(ROOT, 'agents', 'nf-planner.md'), 'utf8');
  assert.match(src, /wiring/i, 'planner must reference wiring tasks');
});

test('VERIFY-05: verifier agent includes Orphaned Producer Check at Step 5.5', () => {
  const src = fs.readFileSync(path.join(ROOT, 'agents', 'nf-verifier.md'), 'utf8');
  assert.match(src, /Step 5\.5/, 'verifier must include Step 5.5');
  assert.match(src, /Orphaned Producer/i, 'verifier must include Orphaned Producer Check');
});
