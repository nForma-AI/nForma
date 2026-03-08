#!/usr/bin/env node
// @requirement INST-04
// Structural test: installer adds UserPromptSubmit and Stop hook entries
// to ~/.claude/settings.json hooks section.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_SOURCE = path.resolve(__dirname, '../../../bin/install.js');

test('INST-04 — RollbackSoundCheck: installer adds UserPromptSubmit hook entries', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify installer creates UserPromptSubmit hook array if missing
  assert.match(content, /hooks\.UserPromptSubmit/,
    'Installer must reference hooks.UserPromptSubmit');

  // Verify it pushes a new entry
  assert.match(content, /UserPromptSubmit\.push\s*\(/,
    'Installer must push entries to UserPromptSubmit array');
});

test('INST-04 — RollbackSoundCheck: installer adds Stop hook entries', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify installer creates Stop hook array if missing
  assert.match(content, /hooks\.Stop/,
    'Installer must reference hooks.Stop');

  // Verify it pushes a new entry
  assert.match(content, /Stop\.push\s*\(/,
    'Installer must push entries to Stop array');
});

test('INST-04 — RollbackSoundCheck: uninstall cleans up both hook types', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify uninstall filters out UserPromptSubmit entries
  assert.match(content, /UserPromptSubmit\s*=\s*.*\.filter/,
    'Uninstall must filter UserPromptSubmit entries');

  // Verify uninstall filters out Stop entries
  assert.match(content, /Stop\s*=\s*.*\.filter/,
    'Uninstall must filter Stop entries');
});

test('INST-04 — RollbackSoundCheck: requirement-map maps alloy:install-scope to INST-04', () => {
  const reqMapSource = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
  const content = fs.readFileSync(reqMapSource, 'utf8');

  assert.match(content, /alloy:install-scope.*INST-04/s,
    'requirement-map must include INST-04 under alloy:install-scope');
});
