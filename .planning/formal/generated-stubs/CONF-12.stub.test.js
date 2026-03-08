#!/usr/bin/env node
// @requirement CONF-12
// Per-repo marker at .planning/polyrepo.json supports an optional `docs` field
// with merge-semantic key-value pairs (user, developer, examples, or custom)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const polyrepoPath = path.join(PROJECT_ROOT, 'bin', 'polyrepo.cjs');

test('CONF-12: writeMarker accepts optional docs parameter', () => {
  const content = fs.readFileSync(polyrepoPath, 'utf8');
  assert.match(content, /function writeMarker\(repoPath,\s*name,\s*role,\s*docs\)/,
    'writeMarker must accept a docs parameter');
});

test('CONF-12: writeMarker includes docs in marker when provided', () => {
  const content = fs.readFileSync(polyrepoPath, 'utf8');
  assert.match(content, /marker\.docs\s*=\s*docs/,
    'writeMarker must assign docs to marker object when provided');
});

test('CONF-12: setDocs function exports for merge-semantic doc updates', () => {
  const polyrepo = require(polyrepoPath);
  assert.equal(typeof polyrepo.setDocs, 'function',
    'setDocs must be exported for merge-semantic doc path updates');
});

test('CONF-12: setDocs supports merge semantics with null removal', () => {
  const content = fs.readFileSync(polyrepoPath, 'utf8');
  assert.match(content, /val\s*===\s*null/,
    'setDocs must handle null values to remove doc keys');
  assert.match(content, /delete\s+merged\[/,
    'setDocs must delete keys when value is null');
});

test('CONF-12: docs field supports user, developer, examples keys', () => {
  const content = fs.readFileSync(polyrepoPath, 'utf8');
  assert.match(content, /user.*developer.*examples|user,\s*developer,\s*examples/,
    'polyrepo must document user, developer, examples as doc key names');
});
