#!/usr/bin/env node
// @requirement PRST-02
// Structural test: User can clone an existing slot — copies provider URL and model config,
// prompts for new slot name.
// Verifies buildCloneEntry function exists and correctly copies provider URL + model config.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');
const mod = require(SOURCE);
const { buildCloneEntry } = mod._pure;

test('PRST-02: buildCloneEntry is exported as a pure function', () => {
  assert.equal(typeof buildCloneEntry, 'function', 'buildCloneEntry must be a function');
});

test('PRST-02: buildCloneEntry copies ANTHROPIC_BASE_URL and CLAUDE_DEFAULT_MODEL', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
    env: {
      ANTHROPIC_BASE_URL: 'https://api.together.xyz/v1',
      CLAUDE_DEFAULT_MODEL: 'qwen-coder-32b',
      PROVIDER_SLOT: 'together-1',
    },
  };
  const result = buildCloneEntry(sourceCfg, 'together-2');
  assert.equal(result.env.ANTHROPIC_BASE_URL, 'https://api.together.xyz/v1',
    'cloned entry must copy ANTHROPIC_BASE_URL');
  assert.equal(result.env.CLAUDE_DEFAULT_MODEL, 'qwen-coder-32b',
    'cloned entry must copy CLAUDE_DEFAULT_MODEL');
  assert.equal(result.env.PROVIDER_SLOT, 'together-2',
    'cloned entry must set PROVIDER_SLOT to new name');
});

test('PRST-02: buildCloneEntry copies type, command, and args from source', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'npx',
    args: ['my-agent', '--flag'],
    env: { ANTHROPIC_BASE_URL: 'https://api.fireworks.ai/inference/v1' },
  };
  const result = buildCloneEntry(sourceCfg, 'fireworks-2');
  assert.equal(result.type, 'stdio', 'type must be copied');
  assert.equal(result.command, 'npx', 'command must be copied');
  assert.deepEqual(result.args, ['my-agent', '--flag'], 'args must be deep-copied');
  // Verify args are a copy, not the same reference
  assert.notEqual(result.args, sourceCfg.args, 'args must be a separate array');
});

test('PRST-02: buildCloneEntry handles missing source env gracefully', () => {
  const result = buildCloneEntry({}, 'empty-clone');
  assert.equal(result.env.PROVIDER_SLOT, 'empty-clone',
    'PROVIDER_SLOT must be set even with empty source');
  assert.equal(result.type, 'stdio', 'defaults to stdio type');
  assert.equal(result.command, 'node', 'defaults to node command');
});
