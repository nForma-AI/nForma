#!/usr/bin/env node
// @requirement MCP-01
// Test: Installer reads ~/.claude.json to auto-detect MCP server names for Codex, Gemini, OpenCode
// Formal property: MCPServer (mcp-detection.als) — structural verification

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const INSTALL_PATH = path.join(PROJECT_ROOT, 'bin', 'install.js');

test('MCP-01: install.js exists', () => {
  assert.ok(fs.existsSync(INSTALL_PATH), 'bin/install.js must exist');
});

test('MCP-01: install.js reads ~/.claude.json for MCP detection', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /\.claude\.json/, 'installer must reference .claude.json');
  assert.match(content, /mcpServers/, 'installer must read mcpServers from .claude.json');
});

test('MCP-01: install.js defines buildRequiredModelsFromMcp function', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /function\s+buildRequiredModelsFromMcp/, 'installer must define buildRequiredModelsFromMcp function');
});

test('MCP-01: install.js has NF_KEYWORD_MAP with codex, gemini, opencode entries', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /NF_KEYWORD_MAP/, 'installer must define NF_KEYWORD_MAP');
  assert.match(content, /codex:\s*\{/, 'NF_KEYWORD_MAP must include codex entry');
  assert.match(content, /gemini:\s*\{/, 'NF_KEYWORD_MAP must include gemini entry');
  assert.match(content, /opencode:\s*\{/, 'NF_KEYWORD_MAP must include opencode entry');
});

test('MCP-01: install.js falls back to hardcoded defaults when no servers detected', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /defaultPrefix/, 'installer must define defaultPrefix for fallback');
  assert.match(content, /No.*MCP.*server.*found|hardcoded defaults/i, 'installer must warn about fallback to defaults');
});
