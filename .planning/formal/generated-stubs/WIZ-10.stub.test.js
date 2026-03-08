#!/usr/bin/env node
// @requirement WIZ-10
// Structural test: mcp-setup.md contains add-slot flow that writes to ~/.claude.json
// Formal property: AddSlot (TLA+ QGSDSetupWizard.tla)
// AddSlot == screen \in {"menu","composition","firstRun"} /\ agentCount < MaxSlots
//   => screen' = "confirm" /\ agentCount' = agentCount + 1

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');

test('WIZ-10: mcp-setup.md exists and is readable', () => {
  assert.ok(fs.existsSync(SOURCE), 'commands/nf/mcp-setup.md must exist');
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.ok(content.length > 0, 'mcp-setup.md must not be empty');
});

test('WIZ-10: mcp-setup.md supports adding a new slot for any family', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Must reference slot addition / add agent capability
  assert.match(content, /add/i, 'must reference adding agents/slots');
  // Must reference ~/.claude.json as the target config
  assert.match(content, /\.claude\.json/, 'must reference ~/.claude.json for slot persistence');
});

test('WIZ-10: mcp-setup.md covers all agent families', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  const families = ['claude', 'copilot', 'opencode', 'codex', 'gemini'];
  for (const family of families) {
    assert.match(content, new RegExp(family, 'i'),
      `must reference ${family} agent family`);
  }
});

test('WIZ-10: mcp-setup.md triggers restart after adding slot', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /restart/i, 'must reference restart after slot addition');
});
