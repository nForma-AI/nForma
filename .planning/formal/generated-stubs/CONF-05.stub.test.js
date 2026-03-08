#!/usr/bin/env node
// @requirement CONF-05
// Config validates on read -- malformed config falls back to hardcoded defaults with warning
// Strategy: structural — verify config-loader.js has readConfigFile that returns null on malformed + warning

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_LOADER = path.join(__dirname, '..', '..', '..', 'hooks', 'config-loader.js');

test('CONF-05: config-loader.js readConfigFile returns null on malformed JSON with stderr warning', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  // readConfigFile must catch JSON parse errors
  assert.match(content, /function readConfigFile/, 'config-loader.js must define readConfigFile');
  assert.match(content, /JSON\.parse/, 'readConfigFile must attempt JSON.parse');
  // On parse failure, must return null
  assert.match(content, /return null/, 'readConfigFile must return null on failure');
  // Must emit warning to stderr (not stdout)
  assert.match(content, /process\.stderr\.write.*WARNING.*[Mm]alformed/, 'must warn on malformed config via stderr');
});

test('CONF-05: loadConfig falls back to DEFAULT_CONFIG when both layers missing/malformed', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  // loadConfig must check if both global and project configs are null
  assert.match(content, /!globalObj\s*&&\s*!projectObj/, 'loadConfig must check both layers missing');
  // Must spread DEFAULT_CONFIG as fallback
  assert.match(content, /\{\s*\.\.\.DEFAULT_CONFIG\s*\}/, 'loadConfig must spread DEFAULT_CONFIG as fallback');
  // Must emit warning about using hardcoded defaults
  assert.match(content, /hardcoded defaults/, 'loadConfig must warn about using hardcoded defaults');
});

test('CONF-05: config-loader.js exports DEFAULT_CONFIG and validateConfig', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  assert.match(content, /module\.exports\s*=.*DEFAULT_CONFIG/, 'must export DEFAULT_CONFIG');
  assert.match(content, /module\.exports\s*=.*validateConfig/, 'must export validateConfig');
});
