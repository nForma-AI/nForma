#!/usr/bin/env node
// @requirement WIZ-01
// Structural test: User can run /nf:mcp-setup to start the MCP configuration wizard.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('WIZ-01: nForma.cjs references /nf:mcp-setup command', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(src, /nf:mcp-setup/, 'nForma must reference /nf:mcp-setup command');
});

test('WIZ-01: install.js nudges new users to run /nf:mcp-setup when no agents configured', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'install.js'), 'utf8');
  assert.match(src, /nf:mcp-setup/, 'install.js must reference /nf:mcp-setup');
  assert.match(src, /hasClaudeMcpAgents/, 'install.js must check for configured agents');
});

test('WIZ-01: manage-agents-core.cjs provides wizard implementation helpers', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'manage-agents-core.cjs'), 'utf8');
  assert.match(src, /manage-agents/, 'manage-agents-core must be the agent management module');
  assert.ok(src.length > 100, 'manage-agents-core must contain implementation code');
});
