#!/usr/bin/env node
// @requirement KEY-02
// Formal property: StoreInKeytar (invariant)
// Key is stored securely via keytar (bin/secrets.cjs)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SECRETS_MODULE = path.join(__dirname, '..', '..', '..', 'bin', 'secrets.cjs');

test('KEY-02: secrets.cjs uses keytar for secure key storage', () => {
  const src = fs.readFileSync(SECRETS_MODULE, 'utf8');

  // Must lazy-load keytar
  assert.match(src, /require\('keytar'\)/,
    'Must require keytar for native keychain access');

  // Must define a set function that calls keytar.setPassword
  assert.match(src, /setPassword/,
    'Must call keytar.setPassword for storing keys');

  // Must define a get function that calls keytar.getPassword
  assert.match(src, /getPassword/,
    'Must call keytar.getPassword for retrieving keys');
});

test('KEY-02: secrets.cjs uses nforma service name', () => {
  const src = fs.readFileSync(SECRETS_MODULE, 'utf8');

  // Service constant must be 'nforma'
  assert.match(src, /SERVICE\s*=\s*'nforma'/,
    'Must define SERVICE constant as nforma');
});

test('KEY-02: secrets.cjs maintains a local key index for non-keychain lookups', () => {
  const src = fs.readFileSync(SECRETS_MODULE, 'utf8');

  // Must maintain a JSON index file for hasKey checks without keychain prompts
  assert.match(src, /nf-key-index\.json/,
    'Must use nf-key-index.json for local key index');

  // Must export hasKey that reads index without keychain access
  assert.match(src, /function\s+hasKey/,
    'Must define hasKey function for prompt-free key existence checks');
});
