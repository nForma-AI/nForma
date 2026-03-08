#!/usr/bin/env node
// @requirement CRED-01
// Structural test: CRED-01 — TypeOK
// Verifies batch key rotation flow exists in nForma.cjs and requirement traceability in requirement-map.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CRED-01: requirement-map.cjs maps tla:account-manager to include CRED-01', () => {
  const mod = require(path.join(ROOT, 'bin', 'requirement-map.cjs'));
  const ids = mod.CHECK_ID_TO_REQUIREMENTS['tla:account-manager'];
  assert.ok(Array.isArray(ids), 'tla:account-manager mapping should exist');
  assert.ok(ids.includes('CRED-01'), 'CRED-01 should be in tla:account-manager mapping');
});

test('CRED-01: nForma.cjs contains batchRotateFlow for batch key rotation', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(content, /batchRotateFlow/, 'nForma.cjs should contain batchRotateFlow function');
});

test('CRED-01: nForma.cjs contains Batch Rotate Keys menu entry', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(content, /Batch Rotate Keys/, 'nForma.cjs should have Batch Rotate Keys menu label');
});
