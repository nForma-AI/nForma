#!/usr/bin/env node
// @requirement AGENT-01
// Structural test: manage-agents-core.cjs exports writeClaudeJson for adding agents to mcpServers

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');

test('AGENT-01 — AddAgent: manage-agents-core exports writeClaudeJson for provisioning', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /writeClaudeJson/, 'module must provide writeClaudeJson for adding agents');
  assert.match(content, /mcpServers/, 'module must interact with mcpServers config');
  assert.match(content, /module\.exports/, 'module must export its functions');
});
