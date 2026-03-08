#!/usr/bin/env node
// @requirement CONF-03
// Structural test: DEFAULT_CONFIG contains quorum_commands (array), required_models (dict), fail_mode (open|closed)

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('CONF-03 — ConfigLayer: DEFAULT_CONFIG has quorum_commands as array of command names', () => {
  const { DEFAULT_CONFIG } = require('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js');
  assert.ok(Array.isArray(DEFAULT_CONFIG.quorum_commands), 'quorum_commands must be an array');
  assert.ok(DEFAULT_CONFIG.quorum_commands.length > 0, 'quorum_commands must not be empty');
  for (const cmd of DEFAULT_CONFIG.quorum_commands) {
    assert.strictEqual(typeof cmd, 'string', 'Each quorum_command entry must be a string');
  }
});

test('CONF-03 — ConfigLayer: DEFAULT_CONFIG has required_models as dict with tool_prefix and required', () => {
  const { DEFAULT_CONFIG } = require('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js');
  assert.strictEqual(typeof DEFAULT_CONFIG.required_models, 'object', 'required_models must be an object');
  assert.ok(!Array.isArray(DEFAULT_CONFIG.required_models), 'required_models must not be an array');

  const entries = Object.entries(DEFAULT_CONFIG.required_models);
  assert.ok(entries.length > 0, 'required_models must have at least one entry');
  for (const [key, val] of entries) {
    assert.strictEqual(typeof val.tool_prefix, 'string', `${key}.tool_prefix must be a string`);
    assert.strictEqual(typeof val.required, 'boolean', `${key}.required must be a boolean`);
  }
});

test('CONF-03 — ConfigLayer: DEFAULT_CONFIG has fail_mode defaulting to "open"', () => {
  const { DEFAULT_CONFIG } = require('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js');
  assert.strictEqual(DEFAULT_CONFIG.fail_mode, 'open', 'fail_mode default must be "open"');
});

test('CONF-03 — ConfigLayer: validateConfig rejects invalid fail_mode values', () => {
  const { validateConfig } = require('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js');
  const config = {
    quorum_commands: ['quick'],
    required_models: {},
    fail_mode: 'invalid',
    circuit_breaker: { oscillation_depth: 3, commit_window: 6, haiku_reviewer: true, haiku_model: 'claude-haiku-4-5-20251001' },
    quorum_active: [],
    quorum: { minSize: 4, preferSub: false },
    agent_config: {},
    model_preferences: {},
    context_monitor: { warn_pct: 70, critical_pct: 90 },
    budget: { session_limit_tokens: null, warn_pct: 60, downgrade_pct: 85 },
    stall_detection: { timeout_s: 90, consecutive_threshold: 2, check_commits: true },
    smart_compact: { enabled: true, context_warn_pct: 60 },
  };
  validateConfig(config);
  assert.strictEqual(config.fail_mode, 'open', 'Invalid fail_mode should be corrected to "open"');
});
