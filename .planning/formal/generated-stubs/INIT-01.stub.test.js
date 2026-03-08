#!/usr/bin/env node
// @requirement INIT-01
// Structural test: load-baseline-requirements.cjs exports loadBaselineRequirements
// which filters baseline requirements by project profile (web/mobile/desktop/api/cli/library).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/load-baseline-requirements.cjs');

test('INIT-01 — Profile: loadBaselineRequirements function exists and accepts profile parameter', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Verify the function signature accepts a profile parameter
  assert.match(content, /function\s+loadBaselineRequirements\s*\(\s*profile/,
    'loadBaselineRequirements must accept a profile parameter');

  // Verify it filters by supported profiles (web/mobile/desktop/api/cli/library)
  assert.match(content, /profiles\.includes\s*\(\s*profile\s*\)/,
    'Must filter requirements by profile membership');

  // Verify the module exports the function
  assert.match(content, /module\.exports/,
    'Must export loadBaselineRequirements via module.exports');
});

test('INIT-01 — Profile: validates profile against known profiles', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Verify it throws on invalid profile
  assert.match(content, /Invalid profile/,
    'Must throw on invalid profile');

  // Verify it reads profiles from index
  assert.match(content, /index\.profiles\[profile\]/,
    'Must look up profile in index.profiles');
});
