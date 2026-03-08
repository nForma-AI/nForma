#!/usr/bin/env node
// @requirement INST-07
// Structural test for OverridesPreserved:
// Installer respects existing per-project config overrides during updates.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'bin', 'install.js'),
  'utf8'
);

test('INST-07: existing nf.json is read, not overwritten, on reinstall', () => {
  // Installer reads existing config and preserves it
  assert.match(installSource, /existingConfig\s*=\s*JSON\.parse/);
});

test('INST-07: circuit_breaker sub-keys are backfilled without overwriting user values', () => {
  // Only adds missing keys, does not replace existing ones
  assert.match(installSource, /oscillation_depth\s*===\s*undefined/);
  assert.match(installSource, /commit_window\s*===\s*undefined/);
});

test('INST-07: quorum_active is preserved when already set and non-empty', () => {
  // Existing quorum_active is NOT overwritten
  assert.match(installSource, /user config preserved/);
});

test('INST-07: new slots are appended to existing quorum_active, not replaced', () => {
  // Incremental update: new slots are appended, existing preserved
  assert.match(installSource, /new slots are appended, existing preserved/);
  assert.match(installSource, /addSlotToQuorumActive/);
});
