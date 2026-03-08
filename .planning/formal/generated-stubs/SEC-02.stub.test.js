#!/usr/bin/env node
// @requirement SEC-02
// Structural test: run-formal-verify.cjs provides CI pipeline scanning across repo

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SEC-02: run-formal-verify.cjs exists and is a CI scanning entrypoint', () => {
  const filePath = path.join(ROOT, 'bin', 'run-formal-verify.cjs');
  assert.ok(fs.existsSync(filePath), 'run-formal-verify.cjs must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /formal.verification|formal.verify/i,
    'run-formal-verify.cjs must reference formal verification');
});

test('SEC-02: run-formal-verify.cjs includes transcript-scan step for deep scanning', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-formal-verify.cjs'), 'utf8');
  assert.match(content, /transcript-scan/,
    'Must include transcript-scan step for deep scanning across repo');
});

test('SEC-02: package.json includes secrets:scan script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['secrets:scan'],
    'package.json must have a secrets:scan script for CI secret scanning');
});

test('SEC-02: run-formal-verify.cjs supports CI enforcement steps', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-formal-verify.cjs'), 'utf8');
  assert.match(content, /--only=ci/,
    'Must support --only=ci flag for CI enforcement mode');
});
