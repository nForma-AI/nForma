#!/usr/bin/env node
// @requirement NAV-04
// Structural test: Sessions module persists active sessions to sessions.json,
// restores session ID counters from persisted data, validates CWD existence.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');

test('NAV-04 — nForma.cjs references sessions.json for persistence', () => {
  assert.match(SRC, /sessions\.json/, 'must reference sessions.json file path');
});

test('NAV-04 — nForma.cjs restores sessionIdCounter from persisted data', () => {
  assert.match(SRC, /sessionIdCounter/, 'must track sessionIdCounter');
  // Verify counter restoration logic exists (Math.max over persisted IDs)
  assert.match(SRC, /Math\.max/, 'must use Math.max to restore ID counter from persisted sessions');
});

test('NAV-04 — nForma.cjs validates CWD existence with process.cwd fallback', () => {
  assert.match(SRC, /process\.cwd\(\)/, 'must reference process.cwd() as fallback');
});
