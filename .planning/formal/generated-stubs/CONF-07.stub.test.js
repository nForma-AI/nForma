#!/usr/bin/env node
// @requirement CONF-07
// Config schema extended with circuit_breaker.commit_window (integer, default: 6)
// Strategy: structural — verify DEFAULT_CONFIG has the field and config-loader validates it

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_LOADER = path.join(__dirname, '..', '..', '..', 'hooks', 'config-loader.js');

test('CONF-07: DEFAULT_CONFIG contains circuit_breaker.commit_window = 6', () => {
  const { DEFAULT_CONFIG } = require(CONFIG_LOADER);
  assert.ok(DEFAULT_CONFIG.circuit_breaker, 'DEFAULT_CONFIG must have circuit_breaker object');
  assert.strictEqual(DEFAULT_CONFIG.circuit_breaker.commit_window, 6,
    'commit_window default must be 6');
});

test('CONF-07: commit_window is validated as a positive integer in config-loader', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  assert.match(content, /commit_window/, 'config-loader must reference commit_window');
  assert.match(content, /Number\.isInteger.*commit_window/,
    'must validate commit_window is an integer');
});

test('CONF-07: nf-circuit-breaker.js uses commit_window from config', () => {
  const cbContent = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'hooks', 'nf-circuit-breaker.js'), 'utf8');
  assert.match(cbContent, /commit_window/,
    'nf-circuit-breaker.js must reference commit_window from config');
});
