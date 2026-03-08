#!/usr/bin/env node
// @requirement WIZ-05
// Structural test: User confirms before changes are applied; wizard restarts affected agents after apply
// Formal property: ConfirmChanges (QGSDSetupWizard.tla)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SETUP_MD = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');

test('WIZ-05 — mcp-setup.md requires user confirmation before applying changes', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  assert.match(content, /[Cc]onfirm/,
    'mcp-setup.md should contain a confirmation step');
  assert.match(content, /[Bb]efore.*appl|[Cc]onfirm.*appl|appl.*[Cc]onfirm/i,
    'mcp-setup.md should confirm before applying');
});

test('WIZ-05 — mcp-setup.md includes agent restart after apply', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  // The wizard should restart or reload affected agents after changes
  assert.match(content, /restart|reload|mcp.*restart/i,
    'mcp-setup.md should restart affected agents after applying changes');
});

test('WIZ-05 — mcp-setup.md writes backup before destructive changes', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  assert.match(content, /backup|\.bak|pre-import/i,
    'mcp-setup.md should create a backup before applying changes');
});
