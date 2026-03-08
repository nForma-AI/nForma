#!/usr/bin/env node
// @requirement MCPENV-01
// Structural test: .planning/formal/spec/mcp-calls/ contains TLA+ model of MCP environment behavior

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../../..');
const specDir = path.join(projectRoot, '.planning', 'formal', 'spec', 'mcp-calls');
const tlaModelPath = path.join(projectRoot, '.planning', 'formal', 'tla', 'QGSDMCPEnv.tla');

test('MCPENV-01: mcp-calls spec directory exists with documentation', () => {
  assert.ok(fs.existsSync(specDir),
    '.planning/formal/spec/mcp-calls/ directory must exist');

  // Must contain environment documentation
  const envDoc = path.join(specDir, 'environment.md');
  assert.ok(fs.existsSync(envDoc),
    'mcp-calls/environment.md must exist describing MCP environment behavior');

  // Must contain invariants documentation
  const invDoc = path.join(specDir, 'invariants.md');
  assert.ok(fs.existsSync(invDoc),
    'mcp-calls/invariants.md must exist describing MCP environment invariants');
});

test('MCPENV-01: TLA+ model QGSDMCPEnv.tla exists and defines TypeInvariant', () => {
  assert.ok(fs.existsSync(tlaModelPath),
    'QGSDMCPEnv.tla TLA+ model file must exist');

  const content = fs.readFileSync(tlaModelPath, 'utf8');

  // The model must define TypeInvariant (the formal property under test)
  assert.match(content, /TypeInvariant/,
    'QGSDMCPEnv.tla must define TypeInvariant');
});
