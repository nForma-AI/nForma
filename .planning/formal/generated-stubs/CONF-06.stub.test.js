#!/usr/bin/env node
// @requirement CONF-06
// Config schema extended with circuit_breaker.oscillation_depth (integer, default: 3)
// Strategy: structural — verify DEFAULT_CONFIG has the field and config-loader validates it

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_LOADER = path.join(__dirname, '..', '..', '..', 'hooks', 'config-loader.js');

test('CONF-06: DEFAULT_CONFIG contains circuit_breaker.oscillation_depth = 3', () => {
  const { DEFAULT_CONFIG } = require(CONFIG_LOADER);
  assert.ok(DEFAULT_CONFIG.circuit_breaker, 'DEFAULT_CONFIG must have circuit_breaker object');
  assert.strictEqual(DEFAULT_CONFIG.circuit_breaker.oscillation_depth, 3,
    'oscillation_depth default must be 3');
});

test('CONF-06: oscillation_depth is validated as a positive integer in config-loader', () => {
  const content = fs.readFileSync(CONFIG_LOADER, 'utf8');
  assert.match(content, /oscillation_depth/, 'config-loader must reference oscillation_depth');
  assert.match(content, /Number\.isInteger.*oscillation_depth/,
    'must validate oscillation_depth is an integer');
});

test('CONF-06: nf-circuit-breaker.js uses oscillation_depth from config', () => {
  const cbContent = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'hooks', 'nf-circuit-breaker.js'), 'utf8');
  assert.match(cbContent, /oscillation_depth/,
    'nf-circuit-breaker.js must reference oscillation_depth from config');
});
