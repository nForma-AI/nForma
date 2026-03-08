#!/usr/bin/env node
// @requirement MCPENV-03
// Structural test: EventualDecision liveness property exists in QGSDMCPEnv.tla
// and requirement-map.cjs maps tla:mcp-environment to MCPENV-03

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('MCPENV-03: EventualDecision liveness property defined in QGSDMCPEnv.tla', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDMCPEnv.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  // The TLA+ model must define EventualDecision as a liveness property
  assert.match(content, /EventualDecision\s*==\s*<>\(quorumPhase\s*=\s*"DECIDED"\)/,
    'EventualDecision liveness property must be defined');
  // Must be tagged with @requirement MCPENV-03
  assert.match(content, /@requirement\s+MCPENV-03/,
    'EventualDecision must be tagged with @requirement MCPENV-03');
});

test('MCPENV-03: requirement-map.cjs maps tla:mcp-environment to MCPENV-03', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(path.join(ROOT, 'bin', 'requirement-map.cjs'));
  const mapping = CHECK_ID_TO_REQUIREMENTS['tla:mcp-environment'];
  assert.ok(Array.isArray(mapping), 'tla:mcp-environment key must exist in requirement-map');
  assert.ok(mapping.includes('MCPENV-03'), 'MCPENV-03 must be in tla:mcp-environment mapping');
});
