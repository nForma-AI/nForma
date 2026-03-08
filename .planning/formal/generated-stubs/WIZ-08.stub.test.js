#!/usr/bin/env node
// @requirement WIZ-08
// Structural test: /nf:mcp-setup re-run menu includes "Edit Quorum Composition" option
// Formal property: EditComposition (QGSDSetupWizard.tla)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SETUP_MD = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');

test('WIZ-08 — mcp-setup.md re-run menu includes "Edit Quorum Composition" option', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  assert.match(content, /Edit Quorum Composition/,
    'mcp-setup.md must include "Edit Quorum Composition" as a menu option');
});

test('WIZ-08 — mcp-setup.md routes Edit Quorum Composition to composition screen', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  // Verify the option routes to a composition screen/section
  assert.match(content, /[Cc]omposition\s+[Ss]creen/,
    'mcp-setup.md should route to a Composition Screen section');
});
