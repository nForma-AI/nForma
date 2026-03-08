#!/usr/bin/env node
// @requirement INST-09
// Structural test for DefaultConfigPresent:
// Installer writes default circuit_breaker config block to nf.json on first install.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'bin', 'install.js'),
  'utf8'
);

test('INST-09: nf.json includes circuit_breaker block on first install', () => {
  // The initial nfConfig object must contain circuit_breaker
  assert.match(installSource, /circuit_breaker:\s*\{/);
});

test('INST-09: default oscillation_depth is 3', () => {
  assert.match(installSource, /oscillation_depth:\s*3/);
});

test('INST-09: default commit_window is 6', () => {
  assert.match(installSource, /commit_window:\s*6/);
});

test('INST-09: INST-09 comment documents DEFAULT_CONFIG alignment', () => {
  // Must reference DEFAULT_CONFIG in config-loader.js for consistency
  assert.match(installSource, /INST-09.*DEFAULT_CONFIG/);
});

test('INST-09: circuit_breaker is backfilled on reinstall if missing', () => {
  // On reinstall, if circuit_breaker block is absent, it is added
  assert.match(installSource, /!existingConfig\.circuit_breaker/);
  assert.match(installSource, /Added circuit_breaker config block/);
});
