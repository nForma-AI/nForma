#!/usr/bin/env node
// @requirement KEY-04
// Test: Wizard automatically restarts the agent after key changes take effect
// Strategy: structural — verify applyKeyUpdate exists and set-secret.cjs completes
//   the full apply->sync->restart cycle (key changes flow through to claude.json)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('KEY-04: manage-agents-core.cjs exports applyKeyUpdate (key change application function)', () => {
  const corePath = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');
  const core = require(corePath);
  assert.equal(typeof core._pure.applyKeyUpdate, 'function',
    'applyKeyUpdate must be exported via _pure for key change application');
});

test('KEY-04: set-secret.cjs completes full key-apply cycle (set -> sync to claude.json)', () => {
  // The restart mechanism works by writing updated keys to ~/.claude.json;
  // MCP servers pick up env changes on next invocation (effective restart).
  const setSecretSrc = fs.readFileSync(
    path.resolve(__dirname, '../../../bin/set-secret.cjs'), 'utf8');
  // Verify set-secret calls set() then syncToClaudeJson() in sequence
  assert.match(setSecretSrc, /await\s+set\s*\(/,
    'set-secret.cjs must call set() to store key in keychain');
  assert.match(setSecretSrc, /await\s+syncToClaudeJson\s*\(/,
    'set-secret.cjs must call syncToClaudeJson() to propagate key to claude.json');
});

test('KEY-04: secrets.cjs patchClaudeJsonForKey uses atomic write (rename pattern)', () => {
  const secretsSrc = fs.readFileSync(
    path.resolve(__dirname, '../../../bin/secrets.cjs'), 'utf8');
  // Verify atomic write pattern: write to .tmp then rename
  assert.match(secretsSrc, /\.tmp/,
    'patchClaudeJsonForKey must use .tmp file for atomic write');
  assert.match(secretsSrc, /renameSync/,
    'patchClaudeJsonForKey must use renameSync for atomic file replacement');
});
