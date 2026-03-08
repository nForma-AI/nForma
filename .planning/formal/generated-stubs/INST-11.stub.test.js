#!/usr/bin/env node
// @requirement INST-11
// Formal property: Dir (assertion)
// Bin scripts resolve ROOT from process.cwd() rather than __dirname

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BIN_DIR = path.join(__dirname, '..', '..', '..', 'bin');

// Key bin scripts that must use process.cwd() for ROOT resolution
const SCRIPTS_REQUIRING_CWD = [
  'nf-solve.cjs',
  'run-formal-verify.cjs',
];

test('INST-11: bin scripts resolve ROOT from process.cwd(), not __dirname', () => {
  for (const script of SCRIPTS_REQUIRING_CWD) {
    const filePath = path.join(BIN_DIR, script);
    const src = fs.readFileSync(filePath, 'utf8');

    // Must set ROOT from process.cwd()
    assert.match(src, /ROOT\s*=\s*process\.cwd\(\)/,
      `${script} must set ROOT = process.cwd()`);

    // Must support --project-root override
    assert.match(src, /--project-root/,
      `${script} must support --project-root flag override`);
  }
});

test('INST-11: bin scripts do NOT use __dirname for ROOT', () => {
  for (const script of SCRIPTS_REQUIRING_CWD) {
    const filePath = path.join(BIN_DIR, script);
    const src = fs.readFileSync(filePath, 'utf8');

    // __dirname must NOT appear as the ROOT assignment
    // (it may appear elsewhere for other purposes, so we check the specific pattern)
    assert.doesNotMatch(src, /ROOT\s*=\s*__dirname/,
      `${script} must NOT set ROOT = __dirname`);
  }
});
