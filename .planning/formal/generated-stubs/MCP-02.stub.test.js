#!/usr/bin/env node
// @requirement MCP-02
// Test: Detection matches server names containing "codex", "gemini", "opencode" (case-insensitive keyword match)
// Formal property: MCPServer (mcp-detection.als) — constant verification

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const INSTALL_PATH = path.join(PROJECT_ROOT, 'bin', 'install.js');

test('MCP-02: install.js uses case-insensitive keyword matching via .toLowerCase()', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /\.toLowerCase\(\)\.includes\(/, 'detection must use .toLowerCase().includes() for case-insensitive matching');
});

test('MCP-02: NF_KEYWORD_MAP keywords contain "codex", "gemini", "opencode"', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  // Extract the NF_KEYWORD_MAP block
  const mapMatch = content.match(/NF_KEYWORD_MAP\s*=\s*\{[\s\S]*?\};/);
  assert.ok(mapMatch, 'NF_KEYWORD_MAP must be defined');
  const mapBlock = mapMatch[0];
  assert.match(mapBlock, /['"]codex['"]/, 'keyword map must include "codex" keyword');
  assert.match(mapBlock, /['"]gemini['"]/, 'keyword map must include "gemini" keyword');
  assert.match(mapBlock, /['"]opencode['"]/, 'keyword map must include "opencode" keyword');
});

test('MCP-02: Alloy model specifies KeywordDetection fact for server name mapping', () => {
  const alloyPath = path.join(PROJECT_ROOT, '.planning', 'formal', 'alloy', 'mcp-detection.als');
  const content = fs.readFileSync(alloyPath, 'utf8');
  assert.match(content, /fact\s+KeywordDetection/, 'mcp-detection.als must define KeywordDetection fact');
  assert.match(content, /@requirement MCP-02/, 'KeywordDetection must be tagged with @requirement MCP-02');
});

test('MCP-02: detection iterates over mcpServers keys from ~/.claude.json', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /Object\.keys\(mcpServers\)/, 'detection must iterate Object.keys(mcpServers)');
});
