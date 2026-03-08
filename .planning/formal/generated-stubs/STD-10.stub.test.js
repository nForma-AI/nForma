#!/usr/bin/env node
// @requirement STD-10
// Verify: gemini-mcp-server npm package name is unscoped (not @tuannvm/gemini-mcp-server)
// Strategy: structural — grep install.js and unified-mcp-server.mjs for the unscoped name

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const installPath = path.join(ROOT, 'bin', 'install.js');

test('STD-10: install.js uses unscoped gemini-mcp-server package name', () => {
  const content = fs.readFileSync(installPath, 'utf8');

  // Should reference gemini somewhere in MCP configuration
  // The key requirement: no @tuannvm/ scoped prefix
  assert.ok(!content.includes('@tuannvm/gemini-mcp-server'),
    'install.js must NOT use scoped @tuannvm/gemini-mcp-server package name');
});

test('STD-10: unified-mcp-server uses unscoped gemini references', () => {
  const mcsPath = path.join(ROOT, 'bin', 'unified-mcp-server.mjs');
  if (!fs.existsSync(mcsPath)) return; // skip if file doesn't exist

  const content = fs.readFileSync(mcsPath, 'utf8');
  assert.ok(!content.includes('@tuannvm/gemini-mcp-server'),
    'unified-mcp-server.mjs must NOT use scoped @tuannvm/gemini-mcp-server package name');
});

test('STD-10: NF_KEYWORD_MAP in install.js maps gemini to gemini-cli prefix', () => {
  const content = fs.readFileSync(installPath, 'utf8');

  // install.js NF_KEYWORD_MAP should map gemini keyword to gemini-cli MCP prefix
  assert.match(content, /NF_KEYWORD_MAP/,
    'install.js should define NF_KEYWORD_MAP');
  assert.match(content, /gemini.*gemini-cli|gemini-cli.*gemini/,
    'NF_KEYWORD_MAP should map gemini to gemini-cli prefix (unscoped package name)');
});
