#!/usr/bin/env node
// @requirement WIZ-09
// Structural test: Composition screen shows all discovered slots with on/off toggle for quorum_active inclusion
// Formal property: EditComposition (QGSDSetupWizard.tla)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SETUP_MD = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');

test('WIZ-09 — composition screen shows all slots from ~/.claude.json', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  assert.match(content, /slots.*claude\.json|claude\.json.*slots/i,
    'Composition screen should show slots from ~/.claude.json');
});

test('WIZ-09 — composition screen displays on/off toggle status', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  // Should show ON/OFF indicators for each slot
  assert.match(content, /ON/,
    'Composition screen should show ON status');
  assert.match(content, /OFF/,
    'Composition screen should show OFF status');
});

test('WIZ-09 — composition screen uses quorum_active for inclusion toggle', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  assert.match(content, /quorum_active/,
    'Composition screen should reference quorum_active for slot toggling');
});

test('WIZ-09 — composition screen supports fail-open when quorum_active is empty', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  assert.match(content, /fail.open/i,
    'Composition screen should document fail-open behavior when quorum_active is empty');
});
