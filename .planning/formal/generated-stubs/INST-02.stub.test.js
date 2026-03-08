#!/usr/bin/env node
// @requirement INST-02
// Structural test: package.json pins GSD version for hook compatibility lockstep.
// The AllEquivalence assertion ensures consistent install state across equivalent selections.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('INST-02 — AllEquivalence: package.json has a pinned version', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Version must exist and be a valid semver string
  assert.ok(pkg.version, 'package.json must have a version field');
  assert.match(pkg.version, /^\d+\.\d+\.\d+/,
    'version must be a valid semver string (not a range)');
});

test('INST-02 — AllEquivalence: install.js reads version from package.json', () => {
  const installSource = path.resolve(__dirname, '../../../bin/install.js');
  const content = fs.readFileSync(installSource, 'utf8');

  // Installer must import package.json to get the version
  assert.match(content, /require\(['"]\.\.\/package\.json['"]\)/,
    'install.js must require package.json for version');
});

test('INST-02 — AllEquivalence: requirement-map maps alloy:install-scope to INST-02', () => {
  const reqMapSource = path.resolve(__dirname, '../../../bin/requirement-map.cjs');
  const content = fs.readFileSync(reqMapSource, 'utf8');

  assert.match(content, /alloy:install-scope.*INST-02/s,
    'requirement-map must include INST-02 under alloy:install-scope');
});
