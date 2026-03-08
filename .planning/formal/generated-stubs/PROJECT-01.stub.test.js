#!/usr/bin/env node
// @requirement PROJECT-01
// Formal property: user-facing contexts use 'nForma' branding

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installJsPath = path.resolve(__dirname, '..', '..', '..', 'bin', 'install.js');
const installContent = fs.readFileSync(installJsPath, 'utf8');

test('PROJECT-01: install.js banner contains nForma branding', () => {
  assert.match(installContent, /nForma/, 'install.js should reference nForma in user-facing output');
});

test('PROJECT-01: install.js banner tagline uses nForma name', () => {
  assert.match(
    installContent,
    /nForma.*Consensus before code/,
    'install.js banner should include nForma tagline'
  );
});

test('PROJECT-01: nForma.cjs TUI module exists and is named for project identity', () => {
  const nFormaCjsPath = path.resolve(__dirname, '..', '..', '..', 'bin', 'nForma.cjs');
  assert.ok(fs.existsSync(nFormaCjsPath), 'bin/nForma.cjs should exist as the user-facing TUI');
});
