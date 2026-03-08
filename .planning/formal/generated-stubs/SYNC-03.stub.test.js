#!/usr/bin/env node
// @requirement SYNC-03
// Structural test: changelog explicitly tracks GSD version compatibility

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SYNC-03: CHANGELOG.md contains GSD compatibility declaration', () => {
  const changelogPath = path.resolve(__dirname, '../../../CHANGELOG.md');
  const content = fs.readFileSync(changelogPath, 'utf8');
  assert.match(content, /GSD compatibility/i,
    'CHANGELOG must contain a GSD compatibility statement');
});

test('SYNC-03: GSD compatibility specifies minimum version', () => {
  const changelogPath = path.resolve(__dirname, '../../../CHANGELOG.md');
  const content = fs.readFileSync(changelogPath, 'utf8');
  // Must reference the get-shit-done-cc package with a version constraint
  assert.match(content, /get-shit-done-cc\s*>=?\s*[\d.]+/,
    'CHANGELOG must specify get-shit-done-cc version constraint');
});
