#!/usr/bin/env node
// @requirement SYNC-01
// Structural test: QGSD ships as separate npm package that wraps GSD

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SYNC-01: package.json defines npm package identity', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  // Must have a scoped npm package name
  assert.ok(pkg.name, 'package.json must have a name field');
  assert.match(pkg.name, /@nforma/,
    'Package must be published under @nforma scope');
});

test('SYNC-01: package.json has bin entries for CLI distribution', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(pkg.bin, 'package.json must have bin entries for CLI');
  assert.ok(Object.keys(pkg.bin).length > 0,
    'bin must have at least one entry');
});

test('SYNC-01: package.json has files field for npm packaging', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(Array.isArray(pkg.files), 'package.json must have files array for npm distribution');
  assert.ok(pkg.files.length > 0, 'files array must not be empty');
});
