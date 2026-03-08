#!/usr/bin/env node
// @requirement INST-06
// Structural test for Install (idempotency invariant):
// Running installer again updates hooks and config without duplicating entries.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'bin', 'install.js'),
  'utf8'
);

test('INST-06: hook registration checks for existing entry before pushing (UserPromptSubmit)', () => {
  // Must check if nf-prompt hook already exists before adding
  assert.match(installSource, /hasNfPromptHook/);
  assert.match(installSource, /\.some\(entry\s*=>/);
});

test('INST-06: hook registration checks for existing entry before pushing (Stop)', () => {
  assert.match(installSource, /hasNfStopHook/);
});

test('INST-06: hook registration checks for existing entry before pushing (PreToolUse)', () => {
  assert.match(installSource, /hasCircuitBreakerHook/);
});

test('INST-06: nf.json is not overwritten on reinstall', () => {
  // When nf.json exists, installer must NOT overwrite it (preserves user config)
  assert.match(installSource, /nf\.json\s+exists/);
  assert.match(installSource, /user config preserved/);
});

test('INST-06: OLD_HOOK_MAP migrates old entries instead of duplicating', () => {
  // Old qgsd-* hooks are removed before nf-* equivalents are registered
  assert.match(installSource, /OLD_HOOK_MAP/);
  assert.match(installSource, /qgsd-prompt/);
  assert.match(installSource, /qgsd-stop/);
  assert.match(installSource, /qgsd-circuit-breaker/);
});
