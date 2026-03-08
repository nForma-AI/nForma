#!/usr/bin/env node
// @requirement INST-05
// Structural test for ConfigSyncCompleteCheck:
// Installer performs validation before registering hooks — checks MCPs are configured,
// warns if Codex/Gemini/OpenCode not found.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'bin', 'install.js'),
  'utf8'
);

test('INST-05: warnMissingMcpServers function exists in install.js', () => {
  assert.match(installSource, /function\s+warnMissingMcpServers\s*\(/);
});

test('INST-05: warnMissingMcpServers reads ~/.claude.json mcpServers', () => {
  assert.match(installSource, /mcpServers/);
  assert.match(installSource, /claude\.json/);
});

test('INST-05: warnMissingMcpServers warns per missing MCP model', () => {
  // Must emit yellow warning when a model is not found
  assert.match(installSource, /No\s+\$\{modelKey\}\s+MCP\s+server\s+found/);
});

test('INST-05: warnMissingMcpServers is called during install', () => {
  // The function must be invoked during the install flow (tagged INST-05)
  assert.match(installSource, /warnMissingMcpServers\(\)/);
});

test('INST-05: requirement-map maps alloy:install-scope to INST-05', () => {
  const reqMap = require(path.join(__dirname, '..', '..', '..', 'bin', 'requirement-map.cjs'));
  const ids = reqMap.getRequirementIds('alloy:install-scope');
  assert.ok(ids.includes('INST-05'), 'INST-05 should be in alloy:install-scope mapping');
});
