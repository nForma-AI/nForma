#!/usr/bin/env node
// @requirement MCP-04
// Constant test: installer falls back to hardcoded defaults when no matching servers found

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installPath = path.resolve(__dirname, '../../../bin/install.js');

test('MCP-04: install.js contains hardcoded default prefixes for codex, gemini, opencode', () => {
  const content = fs.readFileSync(installPath, 'utf8');

  // NF_KEYWORD_MAP must define defaultPrefix for each quorum model
  assert.match(content, /codex:\s*\{[^}]*defaultPrefix:\s*'mcp__codex-cli-1__'/,
    'NF_KEYWORD_MAP must have codex defaultPrefix mcp__codex-cli-1__');

  assert.match(content, /gemini:\s*\{[^}]*defaultPrefix:\s*'mcp__gemini-cli-1__'/,
    'NF_KEYWORD_MAP must have gemini defaultPrefix mcp__gemini-cli-1__');

  assert.match(content, /opencode:\s*\{[^}]*defaultPrefix:\s*'mcp__opencode-1__'/,
    'NF_KEYWORD_MAP must have opencode defaultPrefix mcp__opencode-1__');

  // When no match is found, the code uses defaultPrefix as fallback
  assert.match(content, /requiredModels\[modelKey\]\s*=\s*\{\s*tool_prefix:\s*defaultPrefix/,
    'Fallback path must use defaultPrefix when no MCP server matched');
});
