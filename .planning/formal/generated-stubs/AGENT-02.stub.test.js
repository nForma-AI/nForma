#!/usr/bin/env node
// @requirement AGENT-02
// Structural test: mcp-setup.md documents the remove-agent flow (Option 3) with mcpServers deletion

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');

test('AGENT-02 — RemoveAgent: mcp-setup command documents agent removal flow', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /Remove agent/, 'mcp-setup must document "Remove agent" option');
  assert.match(content, /delete.*mcpServers/is, 'removal flow must delete from mcpServers');
});
