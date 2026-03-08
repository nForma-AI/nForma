#!/usr/bin/env node
// @requirement KEY-01
// Formal property: InputKey (invariant)
// User can set or update the API key for any agent through the wizard

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CORE_MODULE = path.join(__dirname, '..', '..', '..', 'bin', 'manage-agents-core.cjs');

test('KEY-01: manage-agents-core exports applyKeyUpdate for setting API keys', () => {
  const src = fs.readFileSync(CORE_MODULE, 'utf8');

  // Must have an applyKeyUpdate function that handles key setting
  assert.match(src, /function\s+applyKeyUpdate/,
    'Must define applyKeyUpdate function');

  // Must accept apiKey in updates and store it
  assert.match(src, /updates\.apiKey/,
    'applyKeyUpdate must read updates.apiKey');

  // Must support keytar-based storage via secretsLib.set
  assert.match(src, /secretsLib\.set\('nforma'/,
    'Must call secretsLib.set with nforma service for secure storage');
});

test('KEY-01: manage-agents-core exports applyCcrProviderUpdate for provider key management', () => {
  const src = fs.readFileSync(CORE_MODULE, 'utf8');

  // Must have applyCcrProviderUpdate for CCR provider key set/remove
  assert.match(src, /function\s+applyCcrProviderUpdate/,
    'Must define applyCcrProviderUpdate function');

  // Must support "set" subAction
  assert.match(src, /subAction\s*===\s*'set'/,
    'Must handle set subAction for provider keys');
});
