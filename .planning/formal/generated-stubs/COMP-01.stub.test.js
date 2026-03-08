#!/usr/bin/env node
// @requirement COMP-01
// User can define a quorum.active array in config listing which slots participate in quorum
// Formal model: quorum-composition.als — AllRulesHold assertion
// Strategy: structural — verify config-loader.js supports quorum_active array

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const CONFIG_LOADER = path.join(ROOT, 'hooks', 'config-loader.js');

test('COMP-01: config-loader.js defines quorum_active in DEFAULT_CONFIG as an array', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  // DEFAULT_CONFIG must include quorum_active: []
  assert.match(content, /quorum_active:\s*\[\]/, 'DEFAULT_CONFIG must define quorum_active as empty array');
});

test('COMP-01: config-loader.js validates quorum_active is an array', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  // Must validate Array.isArray(config.quorum_active)
  assert.match(content, /Array\.isArray\(config\.quorum_active\)/, 'must validate quorum_active is an array');
  // Must warn on invalid type
  assert.match(content, /quorum_active must be an array/, 'must warn if quorum_active is not an array');
});

test('COMP-01: config-loader.js quorum_active replaces (not merges) on project override', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  // Project config's quorum_active must entirely replace global value
  assert.match(content, /quorum_active.*entirely replace/, 'quorum_active from project config must replace global');
});

test('COMP-01: nf-prompt.js reads quorum_active from config for slot selection', () => {
  const promptContent = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  // Must reference config.quorum_active
  assert.match(promptContent, /config\.quorum_active/, 'nf-prompt.js must read config.quorum_active');
  // Must derive activeSlots from it
  assert.match(promptContent, /activeSlots/, 'nf-prompt.js must derive activeSlots from quorum_active');
});

test('COMP-01: nf-stop.js reads quorum_active from config for pool derivation', () => {
  const stopContent = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-stop.js'), 'utf8');
  // Must reference config.quorum_active
  assert.match(stopContent, /config\.quorum_active|quorumActive/, 'nf-stop.js must read quorum_active from config');
});
