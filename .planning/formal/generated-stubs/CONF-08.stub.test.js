#!/usr/bin/env node
// @requirement CONF-08
// Circuit breaker config values validated on load; invalid values fall back to defaults with stderr warning
// Strategy: constant — verify validateConfig corrects invalid circuit_breaker values to defaults

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CONFIG_LOADER = path.join(__dirname, '..', '..', '..', 'hooks', 'config-loader.js');
const { validateConfig, DEFAULT_CONFIG } = require(CONFIG_LOADER);

test('CONF-08: validateConfig resets non-object circuit_breaker to defaults', () => {
  const config = { ...DEFAULT_CONFIG, circuit_breaker: 'invalid' };
  const result = validateConfig(config);
  assert.deepStrictEqual(result.circuit_breaker, { ...DEFAULT_CONFIG.circuit_breaker },
    'non-object circuit_breaker must be reset to defaults');
});

test('CONF-08: validateConfig resets invalid oscillation_depth to default 3', () => {
  const config = {
    ...DEFAULT_CONFIG,
    circuit_breaker: { ...DEFAULT_CONFIG.circuit_breaker, oscillation_depth: -1 },
  };
  const result = validateConfig(config);
  assert.strictEqual(result.circuit_breaker.oscillation_depth, 3,
    'invalid oscillation_depth must fall back to 3');
});

test('CONF-08: validateConfig resets invalid commit_window to default 6', () => {
  const config = {
    ...DEFAULT_CONFIG,
    circuit_breaker: { ...DEFAULT_CONFIG.circuit_breaker, commit_window: 0 },
  };
  const result = validateConfig(config);
  assert.strictEqual(result.circuit_breaker.commit_window, 6,
    'invalid commit_window must fall back to 6');
});

test('CONF-08: validateConfig resets non-integer oscillation_depth to default', () => {
  const config = {
    ...DEFAULT_CONFIG,
    circuit_breaker: { ...DEFAULT_CONFIG.circuit_breaker, oscillation_depth: 2.5 },
  };
  const result = validateConfig(config);
  assert.strictEqual(result.circuit_breaker.oscillation_depth, 3,
    'non-integer oscillation_depth must fall back to 3');
});

test('CONF-08: validateConfig preserves valid circuit_breaker values', () => {
  const config = {
    ...DEFAULT_CONFIG,
    circuit_breaker: { ...DEFAULT_CONFIG.circuit_breaker, oscillation_depth: 5, commit_window: 10 },
  };
  const result = validateConfig(config);
  assert.strictEqual(result.circuit_breaker.oscillation_depth, 5);
  assert.strictEqual(result.circuit_breaker.commit_window, 10);
});
