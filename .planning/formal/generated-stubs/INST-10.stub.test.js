#!/usr/bin/env node
// @requirement INST-10
// Formal property: OverridesPreserved (invariant)
// Reinstall (idempotent) adds missing circuit_breaker config block without overwriting user-modified values

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_JS = path.join(__dirname, '..', '..', '..', 'bin', 'install.js');

test('INST-10: install.js preserves user-modified circuit_breaker values on reinstall', () => {
  // Read install.js source and verify the idempotent merge logic exists
  const src = fs.readFileSync(INSTALL_JS, 'utf8');

  // The installer must check for existing circuit_breaker before overwriting
  assert.match(src, /if\s*\(\s*!existingConfig\.circuit_breaker\s*\)/,
    'install.js must check if circuit_breaker block is missing before adding');

  // When circuit_breaker exists, it must only backfill undefined sub-keys
  assert.match(src, /existingConfig\.circuit_breaker\.oscillation_depth\s*===\s*undefined/,
    'install.js must check oscillation_depth === undefined before setting');
  assert.match(src, /existingConfig\.circuit_breaker\.commit_window\s*===\s*undefined/,
    'install.js must check commit_window === undefined before setting');

  // Default values must be the formal constants: oscillation_depth=3, commit_window=6
  assert.match(src, /oscillation_depth:\s*3/,
    'Default oscillation_depth must be 3');
  assert.match(src, /commit_window:\s*6/,
    'Default commit_window must be 6');
});
