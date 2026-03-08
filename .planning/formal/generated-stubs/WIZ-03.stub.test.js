#!/usr/bin/env node
// @requirement WIZ-03
// Structural test: Re-run shows the current agent roster as a navigable menu
// Formal property: EnterMenu (QGSDSetupWizard.tla)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SETUP_MD = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');
const CORE_MODULE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');

test('WIZ-03 — mcp-setup.md contains re-run menu flow for existing agents', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  // The workflow must distinguish re-run (existing entries) and show an agent menu
  assert.match(content, /[Rr]e-run/, 'mcp-setup.md should reference re-run flow');
  assert.match(content, /menu/i, 'mcp-setup.md should reference a menu');
  assert.match(content, /roster|agent/i, 'mcp-setup.md should reference agent roster');
});

test('WIZ-03 — manage-agents-core exports buildAgentChoiceLabel for menu rendering', () => {
  const content = fs.readFileSync(CORE_MODULE, 'utf8');
  assert.match(content, /buildAgentChoiceLabel/, 'manage-agents-core.cjs should export buildAgentChoiceLabel');
});

test('WIZ-03 — mcp-setup.md routes to menu when agents already configured', () => {
  const content = fs.readFileSync(SETUP_MD, 'utf8');
  // Must detect first-run vs re-run based on configured count
  assert.match(content, /isFirstRun.*false|configuredCount|existing\s+entries/i,
    'mcp-setup.md should route to menu when agents are already configured');
});
