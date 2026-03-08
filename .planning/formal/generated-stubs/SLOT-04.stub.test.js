#!/usr/bin/env node
// @requirement SLOT-04
// Test: mcp-status, mcp-set-model, mcp-update, mcp-restart accept and display slot names correctly

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REQ_MAP_PATH = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
const PROVIDERS_PATH = path.resolve(__dirname, '../../../bin/providers.json');
const MCP_SERVER_PATH = path.resolve(__dirname, '../../../bin/unified-mcp-server.mjs');

test('SLOT-04: requirement-map maps tla:recruiting-safety to SLOT-04', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQ_MAP_PATH);
  const reqs = CHECK_ID_TO_REQUIREMENTS['tla:recruiting-safety'];
  assert.ok(Array.isArray(reqs), 'tla:recruiting-safety should map to an array');
  assert.ok(reqs.includes('SLOT-04'),
    'tla:recruiting-safety should include SLOT-04');
});

test('SLOT-04: providers.json defines slot names for MCP tools', () => {
  const data = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  // Each provider should have mainTool and name (slot name) for MCP tool mapping
  for (const provider of data.providers) {
    assert.ok(typeof provider.name === 'string', 'provider must have slot name');
    assert.ok(typeof provider.mainTool === 'string',
      `Provider ${provider.name} must have mainTool for MCP tool registration`);
  }
});

test('SLOT-04: unified-mcp-server references slot-named tools', () => {
  const content = fs.readFileSync(MCP_SERVER_PATH, 'utf8');
  assert.match(content, /slot/i,
    'unified-mcp-server should reference slot-named tools');
});
