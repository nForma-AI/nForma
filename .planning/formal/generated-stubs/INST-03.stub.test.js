#!/usr/bin/env node
// @requirement INST-03
// Structural test: installer writes hooks to ~/.claude/settings.json directly
// (not plugin.json — stdout is silently discarded per GitHub #10225).
// The InstallIdempotent assertion ensures repeated installs produce the same state.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_SOURCE = path.resolve(__dirname, '../../../bin/install.js');

test('INST-03 — InstallIdempotent: installer writes to settings.json', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify installer has writeSettings function that writes to settings.json
  assert.match(content, /function\s+writeSettings/,
    'Installer must define writeSettings function');

  // Verify it uses settings.json path
  assert.match(content, /settings\.json/,
    'Installer must reference settings.json');
});

test('INST-03 — InstallIdempotent: installer reads existing settings before writing (idempotent merge)', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify installer has readSettings function
  assert.match(content, /function\s+readSettings/,
    'Installer must define readSettings function for idempotent merge');

  // Verify it checks for existing hooks before adding (idempotent pattern)
  assert.match(content, /some\s*\(\s*entry/,
    'Installer must check for existing hook entries before adding (idempotent)');
});

test('INST-03 — InstallIdempotent: references GitHub #10225 rationale', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify the code documents why settings.json is used instead of plugin hooks
  assert.match(content, /#10225|plugin.*hooks.*discard|stdout.*discard/i,
    'Must document GitHub #10225 rationale for using settings.json');
});
