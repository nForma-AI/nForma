'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _pure } = require('./manage-agents.cjs');
const { deriveKeytarAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate } = _pure;

// ---------------------------------------------------------------------------
// deriveKeytarAccount
// ---------------------------------------------------------------------------

test('deriveKeytarAccount: claude-7 -> ANTHROPIC_API_KEY_CLAUDE_7', () => {
  assert.strictEqual(deriveKeytarAccount('claude-7'), 'ANTHROPIC_API_KEY_CLAUDE_7');
});

test('deriveKeytarAccount: deepseek -> ANTHROPIC_API_KEY_DEEPSEEK', () => {
  assert.strictEqual(deriveKeytarAccount('deepseek'), 'ANTHROPIC_API_KEY_DEEPSEEK');
});

test('deriveKeytarAccount: my-agent-2 -> ANTHROPIC_API_KEY_MY_AGENT_2', () => {
  assert.strictEqual(deriveKeytarAccount('my-agent-2'), 'ANTHROPIC_API_KEY_MY_AGENT_2');
});

test('deriveKeytarAccount: UPPER -> ANTHROPIC_API_KEY_UPPER (already uppercase)', () => {
  assert.strictEqual(deriveKeytarAccount('UPPER'), 'ANTHROPIC_API_KEY_UPPER');
});

// ---------------------------------------------------------------------------
// maskKey
// ---------------------------------------------------------------------------

test('maskKey: null -> (not set)', () => {
  assert.strictEqual(maskKey(null), '(not set)');
});

test('maskKey: empty string -> (not set)', () => {
  assert.strictEqual(maskKey(''), '(not set)');
});

test('maskKey: short key (<=12 chars) -> ***', () => {
  assert.strictEqual(maskKey('short'), '***');
});

test('maskKey: 16-char key -> first 8 + ... + last 4', () => {
  assert.strictEqual(maskKey('sk-1234567890abcd'), 'sk-12345' + '...' + 'abcd');
});

test('maskKey: long key -> first 8 + ... + last 4', () => {
  const key = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const expected = key.slice(0, 8) + '...' + key.slice(-4);
  assert.strictEqual(maskKey(key), expected);
});

// ---------------------------------------------------------------------------
// buildKeyStatus
// ---------------------------------------------------------------------------

test('buildKeyStatus: sub authType -> ANSI cyan [sub]', () => {
  assert.strictEqual(buildKeyStatus('sub', 'any-slot', null), '\x1b[36m[sub]\x1b[0m');
});

test('buildKeyStatus: api authType with hasKey true -> ANSI green [key checkmark]', () => {
  const mockLib = { hasKey: (account) => account === 'ANTHROPIC_API_KEY_CLAUDE_7' };
  assert.strictEqual(buildKeyStatus('api', 'claude-7', mockLib), '\x1b[32m[key \u2713]\x1b[0m');
});

test('buildKeyStatus: api authType with hasKey false -> ANSI dim [no key]', () => {
  const mockLib = { hasKey: () => false };
  assert.strictEqual(buildKeyStatus('api', 'claude-7', mockLib), '\x1b[90m[no key]\x1b[0m');
});

test('buildKeyStatus: undefined authType with null secretsLib -> ANSI dim [no key]', () => {
  assert.strictEqual(buildKeyStatus(undefined, 'x', null), '\x1b[90m[no key]\x1b[0m');
});

// ---------------------------------------------------------------------------
// buildAgentChoiceLabel
// ---------------------------------------------------------------------------

test('buildAgentChoiceLabel: happy path with provider model and sub auth', () => {
  const name = 'claude-7';
  const cfg = { env: { PROVIDER_SLOT: 'claude-7' } };
  const providerMap = { 'claude-7': { model: 'gpt-4o' } };
  const agentCfg = { 'claude-7': { auth_type: 'sub' } };
  const label = buildAgentChoiceLabel(name, cfg, providerMap, agentCfg, null);
  assert.ok(label.startsWith('claude-7'), 'label should start with slot name');
  assert.ok(label.includes('gpt-4o'), 'label should contain model name');
  assert.ok(label.includes('\x1b[36m[sub]\x1b[0m'), 'label should contain sub ANSI tag');
});

test('buildAgentChoiceLabel: falls back to CLAUDE_DEFAULT_MODEL when no providerMap entry', () => {
  const name = 'fallback-agent';
  const cfg = { env: { CLAUDE_DEFAULT_MODEL: 'my-model' } };
  const label = buildAgentChoiceLabel(name, cfg, {}, {}, null);
  assert.ok(label.includes('my-model'), 'label should contain CLAUDE_DEFAULT_MODEL fallback');
});

test('buildAgentChoiceLabel: shows ? when no model info available', () => {
  const name = 'no-model-agent';
  const cfg = { env: {} };
  const label = buildAgentChoiceLabel(name, cfg, {}, {}, null);
  assert.ok(label.includes('?'), 'label should contain ? when no model info');
});

test('buildAgentChoiceLabel: name is padded to 14 chars', () => {
  const name = 'x';
  const cfg = { env: {} };
  const label = buildAgentChoiceLabel(name, cfg, {}, {}, null);
  // The label format is: ${name.padEnd(14)} ${model...} ${keyStatus}
  // So the first 14 chars should be 'x' followed by 13 spaces
  const namePart = label.slice(0, 14);
  assert.strictEqual(namePart, 'x'.padEnd(14), 'name part should be padded to 14 chars');
});

// ---------------------------------------------------------------------------
// applyKeyUpdate
// ---------------------------------------------------------------------------

test('applyKeyUpdate: no apiKey in updates -> newEnv returned unchanged', () => {
  const newEnv = { FOO: 'bar', ANTHROPIC_API_KEY: 'existing' };
  const result = applyKeyUpdate({}, 'ACCOUNT', newEnv, null);
  assert.strictEqual(result, newEnv);
  assert.strictEqual(result.FOO, 'bar');
  assert.strictEqual(result.ANTHROPIC_API_KEY, 'existing');
});

test('applyKeyUpdate: __REMOVE__ with null secretsLib -> deletes ANTHROPIC_API_KEY from newEnv', () => {
  const newEnv = { ANTHROPIC_API_KEY: 'old-key', OTHER: 'val' };
  const result = applyKeyUpdate({ apiKey: '__REMOVE__' }, 'ACCOUNT', newEnv, null);
  assert.strictEqual(result.ANTHROPIC_API_KEY, undefined, 'ANTHROPIC_API_KEY should be deleted');
  assert.strictEqual(result.OTHER, 'val');
});

test('applyKeyUpdate: __REMOVE__ with mock secretsLib -> calls delete with correct args', () => {
  const calls = [];
  const mockLib = {
    set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
    delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
  };
  const newEnv = { ANTHROPIC_API_KEY: 'old-key' };
  applyKeyUpdate({ apiKey: '__REMOVE__' }, 'ACCOUNT', newEnv, mockLib);
  assert.ok(calls.some(([op, s, k]) => op === 'del' && s === 'qgsd' && k === 'ACCOUNT'),
    'delete should be called with qgsd and ACCOUNT');
});

test('applyKeyUpdate: real key with mock secretsLib -> set called, ANTHROPIC_API_KEY absent from newEnv', () => {
  const calls = [];
  const mockLib = {
    set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
    delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
  };
  const newEnv = {};
  const result = applyKeyUpdate({ apiKey: 'sk-real-key' }, 'ACCOUNT', newEnv, mockLib);
  assert.strictEqual(result.ANTHROPIC_API_KEY, undefined, 'ANTHROPIC_API_KEY must be absent when secretsLib present');
  assert.ok(calls.some(([op, s, k, v]) => op === 'set' && s === 'qgsd' && k === 'ACCOUNT' && v === 'sk-real-key'),
    'set should be called with correct args');
});

test('applyKeyUpdate: real key with null secretsLib -> sets ANTHROPIC_API_KEY as plaintext fallback', () => {
  const newEnv = {};
  const result = applyKeyUpdate({ apiKey: 'sk-real-key' }, 'ACCOUNT', newEnv, null);
  assert.strictEqual(result.ANTHROPIC_API_KEY, 'sk-real-key', 'should use plaintext fallback when no secretsLib');
});

// ---------------------------------------------------------------------------
// applyCcrProviderUpdate
// ---------------------------------------------------------------------------

test('applyCcrProviderUpdate: set AKASHML_API_KEY -> returns set result and calls set', async () => {
  const calls = [];
  const mockLib = {
    set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
    delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
  };
  const result = await applyCcrProviderUpdate('set', 'AKASHML_API_KEY', 'abc123', mockLib);
  assert.deepStrictEqual(result, { action: 'set', key: 'AKASHML_API_KEY' });
  assert.ok(calls.some(([op, s, k, v]) => op === 'set' && s === 'qgsd' && k === 'AKASHML_API_KEY' && v === 'abc123'),
    'set should be called with correct args');
});

test('applyCcrProviderUpdate: remove TOGETHER_API_KEY -> returns remove result and calls delete', async () => {
  const calls = [];
  const mockLib = {
    set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
    delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
  };
  const result = await applyCcrProviderUpdate('remove', 'TOGETHER_API_KEY', '', mockLib);
  assert.deepStrictEqual(result, { action: 'remove', key: 'TOGETHER_API_KEY' });
  assert.ok(calls.some(([op, s, k]) => op === 'del' && s === 'qgsd' && k === 'TOGETHER_API_KEY'),
    'delete should be called with correct key');
});

test('applyCcrProviderUpdate: set FIREWORKS_API_KEY -> set called with correct key name', async () => {
  const calls = [];
  const mockLib = {
    set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
    delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
  };
  const result = await applyCcrProviderUpdate('set', 'FIREWORKS_API_KEY', 'fw-key-xyz', mockLib);
  assert.deepStrictEqual(result, { action: 'set', key: 'FIREWORKS_API_KEY' });
  assert.ok(calls.some(([op, s, k, v]) => op === 'set' && k === 'FIREWORKS_API_KEY' && v === 'fw-key-xyz'),
    'set should be called with FIREWORKS_API_KEY');
});

test('applyCcrProviderUpdate: unknown subAction -> returns null, no secretsLib calls', async () => {
  const calls = [];
  const mockLib = {
    set: (s, k, v) => { calls.push(['set', s, k, v]); return Promise.resolve(); },
    delete: (s, k) => { calls.push(['del', s, k]); return Promise.resolve(); },
  };
  const result = await applyCcrProviderUpdate('unknown', 'SOME_KEY', 'val', mockLib);
  assert.strictEqual(result, null);
  assert.strictEqual(calls.length, 0, 'no secretsLib calls should be made for unknown action');
});
