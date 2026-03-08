#!/usr/bin/env node
// @requirement SLOT-01
// Test: User sees all quorum agents referred to by slot name in all QGSD output and commands

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_PATH = path.resolve(__dirname, '../../../bin/providers.json');

test('SLOT-01: providers.json exists and is valid JSON', () => {
  const content = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const data = JSON.parse(content);
  assert.ok(Array.isArray(data.providers), 'providers should be an array');
  assert.ok(data.providers.length > 0, 'should have at least one provider');
});

test('SLOT-01: every provider entry has a slot-style name', () => {
  const data = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  const slotNamePattern = /^[a-z]+-\d+$/;
  for (const provider of data.providers) {
    assert.ok(typeof provider.name === 'string', 'provider must have a name');
    assert.match(provider.name, slotNamePattern,
      `Provider name "${provider.name}" should follow slot-name pattern (e.g., codex-1, gemini-1)`);
  }
});

test('SLOT-01: known slot names are present', () => {
  const data = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  const names = data.providers.map(p => p.name);
  // At minimum, codex-1, gemini-1, opencode-1, copilot-1 should exist
  for (const expected of ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1']) {
    assert.ok(names.includes(expected),
      `Expected slot name "${expected}" to be in providers.json`);
  }
});
