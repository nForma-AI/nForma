#!/usr/bin/env node
// @requirement KEY-03
// Test: Wizard writes key from keytar to `~/.claude.json` mcpServers env block during apply
// Strategy: structural — verify syncToClaudeJson and patchClaudeJsonForKey exports exist in secrets.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const secretsPath = path.resolve(__dirname, '../../../bin/secrets.cjs');

test('KEY-03: secrets.cjs exports syncToClaudeJson function (writes keytar secrets to ~/.claude.json env blocks)', () => {
  const secrets = require(secretsPath);
  assert.equal(typeof secrets.syncToClaudeJson, 'function',
    'syncToClaudeJson must be exported as a function');
});

test('KEY-03: secrets.cjs exports patchClaudeJsonForKey function (patches single env key across mcpServers)', () => {
  const secrets = require(secretsPath);
  assert.equal(typeof secrets.patchClaudeJsonForKey, 'function',
    'patchClaudeJsonForKey must be exported as a function');
});

test('KEY-03: set-secret.cjs source references syncToClaudeJson (wizard apply calls sync)', () => {
  const setSecretPath = path.resolve(__dirname, '../../../bin/set-secret.cjs');
  const content = fs.readFileSync(setSecretPath, 'utf8');
  assert.match(content, /syncToClaudeJson/,
    'set-secret.cjs must call syncToClaudeJson to write keys to ~/.claude.json env blocks');
});
