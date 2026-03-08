#!/usr/bin/env node
// @requirement INST-01
// Structural test: installer detects no configured quorum agents and
// prompts user to run /nf:mcp-setup.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_SOURCE = path.resolve(__dirname, '../../../bin/install.js');

test('INST-01 — NoConflict: installer references /nf:mcp-setup nudge for missing quorum agents', () => {
  const content = fs.readFileSync(INSTALL_SOURCE, 'utf8');

  // Verify the installer contains the mcp-setup nudge
  assert.match(content, /nf:mcp-setup/,
    'Installer must reference /nf:mcp-setup command');

  // Verify it detects missing quorum agents
  assert.match(content, /No quorum agents configured/i,
    'Installer must detect when no quorum agents are configured');
});

test('INST-01 — NoConflict: requirement-map maps alloy:install-scope to INST-01', () => {
  const reqMapSource = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
  const content = fs.readFileSync(reqMapSource, 'utf8');

  // Verify INST-01 is mapped under alloy:install-scope
  assert.match(content, /alloy:install-scope.*INST-01/s,
    'requirement-map must include INST-01 under alloy:install-scope');
});
