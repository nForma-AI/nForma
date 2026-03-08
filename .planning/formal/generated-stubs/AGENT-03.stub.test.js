#!/usr/bin/env node
// @requirement AGENT-03
// Structural test: mcp-setup.md documents identity ping step after agent provisioning

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../commands/nf/mcp-setup.md');

test('AGENT-03 — VerifyAgent: mcp-setup documents identity ping after provisioning', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /identity ping/i, 'mcp-setup must document identity ping step');
  assert.match(content, /AGENT-03/, 'identity ping step must reference AGENT-03 requirement');
});
