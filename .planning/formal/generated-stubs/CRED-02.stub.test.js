#!/usr/bin/env node
// @requirement CRED-02
// Structural test: CRED-02 — ActiveIsPoolMember
// Verifies key validity persistence is traced in requirement-map and implemented in nForma.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CRED-02: requirement-map.cjs maps tla:account-manager to include CRED-02', () => {
  const mod = require(path.join(ROOT, 'bin', 'requirement-map.cjs'));
  const ids = mod.CHECK_ID_TO_REQUIREMENTS['tla:account-manager'];
  assert.ok(Array.isArray(ids), 'tla:account-manager mapping should exist');
  assert.ok(ids.includes('CRED-02'), 'CRED-02 should be in tla:account-manager mapping');
});

test('CRED-02: nForma.cjs contains validateRotatedKeys for post-rotation persistence', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(content, /validateRotatedKeys/, 'nForma.cjs should contain validateRotatedKeys function');
});

test('CRED-02: nForma.cjs references key_status persistence', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(content, /key_status/, 'nForma.cjs should reference key_status for persistence');
});
