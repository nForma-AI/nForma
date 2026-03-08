#!/usr/bin/env node
// @requirement VIS-01
// Structural test: /nf:health surfaces W008 warning when a quorum slot has
// >=3 failures in quorum-failures.json.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('VIS-01: health check reads quorum-failures.json for failure counts', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core', 'bin', 'gsd-tools.cjs'), 'utf8');
  assert.match(src, /quorum-failures/, 'should read quorum-failures.json');
});

test('VIS-01: health check emits W008 warning code', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core', 'bin', 'gsd-tools.cjs'), 'utf8');
  assert.match(src, /W008/, 'should emit W008 warning code');
});

test('VIS-01: health workflow documents W008 for slots with 3+ failures', () => {
  const src = fs.readFileSync(path.join(ROOT, 'core', 'workflows', 'health.md'), 'utf8');
  assert.match(src, /W008/, 'health workflow must document W008 warning');
  assert.match(src, /3\+/, 'health workflow must reference 3+ recurring failures threshold');
});
