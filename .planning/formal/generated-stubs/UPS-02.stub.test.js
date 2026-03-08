#!/usr/bin/env node
// @requirement UPS-02
// Test: Allowlist contains the expected planning commands in DEFAULT_CONFIG.quorum_commands
// Strategy: structural — verify source contains quorum_commands allowlist

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_LOADER = path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'config-loader.js');

test('UPS-02: DEFAULT_CONFIG.quorum_commands contains the planning command allowlist', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  // Verify quorum_commands array exists in source
  assert.match(content, /quorum_commands:\s*\[/, 'quorum_commands array must be defined in DEFAULT_CONFIG');

  // Verify the 6 required commands are present (requirement says 6; code also has "quick")
  const requiredCommands = [
    'new-project', 'plan-phase', 'new-milestone',
    'discuss-phase', 'verify-work', 'research-phase',
  ];
  for (const cmd of requiredCommands) {
    assert.match(content, new RegExp(`['"]${cmd}['"]`), `quorum_commands must include "${cmd}"`);
  }
});

test('UPS-02: loadConfig exports quorum_commands as an array', () => {
  const { DEFAULT_CONFIG } = require(CONFIG_LOADER);
  assert.ok(Array.isArray(DEFAULT_CONFIG.quorum_commands), 'quorum_commands must be an array');
  const requiredCommands = [
    'new-project', 'plan-phase', 'new-milestone',
    'discuss-phase', 'verify-work', 'research-phase',
  ];
  for (const cmd of requiredCommands) {
    assert.ok(DEFAULT_CONFIG.quorum_commands.includes(cmd), `quorum_commands must include "${cmd}"`);
  }
});
