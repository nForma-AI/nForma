#!/usr/bin/env node
// @requirement PROV-03
// Structural test: Wizard updates ~/.claude.json ANTHROPIC_BASE_URL and restarts agent on apply
// Verifies writeClaudeJson exists and ANTHROPIC_BASE_URL is propagated in env config.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('PROV-03: writeClaudeJson function is exported for persisting provider changes', () => {
  const mod = require(SOURCE);
  assert.equal(typeof mod.writeClaudeJson, 'function', 'writeClaudeJson must be exported');
});

test('PROV-03: writeClaudeJson uses atomic write (tmp + rename)', () => {
  // The code uses CLAUDE_JSON_TMP variable (defined as path + '.tmp')
  assert.match(content, /CLAUDE_JSON_TMP\s*=.*\.tmp/, 'must define a .tmp path constant');
  assert.match(content, /writeFileSync\(CLAUDE_JSON_TMP/, 'must write to tmp path first');
  assert.match(content, /renameSync\(CLAUDE_JSON_TMP/, 'must rename tmp to final path');
});

test('PROV-03: ANTHROPIC_BASE_URL is set in agent env entries', () => {
  // buildCloneEntry copies ANTHROPIC_BASE_URL from source config
  assert.match(content, /ANTHROPIC_BASE_URL/, 'ANTHROPIC_BASE_URL must be referenced');
  const mod = require(SOURCE);
  const { buildCloneEntry } = mod._pure;
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_DEFAULT_MODEL: 'test-model' },
  };
  const result = buildCloneEntry(sourceCfg, 'new-slot');
  assert.equal(result.env.ANTHROPIC_BASE_URL, 'https://api.akashml.com/v1',
    'buildCloneEntry must propagate ANTHROPIC_BASE_URL');
});
