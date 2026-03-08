#!/usr/bin/env node
// @requirement UPS-05
// Test: UserPromptSubmit hook never fires on execute-phase or other non-planning commands
// Strategy: structural — verify nf-prompt.js has command pattern guard that exits silently

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NF_PROMPT = path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'nf-prompt.js');

test('UPS-05: nf-prompt.js has anchored allowlist pattern that gates quorum injection', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // Must have an allowlist pattern check using quorum_commands
  assert.match(content, /cmdPattern/, 'must define a command pattern variable');
  assert.match(content, /commands\.join/, 'pattern must be built from quorum_commands array');
  // Must exit silently when pattern does not match
  assert.match(content, /process\.exit\(0\).*Silent pass/, 'must exit(0) silently for non-planning commands');
});

test('UPS-05: execute-phase is NOT in the default quorum_commands allowlist', () => {
  const { DEFAULT_CONFIG } = require(path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'config-loader.js'));
  assert.ok(!DEFAULT_CONFIG.quorum_commands.includes('execute-phase'),
    'execute-phase must not be in quorum_commands');
});

test('UPS-05: common non-planning commands are not in quorum_commands', () => {
  const { DEFAULT_CONFIG } = require(path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'config-loader.js'));
  const nonPlanningCommands = ['execute-phase', 'compact', 'clear', 'help', 'status'];
  for (const cmd of nonPlanningCommands) {
    assert.ok(!DEFAULT_CONFIG.quorum_commands.includes(cmd),
      `"${cmd}" must not be in quorum_commands`);
  }
});
