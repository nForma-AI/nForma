#!/usr/bin/env node
// @requirement CI-01
// Structural test: Automated test suite runs on every PR; merge blocked when tests fail.
// Verifies package.json has test script and test files exist.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CI-01: package.json defines a test script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts.test, 'package.json must have a scripts.test entry');
  // test script delegates to test:ci which uses node --test
  assert.ok(pkg.scripts['test:ci'], 'package.json must have a test:ci script');
  assert.match(pkg.scripts['test:ci'], /node --test/, 'test:ci must invoke node --test runner');
});

test('CI-01: test files exist in bin/ and hooks/dist/', () => {
  const binTests = fs.readdirSync(path.join(ROOT, 'bin')).filter(f => f.endsWith('.test.cjs') || f.endsWith('.test.js'));
  assert.ok(binTests.length > 0, 'bin/ must contain test files');

  const hooksDistTests = fs.readdirSync(path.join(ROOT, 'hooks', 'dist')).filter(f => f.endsWith('.test.js'));
  assert.ok(hooksDistTests.length > 0, 'hooks/dist/ must contain test files');
});

test('CI-01: test:formal script exists for formal verification tests', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['test:formal'], 'package.json must have a test:formal script');
  assert.match(pkg.scripts['test:formal'], /node --test/, 'test:formal must invoke node --test runner');
});
