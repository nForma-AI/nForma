#!/usr/bin/env node
// @requirement GATE-01
// Structural test: gate-a-grounding.cjs accepts --base-ref <sha> flag that scopes
// grounding analysis to changed files, enforcing 80% target on scoped subset.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', '..', '..', 'bin', 'gate-a-grounding.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('GATE-01: --base-ref flag is parsed from argv', () => {
  assert.match(content, /--base-ref/,
    'must accept --base-ref flag');
  assert.match(content, /process\.argv\.indexOf\(['"]--base-ref['"]\)/,
    'must parse --base-ref from process.argv');
});

test('GATE-01: getChangedActions function computes scoped action set from git diff', () => {
  assert.match(content, /function\s+getChangedActions\b/,
    'getChangedActions function must exist');
  assert.match(content, /git diff --name-only/,
    'must use git diff --name-only to find changed files');
  assert.match(content, /scopedActions/,
    'must compute a scopedActions set from changed files');
});

test('GATE-01: diff-scoped mode filters conformance events to scoped actions', () => {
  assert.match(content, /scopedActions\.has/,
    'must filter events using scopedActions.has()');
  assert.match(content, /scoped.*mode|mode.*diff/i,
    'must label the analysis mode as scoped/diff');
});

test('GATE-01: falls back to global mode when base-ref yields no changes', () => {
  assert.match(content, /falling back to global mode/i,
    'must fall back to global mode when git diff yields no changes');
});
