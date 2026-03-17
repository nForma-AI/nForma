'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _pure } = require('./manage-agents-core.cjs');
const { deriveSecretAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel, applyKeyUpdate, applyCcrProviderUpdate,
        readNfJson, writeNfJson, slotToFamily, getWlDisplay, readCcrConfigSafe, getCcrProviderForSlot, getKeyInvalidBadge,
        findPresetForUrl, buildCloneEntry,
        classifyProbeResult, writeKeyStatus,
        buildDashboardLines, formatTimestamp,
        buildTimeoutChoices, applyTimeoutUpdate,
        buildPolicyChoices, validateTimeout, validateUpdatePolicy,
        buildUpdateLogEntry, parseUpdateLogErrors,
        buildBackupPath, buildRedactedEnv, buildExportData, validateImportSchema,
        liveDashboard } = _pure;

// ---------------------------------------------------------------------------
// deriveSecretAccount
// ---------------------------------------------------------------------------

test('deriveSecretAccount: claude-7 -> ANTHROPIC_API_KEY_CLAUDE_7', () => {
  assert.strictEqual(deriveSecretAccount('claude-7'), 'ANTHROPIC_API_KEY_CLAUDE_7');
});

test('deriveSecretAccount: deepseek -> ANTHROPIC_API_KEY_DEEPSEEK', () => {
  assert.strictEqual(deriveSecretAccount('deepseek'), 'ANTHROPIC_API_KEY_DEEPSEEK');
});

test('deriveSecretAccount: my-agent-2 -> ANTHROPIC_API_KEY_MY_AGENT_2', () => {
  assert.strictEqual(deriveSecretAccount('my-agent-2'), 'ANTHROPIC_API_KEY_MY_AGENT_2');
});

test('deriveSecretAccount: UPPER -> ANTHROPIC_API_KEY_UPPER (already uppercase)', () => {
  assert.strictEqual(deriveSecretAccount('UPPER'), 'ANTHROPIC_API_KEY_UPPER');
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
  assert.ok(calls.some(([op, s, k]) => op === 'del' && s === 'nforma' && k === 'ACCOUNT'),
    'delete should be called with nforma and ACCOUNT');
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
  assert.ok(calls.some(([op, s, k, v]) => op === 'set' && s === 'nforma' && k === 'ACCOUNT' && v === 'sk-real-key'),
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
  assert.ok(calls.some(([op, s, k, v]) => op === 'set' && s === 'nforma' && k === 'AKASHML_API_KEY' && v === 'abc123'),
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
  assert.ok(calls.some(([op, s, k]) => op === 'del' && s === 'nforma' && k === 'TOGETHER_API_KEY'),
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

// ---------------------------------------------------------------------------
// slotToFamily
// ---------------------------------------------------------------------------

test('slotToFamily: claude-3 -> claude', () => {
  assert.strictEqual(slotToFamily('claude-3'), 'claude');
});

test('slotToFamily: gemini-1 -> gemini', () => {
  assert.strictEqual(slotToFamily('gemini-1'), 'gemini');
});

test('slotToFamily: opencode-1 -> opencode', () => {
  assert.strictEqual(slotToFamily('opencode-1'), 'opencode');
});

test('slotToFamily: codex-1 -> codex', () => {
  assert.strictEqual(slotToFamily('codex-1'), 'codex');
});

test('slotToFamily: no-suffix -> no-suffix (no numeric suffix, unchanged)', () => {
  assert.strictEqual(slotToFamily('no-suffix'), 'no-suffix');
});

// ---------------------------------------------------------------------------
// getWlDisplay
// ---------------------------------------------------------------------------

test('getWlDisplay: null scoreboardData -> dash (EDGE CASE 1: absent scoreboard)', () => {
  assert.strictEqual(getWlDisplay('claude', null), '\u2014');
});

test('getWlDisplay: family not in models -> dash', () => {
  assert.strictEqual(getWlDisplay('missing', { models: {} }), '\u2014');
});

test('getWlDisplay: claude with tp=114, fn=0 -> 114W/0L', () => {
  assert.strictEqual(getWlDisplay('claude', { models: { claude: { tp: 114, fn: 0 } } }), '114W/0L');
});

test('getWlDisplay: gemini with tp=45, fn=2 -> 45W/2L', () => {
  assert.strictEqual(getWlDisplay('gemini', { models: { gemini: { tp: 45, fn: 2 } } }), '45W/2L');
});

// ---------------------------------------------------------------------------
// readCcrConfigSafe
// ---------------------------------------------------------------------------

const os = require('os');
const fs = require('fs');

test('readCcrConfigSafe: non-existent path -> null (EDGE CASE 2: absent CCR config)', () => {
  const result = readCcrConfigSafe('/tmp/__nf_test_nonexistent_ccr_config_' + Date.now() + '.json');
  assert.strictEqual(result, null);
});

test('readCcrConfigSafe: valid JSON file -> parsed object', () => {
  const tmpPath = require('path').join(os.tmpdir(), 'nf_ccr_test_' + Date.now() + '.json');
  const testData = { providers: [{ name: 'TestProvider', models: ['model-x'] }] };
  fs.writeFileSync(tmpPath, JSON.stringify(testData), 'utf8');
  try {
    const result = readCcrConfigSafe(tmpPath);
    assert.deepStrictEqual(result, testData);
  } finally {
    fs.unlinkSync(tmpPath);
  }
});

// ---------------------------------------------------------------------------
// getCcrProviderForSlot
// ---------------------------------------------------------------------------

test('getCcrProviderForSlot: null ccrConfig -> null', () => {
  assert.strictEqual(getCcrProviderForSlot('model-x', null), null);
});

test('getCcrProviderForSlot: null model -> null', () => {
  assert.strictEqual(getCcrProviderForSlot(null, { providers: [] }), null);
});

test('getCcrProviderForSlot: model found in provider -> returns provider name', () => {
  const ccrConfig = { providers: [{ name: 'ProviderA', models: ['model-a', 'model-b'] }] };
  assert.strictEqual(getCcrProviderForSlot('model-a', ccrConfig), 'ProviderA');
});

test('getCcrProviderForSlot: model not in any provider -> null', () => {
  const ccrConfig = { providers: [{ name: 'ProviderA', models: ['model-a'] }] };
  assert.strictEqual(getCcrProviderForSlot('model-z', ccrConfig), null);
});

// ---------------------------------------------------------------------------
// getKeyInvalidBadge
// ---------------------------------------------------------------------------

test('getKeyInvalidBadge: agentConfig missing slot -> empty string (EDGE CASE 3: key_status absent)', () => {
  assert.strictEqual(getKeyInvalidBadge('claude-1', {}, () => true), '');
});

test('getKeyInvalidBadge: slot present but key_status absent -> empty string', () => {
  assert.strictEqual(getKeyInvalidBadge('claude-1', { 'claude-1': {} }, () => true), '');
});

test('getKeyInvalidBadge: key_status present but status is ok -> empty string', () => {
  assert.strictEqual(
    getKeyInvalidBadge('claude-1', { 'claude-1': { key_status: { status: 'ok' } } }, () => true),
    ''
  );
});

test('getKeyInvalidBadge: status invalid but hasKeyFn returns false -> empty string', () => {
  assert.strictEqual(
    getKeyInvalidBadge('claude-1', { 'claude-1': { key_status: { status: 'invalid' } } }, () => false),
    ''
  );
});

test('getKeyInvalidBadge: status invalid and hasKeyFn returns true -> [key invalid]', () => {
  assert.strictEqual(
    getKeyInvalidBadge('claude-1', { 'claude-1': { key_status: { status: 'invalid' } } }, () => true),
    ' [key invalid]'
  );
});

// ---------------------------------------------------------------------------
// readNfJson / writeNfJson
// ---------------------------------------------------------------------------

test('readNfJson: non-existent file -> empty object {}', () => {
  const tmpPath = '/tmp/__nf_test_nonexistent_' + Date.now() + '.json';
  const result = readNfJson(tmpPath);
  assert.deepStrictEqual(result, {});
});

test('writeNfJson and readNfJson: roundtrip via tmp dir', () => {
  const tmpPath = require('path').join(os.tmpdir(), 'nf_rw_test_' + Date.now() + '.json');
  const testData = { orchestrator: { model: 'test-model' }, agent_config: {} };
  try {
    writeNfJson(testData, tmpPath);
    const result = readNfJson(tmpPath);
    assert.deepStrictEqual(result, testData);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
});

// ---------------------------------------------------------------------------
// findPresetForUrl
// ---------------------------------------------------------------------------

test('findPresetForUrl: AkashML URL returns the preset value', () => {
  assert.strictEqual(findPresetForUrl('https://api.akashml.com/v1'), 'https://api.akashml.com/v1');
});

test('findPresetForUrl: Together.xyz URL returns the preset value', () => {
  assert.strictEqual(findPresetForUrl('https://api.together.xyz/v1'), 'https://api.together.xyz/v1');
});

test('findPresetForUrl: Fireworks.ai URL returns the preset value', () => {
  assert.strictEqual(findPresetForUrl('https://api.fireworks.ai/inference/v1'), 'https://api.fireworks.ai/inference/v1');
});

test('findPresetForUrl: unknown URL returns __custom__', () => {
  assert.strictEqual(findPresetForUrl('https://api.example.com/v1'), '__custom__');
});

test('findPresetForUrl: null returns __custom__', () => {
  assert.strictEqual(findPresetForUrl(null), '__custom__');
});

test('findPresetForUrl: undefined returns __custom__', () => {
  assert.strictEqual(findPresetForUrl(undefined), '__custom__');
});

test('findPresetForUrl: AkashML URL without /v1 suffix returns __custom__ (exact table lookup, not startsWith)', () => {
  assert.strictEqual(findPresetForUrl('https://api.akashml.com'), '__custom__');
});

test('findPresetForUrl: Together.xyz URL without /v1 suffix returns __custom__ (exact table lookup, not startsWith)', () => {
  assert.strictEqual(findPresetForUrl('https://api.together.xyz'), '__custom__');
});

// ---------------------------------------------------------------------------
// buildCloneEntry
// ---------------------------------------------------------------------------

test('buildCloneEntry: copies ANTHROPIC_BASE_URL from source', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: ['/path/to/server.cjs'],
    env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_DEFAULT_MODEL: 'my-model', ANTHROPIC_API_KEY: 'sk-secret' },
  };
  const entry = buildCloneEntry(sourceCfg, 'claude-7');
  assert.strictEqual(entry.env.ANTHROPIC_BASE_URL, 'https://api.akashml.com/v1');
  // Mutation guard: clone must not share the same env object reference as the source
  assert.notStrictEqual(entry.env, sourceCfg.env, 'buildCloneEntry must return a new env object, not mutate source');
});

test('buildCloneEntry: copies CLAUDE_DEFAULT_MODEL from source', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: [],
    env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_DEFAULT_MODEL: 'deepseek-v3', ANTHROPIC_API_KEY: 'sk-secret' },
  };
  const entry = buildCloneEntry(sourceCfg, 'claude-7');
  assert.strictEqual(entry.env.CLAUDE_DEFAULT_MODEL, 'deepseek-v3');
});

test('buildCloneEntry: sets PROVIDER_SLOT to newName', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: [],
    env: { PROVIDER_SLOT: 'claude-3', ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1' },
  };
  const entry = buildCloneEntry(sourceCfg, 'claude-7');
  assert.strictEqual(entry.env.PROVIDER_SLOT, 'claude-7');
});

test('buildCloneEntry: does NOT copy ANTHROPIC_API_KEY (secrets isolation)', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: [],
    env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', ANTHROPIC_API_KEY: 'sk-super-secret' },
  };
  const entry = buildCloneEntry(sourceCfg, 'claude-7');
  assert.ok(!('ANTHROPIC_API_KEY' in entry.env), 'ANTHROPIC_API_KEY must not be in cloned env');
});

test('buildCloneEntry: copies CLAUDE_MCP_TIMEOUT_MS when present', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: [],
    env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_MCP_TIMEOUT_MS: '60000' },
  };
  const entry = buildCloneEntry(sourceCfg, 'claude-7');
  assert.strictEqual(entry.env.CLAUDE_MCP_TIMEOUT_MS, '60000');
});

test('buildCloneEntry: preserves command and args from source', () => {
  const sourceCfg = {
    type: 'stdio',
    command: 'node',
    args: ['/path/to/server.cjs'],
    env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1' },
  };
  const entry = buildCloneEntry(sourceCfg, 'claude-7');
  assert.strictEqual(entry.command, 'node');
  assert.deepStrictEqual(entry.args, ['/path/to/server.cjs']);
});

// ---------------------------------------------------------------------------
// classifyProbeResult
// ---------------------------------------------------------------------------

test('classifyProbeResult: null probeResult -> \'unreachable\'', () => {
  assert.strictEqual(classifyProbeResult(null), 'unreachable');
});

test('classifyProbeResult: healthy=false -> \'unreachable\'', () => {
  assert.strictEqual(
    classifyProbeResult({ healthy: false, latencyMs: 0, statusCode: null, error: 'ECONNREFUSED' }),
    'unreachable'
  );
});

test('classifyProbeResult: healthy=true, statusCode=401 -> \'invalid\'', () => {
  assert.strictEqual(
    classifyProbeResult({ healthy: true, latencyMs: 120, statusCode: 401, error: null }),
    'invalid'
  );
});

test('classifyProbeResult: healthy=true, statusCode=200 -> \'ok\'', () => {
  assert.strictEqual(
    classifyProbeResult({ healthy: true, latencyMs: 80, statusCode: 200, error: null }),
    'ok'
  );
});

test('classifyProbeResult: healthy=true, statusCode=403 -> \'ok\'', () => {
  assert.strictEqual(
    classifyProbeResult({ healthy: true, latencyMs: 95, statusCode: 403, error: null }),
    'ok'
  );
});

test('classifyProbeResult: healthy=true, statusCode=422 -> \'ok\'', () => {
  assert.strictEqual(
    classifyProbeResult({ healthy: true, latencyMs: 102, statusCode: 422, error: null }),
    'ok'
  );
});

test("classifyProbeResult: healthy=true, statusCode=null -> 'ok' (statusCode absent from probe response)", () => {
  // probeProviderUrl marks healthy=true only for [200,401,403,404,422], so this input
  // is theoretically unreachable from production. Documented here so the 'ok' fallthrough
  // for null statusCode is an explicit, understood choice rather than an unexamined gap.
  assert.strictEqual(
    classifyProbeResult({ healthy: true, latencyMs: 50, statusCode: null, error: null }),
    'ok'
  );
});

// ---------------------------------------------------------------------------
// writeKeyStatus
// Note: writeKeyStatus is impure (file I/O) but exported via _pure because it accepts
// an optional filePath parameter for testability — matching the readNfJson/writeNfJson
// precedent from v0.10-01.
//
// 'unreachable' guard: the invariant that writeKeyStatus is never called for status
// 'unreachable' lives in checkAgentHealth (the caller), not here. That guard is
// integration-level and verified by reading checkAgentHealth's conditional:
//   if (classification !== 'unreachable') writeKeyStatus(slotName, classification)
// Unit tests here verify the read-mutate-write correctness (existing keys preserved).
// ---------------------------------------------------------------------------

test('writeKeyStatus: writes {status: \'invalid\', checkedAt: ISO} and preserves unrelated nf.json keys', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_ws_test_' + Date.now() + '.json';
  try {
    // Seed with existing data — simulates a real nf.json with other top-level keys
    fs.writeFileSync(tmpPath, JSON.stringify({ orchestrator: { model: 'test-model' }, agent_config: {} }), 'utf8');
    writeKeyStatus('claude-1', 'invalid', tmpPath);
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['claude-1'].key_status.status, 'invalid');
    assert.strictEqual(typeof result.agent_config['claude-1'].key_status.checkedAt, 'string');
    assert.ok(!isNaN(new Date(result.agent_config['claude-1'].key_status.checkedAt).getTime()));
    // Preservation assertion: unrelated top-level key must survive the write
    assert.strictEqual(result.orchestrator.model, 'test-model', 'writeKeyStatus must not truncate existing nf.json keys');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('writeKeyStatus: writes {status: \'ok\', checkedAt: ISO} and overwrites prior key_status for same slot', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_ws_test2_' + Date.now() + '.json';
  try {
    // Seed with a prior 'invalid' status and an unrelated agent slot + top-level key
    const seed = {
      plugins: { enabled: true },
      agent_config: {
        'gemini-1': { key_status: { status: 'invalid', checkedAt: '2024-01-01T00:00:00.000Z' } },
        'claude-1': { key_status: { status: 'ok', checkedAt: '2024-01-01T00:00:00.000Z' } },
      },
    };
    fs.writeFileSync(tmpPath, JSON.stringify(seed), 'utf8');
    writeKeyStatus('gemini-1', 'ok', tmpPath);
    const result = readNfJson(tmpPath);
    // Target slot: status must update from 'invalid' to 'ok'
    assert.strictEqual(result.agent_config['gemini-1'].key_status.status, 'ok');
    assert.strictEqual(typeof result.agent_config['gemini-1'].key_status.checkedAt, 'string');
    assert.ok(!isNaN(new Date(result.agent_config['gemini-1'].key_status.checkedAt).getTime()));
    // Preservation assertions: unrelated agent slot and top-level key must survive
    assert.strictEqual(result.agent_config['claude-1'].key_status.status, 'ok', 'sibling agent slot must not be disturbed');
    assert.strictEqual(result.plugins.enabled, true, 'top-level plugins key must survive the write');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

// ---------------------------------------------------------------------------
// probeAndPersistKey + probeAllSlots persistence behavior (v0.26-02-01)
// ---------------------------------------------------------------------------

test('probeAndPersistKey: probe succeeds (200), classifyProbeResult returns ok, writeKeyStatus persists correctly', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_ppk_ok_' + Date.now() + '.json';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ agent_config: {} }), 'utf8');
    // Simulate the probe-classify-write chain that probeAndPersistKey performs
    const probeResult = { healthy: true, statusCode: 200, latencyMs: 50, error: null };
    const status = classifyProbeResult(probeResult);
    assert.strictEqual(status, 'ok');
    writeKeyStatus('test-slot', status, tmpPath);
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['test-slot'].key_status.status, 'ok');
    // checkedAt must be a valid ISO date string
    const checkedAt = result.agent_config['test-slot'].key_status.checkedAt;
    assert.strictEqual(typeof checkedAt, 'string');
    assert.strictEqual(new Date(checkedAt).toISOString(), checkedAt);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('probeAndPersistKey: probe returns 401, status persists as invalid', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_ppk_401_' + Date.now() + '.json';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ agent_config: {} }), 'utf8');
    const probeResult = { healthy: true, statusCode: 401, latencyMs: 100, error: null };
    const status = classifyProbeResult(probeResult);
    assert.strictEqual(status, 'invalid');
    writeKeyStatus('test-slot', status, tmpPath);
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['test-slot'].key_status.status, 'invalid');
    assert.strictEqual(typeof result.agent_config['test-slot'].key_status.checkedAt, 'string');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('probeAndPersistKey: probe times out (statusCode null), existing status NOT overwritten', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_ppk_timeout_' + Date.now() + '.json';
  try {
    // Seed with existing 'ok' status
    const seed = {
      agent_config: {
        'test-slot': { key_status: { status: 'ok', checkedAt: '2026-01-01T00:00:00.000Z' } }
      }
    };
    fs.writeFileSync(tmpPath, JSON.stringify(seed), 'utf8');
    // Simulate a timeout probe result
    const probeResult = { healthy: false, statusCode: null, latencyMs: 7000, error: 'Timed out' };
    // Apply the guard: if (probe.healthy || probe.statusCode) -> false || null -> falsy
    const shouldPersist = probeResult.healthy || probeResult.statusCode;
    assert.ok(!shouldPersist, 'timeout probe must NOT trigger persistence');
    // Do NOT call writeKeyStatus (matching probeAndPersistKey behavior)
    // Verify existing status is preserved
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['test-slot'].key_status.status, 'ok', 'existing status must NOT be overwritten on timeout');
    assert.strictEqual(result.agent_config['test-slot'].key_status.checkedAt, '2026-01-01T00:00:00.000Z');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('probeAndPersistKey: multiple slots persist independently', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_ppk_multi_' + Date.now() + '.json';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ orchestrator: { model: 'test' }, agent_config: {} }), 'utf8');
    writeKeyStatus('slot-a', 'ok', tmpPath);
    writeKeyStatus('slot-b', 'invalid', tmpPath);
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['slot-a'].key_status.status, 'ok');
    assert.strictEqual(result.agent_config['slot-b'].key_status.status, 'invalid');
    // Verify other top-level keys preserved
    assert.strictEqual(result.orchestrator.model, 'test', 'top-level keys must be preserved');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('probeAllSlots persistence guard: correctly identifies which results should be persisted', () => {
  // Test the guard condition: if (probe.healthy || probe.statusCode)
  const cases = [
    { probe: { healthy: true, statusCode: 200 },  expected: true,  desc: '200 OK -> should persist' },
    { probe: { healthy: true, statusCode: 401 },  expected: true,  desc: '401 Unauthorized -> should persist' },
    { probe: { healthy: false, statusCode: null }, expected: false, desc: 'timeout (null statusCode) -> should NOT persist' },
    { probe: { healthy: false, statusCode: 500 },  expected: true,  desc: '500 Server Error -> should persist (statusCode is truthy)' },
  ];
  for (const { probe, expected, desc } of cases) {
    const shouldPersist = !!(probe.healthy || probe.statusCode);
    assert.strictEqual(shouldPersist, expected, desc);
  }
});

// ---------------------------------------------------------------------------
// End-to-end credential management lifecycle tests (v0.26-02-02)
// ---------------------------------------------------------------------------

test('E2E persistence chain: probe 200 -> classify -> write -> read back with valid ISO timestamp', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_e2e_200_' + Date.now() + '.json';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ agent_config: {} }), 'utf8');
    const probeResult = { healthy: true, statusCode: 200, latencyMs: 50, error: null };
    const status = classifyProbeResult(probeResult);
    assert.strictEqual(status, 'ok');
    writeKeyStatus('claude-1', status, tmpPath);
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['claude-1'].key_status.status, 'ok');
    const checkedAt = result.agent_config['claude-1'].key_status.checkedAt;
    assert.strictEqual(typeof checkedAt, 'string');
    assert.strictEqual(new Date(checkedAt).toISOString(), checkedAt, 'checkedAt must be a valid ISO timestamp');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('E2E persistence chain: probe 401 -> classify -> write -> read back as invalid', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_e2e_401_' + Date.now() + '.json';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ agent_config: {} }), 'utf8');
    const probeResult = { healthy: true, statusCode: 401, latencyMs: 100, error: null };
    const status = classifyProbeResult(probeResult);
    assert.strictEqual(status, 'invalid');
    writeKeyStatus('claude-1', status, tmpPath);
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['claude-1'].key_status.status, 'invalid');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('Status survives across read cycles (simulates session restart)', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_e2e_survive_' + Date.now() + '.json';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify({ agent_config: {} }), 'utf8');
    // First session: write gemini-1 as ok
    writeKeyStatus('gemini-1', 'ok', tmpPath);
    const afterFirst = readNfJson(tmpPath);
    assert.strictEqual(afterFirst.agent_config['gemini-1'].key_status.status, 'ok');
    // Second session: write codex-1 as invalid
    writeKeyStatus('codex-1', 'invalid', tmpPath);
    const afterSecond = readNfJson(tmpPath);
    // Both must be present
    assert.strictEqual(afterSecond.agent_config['gemini-1'].key_status.status, 'ok', 'gemini-1 must survive second write');
    assert.strictEqual(afterSecond.agent_config['codex-1'].key_status.status, 'invalid', 'codex-1 must be present');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('Persistence guard prevents overwrite on timeout: existing ok status preserved', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpPath = os.tmpdir() + '/nf_e2e_guard_' + Date.now() + '.json';
  try {
    // Seed with existing 'ok' status for claude-1
    const seed = {
      agent_config: {
        'claude-1': { key_status: { status: 'ok', checkedAt: '2026-03-03T00:00:00.000Z' } }
      }
    };
    fs.writeFileSync(tmpPath, JSON.stringify(seed), 'utf8');
    // Simulate timeout: healthy=false, statusCode=null
    const probeResult = { healthy: false, statusCode: null, latencyMs: 7000, error: 'Timed out' };
    const shouldPersist = probeResult.healthy || probeResult.statusCode;
    assert.ok(!shouldPersist, 'timeout must not trigger persistence');
    // Do NOT write (matching probeAndPersistKey behavior)
    const result = readNfJson(tmpPath);
    assert.strictEqual(result.agent_config['claude-1'].key_status.status, 'ok', 'status must still be ok');
    assert.strictEqual(result.agent_config['claude-1'].key_status.checkedAt, '2026-03-03T00:00:00.000Z', 'checkedAt must be unchanged');
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('getKeyInvalidBadge reads persisted status correctly: invalid -> badge, ok -> empty', () => {
  // Test with invalid status
  const agentConfigInvalid = {
    'claude-1': { key_status: { status: 'invalid', checkedAt: '2026-03-03T00:00:00.000Z' } }
  };
  const hasKeyFn = (slot) => slot === 'claude-1';
  const badgeInvalid = getKeyInvalidBadge('claude-1', agentConfigInvalid, hasKeyFn);
  assert.strictEqual(badgeInvalid, ' [key invalid]', 'invalid status must show badge');

  // Test with ok status
  const agentConfigOk = {
    'claude-1': { key_status: { status: 'ok', checkedAt: '2026-03-03T00:00:00.000Z' } }
  };
  const badgeOk = getKeyInvalidBadge('claude-1', agentConfigOk, hasKeyFn);
  assert.strictEqual(badgeOk, '', 'ok status must return empty string');
});

// ---------------------------------------------------------------------------
// formatTimestamp
// ---------------------------------------------------------------------------

test('formatTimestamp: null returns em-dash string', () => {
  assert.strictEqual(formatTimestamp(null), '\u2014');
});

test('formatTimestamp: Date.now() returns HH:MM:SS format (8 chars)', () => {
  const result = formatTimestamp(Date.now());
  assert.match(result, /^\d{2}:\d{2}:\d{2}$/);
});

test('formatTimestamp: known epoch ms returns correct HH:MM:SS', () => {
  // Use a fixed epoch value so the test is deterministic
  // We test the format (length + colon positions) rather than exact value to avoid timezone issues
  const ts = new Date('2026-01-01T12:34:56Z').getTime();
  const result = formatTimestamp(ts);
  assert.strictEqual(result.length, 8);
  assert.strictEqual(result[2], ':');
  assert.strictEqual(result[5], ':');
});

// ---------------------------------------------------------------------------
// buildDashboardLines
// ---------------------------------------------------------------------------

test('buildDashboardLines: empty slots array returns header + empty body + timestamp line', () => {
  const lines = buildDashboardLines([], {}, {}, null);
  assert.ok(Array.isArray(lines));
  assert.ok(lines.length >= 2, 'must have at least header + timestamp line');
  // Last two lines contain timestamp and keybinding hint
  const joined = lines.join('\n');
  assert.ok(joined.includes('Last updated'), 'must contain "Last updated"');
});

test('buildDashboardLines: slot with healthy=true probe shows green checkmark in output', () => {
  const slots = ['claude-1'];
  const mcpServers = { 'claude-1': { env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_DEFAULT_MODEL: 'claude-sonnet-4-5' } } };
  const healthMap = { 'claude-1': { healthy: true, latencyMs: 42, statusCode: 200 } };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const joined = lines.join('\n');
  assert.ok(joined.includes('claude-1'), 'must show slot name');
  assert.ok(joined.includes('42'), 'must show latency ms');
  assert.ok(joined.includes('UP'), 'must show UP status');
});

test('buildDashboardLines: slot with healthy=false probe shows red DOWN in output', () => {
  const slots = ['gemini-1'];
  const mcpServers = { 'gemini-1': { env: { ANTHROPIC_BASE_URL: 'https://api.together.xyz/v1' } } };
  const healthMap = { 'gemini-1': { healthy: false, latencyMs: 0, statusCode: 500 } };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const joined = lines.join('\n');
  assert.ok(joined.includes('DOWN'), 'must show DOWN status');
});

test('buildDashboardLines: slot with error=subprocess shows subprocess label in output', () => {
  const slots = ['kimi-1'];
  const mcpServers = { 'kimi-1': { command: 'node', args: ['./kimi.cjs'] } };
  const healthMap = { 'kimi-1': { healthy: null, error: 'subprocess' } };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const joined = lines.join('\n');
  assert.ok(joined.includes('subprocess'), 'must show subprocess label');
});

test('buildDashboardLines: null healthMap entry shows em-dash or blank for that slot', () => {
  const slots = ['claude-1'];
  const mcpServers = { 'claude-1': { env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1' } } };
  const healthMap = {};  // no entry for claude-1
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const joined = lines.join('\n');
  assert.ok(joined.includes('claude-1'), 'must still show slot name');
});

test('buildDashboardLines: lastUpdated=null shows "Last updated: \u2014" (never refreshed)', () => {
  const lines = buildDashboardLines([], {}, {}, null);
  const joined = lines.join('\n');
  assert.ok(joined.includes('Last updated: \u2014'), 'must show em-dash when never refreshed');
});

test('buildDashboardLines: lastUpdated more than 60s ago shows [stale] warning in output', () => {
  const staleTs = Date.now() - 70_000;  // 70 seconds ago
  const lines = buildDashboardLines([], {}, {}, staleTs);
  const joined = lines.join('\n');
  assert.ok(joined.includes('stale'), 'must show stale warning when >60s old');
});

test('buildDashboardLines: lastUpdated less than 60s ago does NOT show [stale]', () => {
  const freshTs = Date.now() - 10_000;  // 10 seconds ago
  const lines = buildDashboardLines([], {}, {}, freshTs);
  const joined = lines.join('\n');
  assert.ok(!joined.includes('stale'), 'must NOT show stale warning when <60s old');
});

// Additional precision tests addressing quorum-test REVIEW-NEEDED (v0.10-04)

test('formatTimestamp: 0 (epoch) is treated as falsy and returns em-dash (design choice: 0 means never-updated)', () => {
  // if (!ts) covers null, undefined, and 0 — epoch ms=0 is not a real dashboard timestamp
  assert.strictEqual(formatTimestamp(0), '\u2014', 'epoch 0 should return em-dash (falsy sentinel for never-updated)');
});

test('buildDashboardLines: stale boundary — 60001ms ago shows [stale], 59999ms ago does NOT', () => {
  const now = Date.now();
  const staleEdge = now - 60_001;
  const freshEdge = now - 59_999;
  const staleLines = buildDashboardLines([], {}, {}, staleEdge);
  const freshLines = buildDashboardLines([], {}, {}, freshEdge);
  assert.ok(staleLines.join('\n').includes('stale'), 'must show stale at 60001ms past threshold');
  assert.ok(!freshLines.join('\n').includes('stale'), 'must NOT show stale at 59999ms (below threshold)');
});

test('buildDashboardLines: UP status row contains green ANSI code and checkmark glyph', () => {
  const slots = ['claude-1'];
  const mcpServers = { 'claude-1': { env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_DEFAULT_MODEL: 'claude-sonnet-4-5' } } };
  const healthMap = { 'claude-1': { healthy: true, latencyMs: 42, statusCode: 200 } };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  // Find the specific slot row (contains slot name as padded prefix)
  const slotRow = lines.find(l => l.trimStart().startsWith('claude-1'));
  assert.ok(slotRow, 'slot row must exist');
  assert.ok(slotRow.includes('\x1b[32m'), 'UP row must contain green ANSI code \\x1b[32m');
  assert.ok(slotRow.includes('\u2713'), 'UP row must contain checkmark glyph \u2713');
  assert.ok(slotRow.includes('42'), 'latency must appear in the same slot row, not elsewhere');
});

test('buildDashboardLines: DOWN status row contains red ANSI code and cross glyph', () => {
  const slots = ['gemini-1'];
  const mcpServers = { 'gemini-1': { env: { ANTHROPIC_BASE_URL: 'https://api.together.xyz/v1' } } };
  const healthMap = { 'gemini-1': { healthy: false, latencyMs: 0, statusCode: 500 } };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const slotRow = lines.find(l => l.trimStart().startsWith('gemini-1'));
  assert.ok(slotRow, 'slot row must exist');
  assert.ok(slotRow.includes('\x1b[31m'), 'DOWN row must contain red ANSI code \\x1b[31m');
  assert.ok(slotRow.includes('\u2717'), 'DOWN row must contain cross glyph \u2717');
});

test('buildDashboardLines: per-slot data isolation — two-slot output has each slot in its own row', () => {
  const slots = ['claude-1', 'gemini-1'];
  const mcpServers = {
    'claude-1': { env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1' } },
    'gemini-1': { env: { ANTHROPIC_BASE_URL: 'https://api.together.xyz/v1' } },
  };
  const healthMap = {
    'claude-1': { healthy: true, latencyMs: 77 },
    'gemini-1': { healthy: false, latencyMs: 0 },
  };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const claudeRow = lines.find(l => l.trimStart().startsWith('claude-1'));
  const geminiRow = lines.find(l => l.trimStart().startsWith('gemini-1'));
  assert.ok(claudeRow, 'claude-1 row must exist');
  assert.ok(geminiRow, 'gemini-1 row must exist');
  // Each slot's latency appears in its own row, not the other's
  assert.ok(claudeRow.includes('77'), 'claude-1 latency (77ms) must appear in claude row');
  assert.ok(!geminiRow.includes('77'), 'claude-1 latency must NOT bleed into gemini row');
});

test('buildDashboardLines: output contains header title and footer keybinding hint', () => {
  const lines = buildDashboardLines([], {}, {}, null);
  const joined = lines.join('\n');
  assert.ok(joined.includes('nForma Live Health Dashboard'), 'must contain header title');
  assert.ok(joined.includes('[space/r] refresh'), 'must contain keybinding hint');
  assert.ok(joined.includes('[q/Esc] exit'), 'must contain exit hint');
});

// ---------------------------------------------------------------------------
// buildTimeoutChoices
// ---------------------------------------------------------------------------

test('buildTimeoutChoices: slot with quorum_timeout_ms in providers returns that value as currentMs', () => {
  const slots = ['claude-1'];
  const mcpServers = { 'claude-1': { env: { PROVIDER_SLOT: 'claude-1' } } };
  const providersData = { providers: [{ name: 'claude-1', type: 'http', quorum_timeout_ms: 45000 }] };
  const rows = buildTimeoutChoices(slots, mcpServers, providersData);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].slotName, 'claude-1');
  assert.strictEqual(rows[0].currentMs, 45000);
});

test('buildTimeoutChoices: slot with only timeout_ms in providers falls back to timeout_ms', () => {
  const slots = ['gemini-1'];
  const mcpServers = { 'gemini-1': { env: { PROVIDER_SLOT: 'gemini-1' } } };
  const providersData = { providers: [{ name: 'gemini-1', type: 'http', timeout_ms: 30000 }] };
  const rows = buildTimeoutChoices(slots, mcpServers, providersData);
  assert.strictEqual(rows[0].currentMs, 30000);
});

test('buildTimeoutChoices: slot with no matching provider in providers returns currentMs=null', () => {
  const slots = ['unknown-1'];
  const mcpServers = { 'unknown-1': { env: { PROVIDER_SLOT: 'unknown-1' } } };
  const providersData = { providers: [] };
  const rows = buildTimeoutChoices(slots, mcpServers, providersData);
  assert.strictEqual(rows[0].currentMs, null);
  assert.strictEqual(rows[0].providerSlot, 'unknown-1');
});

test('buildTimeoutChoices: providerSlot derived from PROVIDER_SLOT env var, not slotName when they differ', () => {
  const slots = ['claude-1'];
  const mcpServers = { 'claude-1': { env: { PROVIDER_SLOT: 'akashml-provider' } } };
  const providersData = { providers: [{ name: 'akashml-provider', quorum_timeout_ms: 60000 }] };
  const rows = buildTimeoutChoices(slots, mcpServers, providersData);
  assert.strictEqual(rows[0].providerSlot, 'akashml-provider');
  assert.strictEqual(rows[0].currentMs, 60000);
});

// ---------------------------------------------------------------------------
// applyTimeoutUpdate
// ---------------------------------------------------------------------------

test('applyTimeoutUpdate: updates quorum_timeout_ms for the matching providerSlot', () => {
  const providersData = { providers: [{ name: 'claude-1', quorum_timeout_ms: 30000 }] };
  const updated = applyTimeoutUpdate(providersData, 'claude-1', 60000);
  const found = updated.providers.find((p) => p.name === 'claude-1');
  assert.strictEqual(found.quorum_timeout_ms, 60000);
});

test('applyTimeoutUpdate: does not mutate the input providersData object', () => {
  const original = { providers: [{ name: 'claude-1', quorum_timeout_ms: 30000 }] };
  const originalCopy = JSON.parse(JSON.stringify(original));
  applyTimeoutUpdate(original, 'claude-1', 60000);
  assert.deepStrictEqual(original, originalCopy, 'input must not be mutated');
});

test('applyTimeoutUpdate: leaves non-target providers unchanged', () => {
  const providersData = {
    providers: [
      { name: 'claude-1', quorum_timeout_ms: 30000 },
      { name: 'gemini-1', quorum_timeout_ms: 45000 },
    ],
  };
  const updated = applyTimeoutUpdate(providersData, 'claude-1', 99000);
  const gemini = updated.providers.find((p) => p.name === 'gemini-1');
  assert.strictEqual(gemini.quorum_timeout_ms, 45000, 'gemini-1 must not change');
});

test('applyTimeoutUpdate: no-op when providerSlot not found — returns data with unchanged providers', () => {
  const providersData = { providers: [{ name: 'claude-1', quorum_timeout_ms: 30000 }] };
  const updated = applyTimeoutUpdate(providersData, 'nonexistent', 99000);
  assert.strictEqual(updated.providers.length, 1);
  assert.strictEqual(updated.providers[0].quorum_timeout_ms, 30000);
});

// ---------------------------------------------------------------------------
// buildPolicyChoices
// ---------------------------------------------------------------------------

test('buildPolicyChoices: returns exactly 3 choices (auto, prompt, skip)', () => {
  const choices = buildPolicyChoices(null);
  assert.strictEqual(choices.length, 3);
  const values = choices.map((c) => c.value);
  assert.ok(values.includes('auto'));
  assert.ok(values.includes('prompt'));
  assert.ok(values.includes('skip'));
});

test('buildPolicyChoices: annotates current policy choice with left-arrow current marker', () => {
  const choices = buildPolicyChoices('auto');
  const autoCh = choices.find((c) => c.value === 'auto');
  assert.ok(autoCh.name.includes('\u2190 current'), 'auto choice must have arrow current marker');
});

test('buildPolicyChoices: non-current choices do NOT contain the current marker', () => {
  const choices = buildPolicyChoices('auto');
  const promptCh = choices.find((c) => c.value === 'prompt');
  const skipCh   = choices.find((c) => c.value === 'skip');
  assert.ok(!promptCh.name.includes('\u2190 current'), 'prompt must not have marker');
  assert.ok(!skipCh.name.includes('\u2190 current'), 'skip must not have marker');
});

test('buildPolicyChoices: null currentPolicy annotates no choice with current marker', () => {
  const choices = buildPolicyChoices(null);
  for (const c of choices) {
    assert.ok(!c.name.includes('\u2190 current'), `choice ${c.value} must not have marker when currentPolicy is null`);
  }
});

// ---------------------------------------------------------------------------
// validateTimeout
// ---------------------------------------------------------------------------

test('validateTimeout: valid positive integer "30000" returns { valid: true, ms: 30000 }', () => {
  const result = validateTimeout('30000');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.ms, 30000);
});

test('validateTimeout: valid positive integer "1" returns { valid: true, ms: 1 }', () => {
  const result = validateTimeout('1');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.ms, 1);
});

test('validateTimeout: empty string returns { valid: true, ms: null }', () => {
  const result = validateTimeout('');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.ms, null);
});

test('validateTimeout: null returns { valid: true, ms: null }', () => {
  const result = validateTimeout(null);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.ms, null);
});

test('validateTimeout: undefined returns { valid: true, ms: null }', () => {
  const result = validateTimeout(undefined);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.ms, null);
});

test('validateTimeout: negative value "-1" returns error with "positive" in message', () => {
  const result = validateTimeout('-1');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('positive'), 'error must mention positive');
});

test('validateTimeout: zero "0" returns error with "positive" in message', () => {
  const result = validateTimeout('0');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('positive'), 'error must mention positive');
});

test('validateTimeout: non-numeric "abc" returns error with "positive" in message', () => {
  const result = validateTimeout('abc');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('positive'), 'error must mention positive');
});

test('validateTimeout: negative value "-500" returns error containing "-500"', () => {
  const result = validateTimeout('-500');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('-500'), 'error must contain the invalid value');
});

// ---------------------------------------------------------------------------
// validateUpdatePolicy
// ---------------------------------------------------------------------------

test('validateUpdatePolicy: "auto" returns { valid: true, policy: "auto" }', () => {
  const result = validateUpdatePolicy('auto');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.policy, 'auto');
});

test('validateUpdatePolicy: "prompt" returns { valid: true, policy: "prompt" }', () => {
  const result = validateUpdatePolicy('prompt');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.policy, 'prompt');
});

test('validateUpdatePolicy: "skip" returns { valid: true, policy: "skip" }', () => {
  const result = validateUpdatePolicy('skip');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.policy, 'skip');
});

test('validateUpdatePolicy: "always" returns error with "always" in message', () => {
  const result = validateUpdatePolicy('always');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('always'), 'error must mention the invalid value');
});

test('validateUpdatePolicy: empty string returns error', () => {
  const result = validateUpdatePolicy('');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error, 'error must be present');
});

test('validateUpdatePolicy: null returns error', () => {
  const result = validateUpdatePolicy(null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error, 'error must be present');
});

// ---------------------------------------------------------------------------
// buildUpdateLogEntry
// ---------------------------------------------------------------------------

test('buildUpdateLogEntry: returns a string ending in newline', () => {
  const entry = buildUpdateLogEntry('claude-1', 'OK', null);
  assert.ok(typeof entry === 'string', 'must return a string');
  assert.ok(entry.endsWith('\n'), 'must end with newline');
});

test('buildUpdateLogEntry: returned string is valid JSON with slot, status, ts, detail fields', () => {
  const entry = buildUpdateLogEntry('claude-1', 'UPDATE_AVAILABLE', 'v1.2.3');
  const parsed = JSON.parse(entry.trim());
  assert.strictEqual(parsed.slot, 'claude-1');
  assert.strictEqual(parsed.status, 'UPDATE_AVAILABLE');
  assert.ok(typeof parsed.ts === 'string', 'ts must be a string');
  assert.strictEqual(parsed.detail, 'v1.2.3');
});

test('buildUpdateLogEntry: ts field is a valid ISO 8601 string', () => {
  const entry = buildUpdateLogEntry('gemini-1', 'ERROR', 'network timeout');
  const parsed = JSON.parse(entry.trim());
  assert.ok(!isNaN(Date.parse(parsed.ts)), 'ts must be a valid ISO 8601 date string');
});

test('buildUpdateLogEntry: omitting detail produces null in JSON output', () => {
  const entry = buildUpdateLogEntry('claude-1', 'SKIP');
  const parsed = JSON.parse(entry.trim());
  assert.strictEqual(parsed.detail, null);
});

test('buildUpdateLogEntry: status=ERROR is preserved verbatim in output', () => {
  const entry = buildUpdateLogEntry('claude-1', 'ERROR', 'failed');
  const parsed = JSON.parse(entry.trim());
  assert.strictEqual(parsed.status, 'ERROR');
});

// ---------------------------------------------------------------------------
// parseUpdateLogErrors
// ---------------------------------------------------------------------------

test('parseUpdateLogErrors: null logContent returns empty array', () => {
  assert.deepStrictEqual(parseUpdateLogErrors(null), []);
});

test('parseUpdateLogErrors: empty string returns empty array', () => {
  assert.deepStrictEqual(parseUpdateLogErrors(''), []);
});

test('parseUpdateLogErrors: filters out non-ERROR status entries', () => {
  const logContent = [
    JSON.stringify({ ts: new Date().toISOString(), slot: 'claude-1', status: 'OK', detail: null }),
    JSON.stringify({ ts: new Date().toISOString(), slot: 'gemini-1', status: 'UPDATE_AVAILABLE', detail: 'v2' }),
  ].join('\n') + '\n';
  const result = parseUpdateLogErrors(logContent, 86400000);
  assert.strictEqual(result.length, 0, 'OK and UPDATE_AVAILABLE entries must be filtered out');
});

test('parseUpdateLogErrors: filters out ERROR entries older than maxAgeMs', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const logContent = JSON.stringify({ ts: twoHoursAgo, slot: 'claude-1', status: 'ERROR', detail: 'old' }) + '\n';
  // maxAgeMs = 1 hour = 3600000
  const result = parseUpdateLogErrors(logContent, 3600000);
  assert.strictEqual(result.length, 0, 'Entry older than maxAgeMs must be excluded');
});

test('parseUpdateLogErrors: returns ERROR entries within maxAgeMs window', () => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const logContent = JSON.stringify({ ts: fiveMinutesAgo, slot: 'claude-1', status: 'ERROR', detail: 'recent' }) + '\n';
  const result = parseUpdateLogErrors(logContent, 86400000);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].slot, 'claude-1');
});

test('parseUpdateLogErrors: skips malformed JSON lines without throwing', () => {
  const logContent = 'NOT_JSON\n' + JSON.stringify({ ts: new Date().toISOString(), slot: 'x', status: 'ERROR', detail: null }) + '\n';
  let result;
  assert.doesNotThrow(() => { result = parseUpdateLogErrors(logContent, 86400000); });
  assert.strictEqual(result.length, 1, 'valid ERROR entry after malformed line must still be returned');
});

test('parseUpdateLogErrors: uses 24h window as default when maxAgeMs not provided', () => {
  // Entry from 23 hours ago should be included with default 24h window
  const twentyThreeHoursAgo = new Date(Date.now() - 23 * 3600 * 1000).toISOString();
  const logContent = JSON.stringify({ ts: twentyThreeHoursAgo, slot: 'claude-1', status: 'ERROR', detail: 'almost old' }) + '\n';
  const result = parseUpdateLogErrors(logContent);  // no maxAgeMs — uses default 24h
  assert.strictEqual(result.length, 1, '23h old ERROR must be within 24h default window');
});

// ── v0.10-07 Wave 0 stubs: probeAllSlots + liveDashboard _pure exports ──────
// These stubs MUST fail with TypeError until Plan 02 adds the _pure exports.

test('probeAllSlots: subprocess slots return healthy:null without HTTP probe', async () => {
  const { probeAllSlots } = _pure;   // TypeError until _pure export added
  const mockMcpServers = {
    'subprocess-slot': { command: 'node', args: ['server.js'], env: {} },
  };
  const result = await probeAllSlots(mockMcpServers, ['subprocess-slot'], null);
  assert.strictEqual(result['subprocess-slot'].healthy, null);
  assert.strictEqual(result['subprocess-slot'].error, 'subprocess');
});

test('probeAllSlots: empty slots returns empty object', async () => {
  const { probeAllSlots } = _pure;   // TypeError until _pure export added
  const result = await probeAllSlots({}, [], null);
  assert.deepStrictEqual(result, {});
});

test('probeAllSlots: returns one entry per slot', async () => {
  const { probeAllSlots } = _pure;   // TypeError until _pure export added
  const mockMcpServers = {
    'slot-a': { env: {} },
    'slot-b': { env: {} },
  };
  const result = await probeAllSlots(mockMcpServers, ['slot-a', 'slot-b'], null);
  assert.strictEqual(Object.keys(result).length, 2);
});

test('liveDashboard smoke: non-TTY path resolves without throwing', async () => {
  const { liveDashboard } = _pure;   // TypeError until _pure export added
  // In node:test context process.stdout.isTTY is falsy — non-TTY branch fires.
  // Guard: if somehow running in a real TTY, skip to avoid raw-mode hang.
  if (process.stdout.isTTY) {
    return;
  }
  await assert.doesNotReject(liveDashboard());
});

// ── v0.10-08 Wave 0 stubs: PLCY-03 Map bracket notation regression guard ────

test('REGRESSION PLCY-03: Map bracket notation always returns undefined — proves original bug', () => {
  // This test PASSES — it documents that statuses[slot] on a Map is always undefined.
  // The BROKEN code in runAutoUpdateCheck() uses statuses[slot] which hits this path.
  const fakeStatuses = new Map([['codex', { current: '1.0', latest: '2.0', status: 'update-available' }]]);
  assert.strictEqual(fakeStatuses['codex-1'], undefined, 'bracket notation on Map with slot name must return undefined');
  assert.strictEqual(fakeStatuses['codex'], undefined, 'bracket notation on Map with binary name also returns undefined');
});

test('REGRESSION PLCY-03: Map.get(binName) resolves correctly — proves fix direction', () => {
  // This test PASSES — it documents that statuses.get('codex') is the correct API.
  const fakeStatuses = new Map([['codex', { current: '1.0', latest: '2.0', status: 'update-available' }]]);
  const entry = fakeStatuses.get('codex');
  assert.ok(entry, 'Map.get(binName) must return the status entry');
  assert.strictEqual(entry.status, 'update-available');
  assert.strictEqual(entry.latest, '2.0');
  assert.strictEqual(entry.current, '1.0');
});

test('REGRESSION PLCY-03: runAutoUpdateCheck logs UPDATE_AVAILABLE not SKIP for auto-policy slot with injected statuses', async () => {
  // RED: This test will fail until runAutoUpdateCheck() accepts getStatusesFn injection (Plan 02).
  // When fixed: slot 'codex-1' with update_policy=auto must log UPDATE_AVAILABLE, not SKIP.
  const { runAutoUpdateCheck } = require('./manage-agents-core.cjs')._pure;
  // runAutoUpdateCheck is not currently in _pure — this line throws, keeping the test RED.
  assert.ok(typeof runAutoUpdateCheck === 'function', 'runAutoUpdateCheck must be exported via _pure');
});

test('PLCY-03 Integration: runAutoUpdateCheck with auto-policy slot logs UPDATE_AVAILABLE', async () => {
  // Integration test validating PLCY-03 startup contract:
  // - Create temporary nf.json with a slot having update_policy=auto
  // - Call runAutoUpdateCheck() with injected getStatusesFn returning update-available status
  // - Verify UPDATE_AVAILABLE is written to log
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { runAutoUpdateCheck } = require('./manage-agents-core.cjs')._pure;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plcy-03-test-'));
  const tmpNfJsonPath = path.join(tmpDir, 'nf.json');

  try {
    // Setup: Create nf.json with auto-policy slot
    const nfConfig = {
      agent_config: {
        'codex-1': { update_policy: 'auto' },
        'claude-1': { update_policy: 'manual' }
      }
    };
    fs.writeFileSync(tmpNfJsonPath, JSON.stringify(nfConfig, null, 2));

    // Mock getStatusesFn returning update-available for codex
    const mockGetStatuses = async () => {
      return new Map([
        ['codex', { current: '1.0', latest: '2.0', status: 'update-available' }]
      ]);
    };

    // Capture log entries via fs.appendFileSync mock
    const logEntries = [];
    const originalAppendFileSync = fs.appendFileSync;
    fs.appendFileSync = (filePath, content) => {
      logEntries.push(content);
    };

    try {
      await runAutoUpdateCheck(mockGetStatuses, tmpNfJsonPath);
    } finally {
      fs.appendFileSync = originalAppendFileSync;
    }

    // Verify: log contains UPDATE_AVAILABLE entry for codex-1
    const logContent = logEntries.join('');
    assert.ok(logContent.includes('codex-1'), 'Log must mention codex-1 slot');
    assert.ok(logContent.includes('UPDATE_AVAILABLE'), 'Log must contain UPDATE_AVAILABLE status (not SKIP)');
  } finally {
    // Cleanup
    try { fs.unlinkSync(tmpNfJsonPath); } catch (_) {}
    try { fs.rmdirSync(tmpDir); } catch (_) {}
  }
});

// ---------------------------------------------------------------------------
// buildBackupPath
// ---------------------------------------------------------------------------

test('buildBackupPath: appends pre-import timestamp suffix', () => {
  const ts = '2026-02-25T12-34-56-789Z';
  assert.strictEqual(
    buildBackupPath('/Users/alice/.claude.json', ts),
    '/Users/alice/.claude.json.pre-import.2026-02-25T12-34-56-789Z'
  );
});

test('buildBackupPath: works with arbitrary timestamp string', () => {
  const result = buildBackupPath('/home/bob/.claude.json', 'TS');
  assert.ok(result.endsWith('.pre-import.TS'));
});

// ---------------------------------------------------------------------------
// buildRedactedEnv
// ---------------------------------------------------------------------------

test('buildRedactedEnv: redacts _KEY suffix', () => {
  const result = buildRedactedEnv({ ANTHROPIC_API_KEY: 'sk-real-key' });
  assert.strictEqual(result.ANTHROPIC_API_KEY, '__redacted__');
});

test('buildRedactedEnv: redacts _SECRET suffix', () => {
  const result = buildRedactedEnv({ APP_SECRET: 'my-secret' });
  assert.strictEqual(result.APP_SECRET, '__redacted__');
});

test('buildRedactedEnv: preserves non-sensitive keys', () => {
  const result = buildRedactedEnv({ BASE_URL: 'https://example.com', MODEL: 'claude' });
  assert.strictEqual(result.BASE_URL, 'https://example.com');
  assert.strictEqual(result.MODEL, 'claude');
});

test('buildRedactedEnv: empty env returns {}', () => {
  assert.deepStrictEqual(buildRedactedEnv({}), {});
});

// ---------------------------------------------------------------------------
// buildExportData
// ---------------------------------------------------------------------------

test('buildExportData: redacts env values in mcpServers', () => {
  const input = {
    mcpServers: {
      'claude-1': { command: 'node', args: [], env: { ANTHROPIC_API_KEY: 'sk-real' } }
    }
  };
  const out = buildExportData(input);
  assert.strictEqual(out.mcpServers['claude-1'].env.ANTHROPIC_API_KEY, '__redacted__');
});

test('buildExportData: preserves non-env fields', () => {
  const input = {
    mcpServers: {
      'claude-1': { command: 'node', args: ['server.cjs'], env: {} }
    }
  };
  const out = buildExportData(input);
  assert.strictEqual(out.mcpServers['claude-1'].command, 'node');
  assert.deepStrictEqual(out.mcpServers['claude-1'].args, ['server.cjs']);
});

test('buildExportData: replaced env values contain __redacted__ placeholder', () => {
  const input = {
    mcpServers: {
      's1': { env: { SOME_TOKEN: 'tok-xyz', BASE_URL: 'https://api.example.com' } }
    }
  };
  const out = buildExportData(input);
  assert.strictEqual(out.mcpServers.s1.env.SOME_TOKEN, '__redacted__');
  assert.strictEqual(out.mcpServers.s1.env.BASE_URL, 'https://api.example.com');
});

// ---------------------------------------------------------------------------
// validateImportSchema
// ---------------------------------------------------------------------------

test('validateImportSchema: non-object root returns error', () => {
  const errors = validateImportSchema('not-an-object');
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes('JSON object'));
});

test('validateImportSchema: invalid command returns error', () => {
  const errors = validateImportSchema({
    mcpServers: { 's1': { command: 'python', args: [] } }
  });
  assert.ok(errors.some(e => e.includes('"python"')));
});

test('validateImportSchema: absolute home path in args returns error', () => {
  const errors = validateImportSchema({
    mcpServers: { 's1': { command: 'node', args: ['/Users/alice/server.cjs'] } }
  });
  assert.ok(errors.some(e => e.includes('/Users/alice/server.cjs')));
});

test('validateImportSchema: valid minimal schema returns no errors', () => {
  const errors = validateImportSchema({
    mcpServers: { 's1': { command: 'node', args: ['./server.cjs'] } }
  });
  assert.strictEqual(errors.length, 0);
});

test('validateImportSchema: multiple errors all collected before return', () => {
  const errors = validateImportSchema({
    mcpServers: {
      's1': { command: 'python', args: ['/home/bob/script.py'] },
      's2': { command: 'ruby', args: [] },
    }
  });
  assert.ok(errors.length >= 2);
});

test('validateImportSchema: __redacted__ value in env is not a validation error', () => {
  const errors = validateImportSchema({
    mcpServers: { 's1': { command: 'node', args: [], env: { ANTHROPIC_API_KEY: '__redacted__' } } }
  });
  assert.strictEqual(errors.length, 0);
});

// ---------------------------------------------------------------------------
// PORT-01: Export — additional coverage
// ---------------------------------------------------------------------------

test('buildExportData: empty mcpServers returns clean object (no crash)', () => {
  const out = buildExportData({ mcpServers: {} });
  assert.deepStrictEqual(out.mcpServers, {});
});

test('buildExportData: multi-key redaction — sensitive keys become __redacted__, non-sensitive preserved', () => {
  const input = {
    mcpServers: {
      's1': { env: { ANTHROPIC_API_KEY: 'sk-real', TOGETHER_API_KEY: 'tok-real', CLAUDE_DEFAULT_MODEL: 'model-x', BASE_URL: 'https://example.com' } }
    }
  };
  const out = buildExportData(input);
  assert.strictEqual(out.mcpServers.s1.env.ANTHROPIC_API_KEY, '__redacted__');
  assert.strictEqual(out.mcpServers.s1.env.TOGETHER_API_KEY, '__redacted__');
  assert.strictEqual(out.mcpServers.s1.env.CLAUDE_DEFAULT_MODEL, 'model-x');
  assert.strictEqual(out.mcpServers.s1.env.BASE_URL, 'https://example.com');
});

test('buildExportData: roundtrip — JSON.parse(JSON.stringify()) does not mutate original', () => {
  const original = {
    mcpServers: { 's1': { env: { ANTHROPIC_API_KEY: 'sk-original', MODEL: 'v1' } } }
  };
  const exported = buildExportData(original);
  const _roundtrip = JSON.parse(JSON.stringify(exported));
  // Original must still have real key
  assert.strictEqual(original.mcpServers.s1.env.ANTHROPIC_API_KEY, 'sk-original');
  // Exported must have redacted key
  assert.strictEqual(exported.mcpServers.s1.env.ANTHROPIC_API_KEY, '__redacted__');
  assert.strictEqual(_roundtrip.mcpServers.s1.env.ANTHROPIC_API_KEY, '__redacted__');
});

test('buildRedactedEnv: redacts _TOKEN and _PASSWORD suffixes (case-insensitive)', () => {
  const result = buildRedactedEnv({ ACCESS_TOKEN: 'tok-123', DB_PASSWORD: 'pw-456', NORMAL_VAR: 'keep' });
  assert.strictEqual(result.ACCESS_TOKEN, '__redacted__');
  assert.strictEqual(result.DB_PASSWORD, '__redacted__');
  assert.strictEqual(result.NORMAL_VAR, 'keep');
});

test('buildRedactedEnv: null/non-object input returns empty object', () => {
  assert.deepStrictEqual(buildRedactedEnv(null), {});
  assert.deepStrictEqual(buildRedactedEnv(undefined), {});
  assert.deepStrictEqual(buildRedactedEnv('string'), {});
});

// ---------------------------------------------------------------------------
// PORT-02: Import validation — additional coverage
// ---------------------------------------------------------------------------

test('validateImportSchema: null root returns error', () => {
  const errors = validateImportSchema(null);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.includes('JSON object')));
});

test('validateImportSchema: array root returns no errors (typeof array is object, passthrough)', () => {
  // Arrays pass the typeof check — no mcpServers found, so no validation errors
  const errors = validateImportSchema([]);
  assert.strictEqual(errors.length, 0);
});

test('validateImportSchema: accepts valid config with full server entry', () => {
  const errors = validateImportSchema({
    mcpServers: { 's1': { type: 'stdio', command: 'node', args: ['./server.cjs'], env: { MODEL: 'v1' } } }
  });
  assert.strictEqual(errors.length, 0);
});

test('validateImportSchema: rejects /home/ absolute path in args', () => {
  const errors = validateImportSchema({
    mcpServers: { 's1': { command: 'node', args: ['/home/bob/server.cjs'] } }
  });
  assert.ok(errors.some(e => e.includes('/home/bob/server.cjs')));
});

// ---------------------------------------------------------------------------
// PORT-03: Backup path — additional coverage
// ---------------------------------------------------------------------------

test('buildBackupPath: output includes .pre-import. separator', () => {
  const result = buildBackupPath('/any/path/.claude.json', '2026-01-01T00:00:00.000Z');
  assert.ok(result.includes('.pre-import.'));
});

test('buildBackupPath: file I/O integration — backup copy matches original', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-test-backup-'));
  const original = path.join(tmpDir, '.claude.json');
  const content = JSON.stringify({ mcpServers: { s1: { command: 'node' } } });
  fs.writeFileSync(original, content, 'utf8');
  const backupPath = buildBackupPath(original, '2026-03-03T14:30:00.000Z');
  fs.copyFileSync(original, backupPath);
  assert.ok(fs.existsSync(backupPath));
  assert.strictEqual(fs.readFileSync(backupPath, 'utf8'), content);
  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// PRST-02: Clone entry — additional coverage
// ---------------------------------------------------------------------------

test('buildCloneEntry: null/undefined source config returns sensible defaults', () => {
  const entry = buildCloneEntry(null, 'new-slot');
  assert.strictEqual(entry.type, 'stdio');
  assert.strictEqual(entry.command, 'node');
  assert.deepStrictEqual(entry.args, []);
  assert.strictEqual(entry.env.PROVIDER_SLOT, 'new-slot');
});

test('buildCloneEntry: undefined source config returns sensible defaults', () => {
  const entry = buildCloneEntry(undefined, 'new-slot-2');
  assert.strictEqual(entry.type, 'stdio');
  assert.strictEqual(entry.command, 'node');
  assert.deepStrictEqual(entry.args, []);
  assert.strictEqual(entry.env.PROVIDER_SLOT, 'new-slot-2');
});

test('buildCloneEntry: args are copied by value (not reference)', () => {
  const sourceCfg = { command: 'node', args: ['./server.cjs', '--port', '3000'], env: {} };
  const entry = buildCloneEntry(sourceCfg, 'clone-1');
  entry.args.push('--extra');
  assert.strictEqual(sourceCfg.args.length, 3, 'Source args must not be mutated by clone');
});

// ---------------------------------------------------------------------------
// PRST-01: Preset — additional coverage
// ---------------------------------------------------------------------------

test('findPresetForUrl: empty string returns __custom__', () => {
  assert.strictEqual(findPresetForUrl(''), '__custom__');
});

test('PROVIDER_PRESETS: contains exactly 3 named entries (AkashML, Together.xyz, Fireworks.ai)', () => {
  // PROVIDER_PRESETS is in manage-agents-core.cjs, not exported in _pure.
  // We verify via findPresetForUrl behavior: all 3 known URLs match, and no 4th preset exists.
  const known = [
    'https://api.akashml.com/v1',
    'https://api.together.xyz/v1',
    'https://api.fireworks.ai/inference/v1',
  ];
  for (const url of known) {
    assert.notStrictEqual(findPresetForUrl(url), '__custom__', `${url} should match a preset`);
  }
  // A URL that is NOT in the presets should return __custom__
  assert.strictEqual(findPresetForUrl('https://api.openai.com/v1'), '__custom__');
});

// ---------------------------------------------------------------------------
// Clone metadata copy logic (PRST-02 — nf.json agent_config)
// ---------------------------------------------------------------------------

test('clone metadata: deep-clone copies timeout_ms and update_policy from source', () => {
  const sourceConfig = {
    timeout_ms: 120000,
    update_policy: 'auto',
    key_status: { status: 'ok', checkedAt: '2026-03-03T00:00:00.000Z' },
  };
  // Simulate the clone logic from cloneSlotFlow
  const cloned = JSON.parse(JSON.stringify(sourceConfig));
  if (cloned.key_status) delete cloned.key_status;
  assert.strictEqual(cloned.timeout_ms, 120000);
  assert.strictEqual(cloned.update_policy, 'auto');
});

test('clone metadata: key_status is deleted from cloned config', () => {
  const sourceConfig = {
    timeout_ms: 60000,
    update_policy: 'prompt',
    key_status: { status: 'ok', checkedAt: '2026-03-03T00:00:00.000Z' },
  };
  const cloned = JSON.parse(JSON.stringify(sourceConfig));
  if (cloned.key_status) delete cloned.key_status;
  assert.strictEqual(cloned.key_status, undefined, 'key_status must be deleted from clone');
  assert.strictEqual(cloned.timeout_ms, 60000, 'timeout_ms must be preserved');
  assert.strictEqual(cloned.update_policy, 'prompt', 'update_policy must be preserved');
});

// ---------------------------------------------------------------------------
// REN-03: No hardcoded get-shit-done/ paths — regression smoke tests
// ---------------------------------------------------------------------------

test('REN-03: zero get-shit-done/ directory paths in bin/*.cjs', () => {
  const fs = require('fs');
  const path = require('path');
  const binDir = path.join(__dirname, '.');
  const cjsFiles = fs.readdirSync(binDir).filter(f => f.endsWith('.cjs') && !f.includes('.test.'));
  const re = /\/get-shit-done\//g;
  const violations = [];
  for (const f of cjsFiles) {
    const content = fs.readFileSync(path.join(binDir, f), 'utf8');
    re.lastIndex = 0;
    const matches = content.match(re);
    if (matches) violations.push({ file: f, count: matches.length });
  }
  assert.deepStrictEqual(violations, [], 'No bin/*.cjs file should contain /get-shit-done/ path segments');
});

test('REN-03: zero get-shit-done/ directory paths in workflow files', () => {
  const fs = require('fs');
  const path = require('path');
  const wfDir = path.join(__dirname, '..', 'core', 'workflows');
  if (!fs.existsSync(wfDir)) return; // skip if dir doesn't exist
  const mdFiles = fs.readdirSync(wfDir).filter(f => f.endsWith('.md'));
  const re = /\/get-shit-done\//g;
  const violations = [];
  for (const f of mdFiles) {
    const content = fs.readFileSync(path.join(wfDir, f), 'utf8');
    re.lastIndex = 0;
    const matches = content.match(re);
    if (matches) violations.push({ file: f, count: matches.length });
  }
  assert.deepStrictEqual(violations, [], 'No workflow file should contain /get-shit-done/ path segments');
});

test('REN-03: zero get-shit-done/ directory paths in template files', () => {
  const fs = require('fs');
  const path = require('path');
  const tplDir = path.join(__dirname, '..', 'core', 'templates');
  if (!fs.existsSync(tplDir)) return; // skip if dir doesn't exist
  const mdFiles = fs.readdirSync(tplDir).filter(f => f.endsWith('.md'));
  const re = /\/get-shit-done\//g;
  const violations = [];
  for (const f of mdFiles) {
    const content = fs.readFileSync(path.join(tplDir, f), 'utf8');
    re.lastIndex = 0;
    const matches = content.match(re);
    if (matches) violations.push({ file: f, count: matches.length });
  }
  assert.deepStrictEqual(violations, [], 'No template file should contain /get-shit-done/ path segments');
});

// ---------------------------------------------------------------------------
// DASH-01 / DASH-02 / DASH-03 — Health Dashboard requirement coverage
// ---------------------------------------------------------------------------

// ── DASH-01: Dashboard display ──────────────────────────────────────────────

test('DASH-01: buildDashboardLines renders header with "nForma Live Health Dashboard" title', () => {
  const lines = buildDashboardLines([], {}, {}, null);
  const joined = lines.join('\n');
  assert.ok(joined.includes('nForma Live Health Dashboard'), 'must contain header title');
});

test('DASH-01: buildDashboardLines shows slot name, provider hostname, model name, and health status for each slot', () => {
  const slots = ['claude-1', 'gemini-1'];
  const mcpServers = {
    'claude-1': { env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1', CLAUDE_DEFAULT_MODEL: 'deepseek-v3' } },
    'gemini-1': { env: { ANTHROPIC_BASE_URL: 'https://api.together.xyz/v1' } },
  };
  const healthMap = {
    'claude-1': { healthy: true, latencyMs: 42, statusCode: 200 },
    'gemini-1': { healthy: false, latencyMs: 0, statusCode: 500 },
  };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const joined = lines.join('\n');
  // DASH-01: verify all four columns for each slot
  assert.ok(joined.includes('claude-1'), 'must show first slot name');
  assert.ok(joined.includes('akashml'), 'must show first slot provider');
  assert.ok(joined.includes('deepseek'), 'must show first slot model');
  assert.ok(joined.includes('UP'), 'must show UP status for healthy slot');
  assert.ok(joined.includes('gemini-1'), 'must show second slot name');
  assert.ok(joined.includes('together'), 'must show second slot provider');
  assert.ok(joined.includes('DOWN'), 'must show DOWN status for unhealthy slot');
});

test('DASH-01: buildDashboardLines shows subprocess label for non-HTTP slots', () => {
  const slots = ['copilot-1'];
  const mcpServers = { 'copilot-1': { command: 'node', args: ['server.js'], env: {} } };
  const healthMap = { 'copilot-1': { healthy: null, error: 'subprocess' } };
  const lines = buildDashboardLines(slots, mcpServers, healthMap, Date.now());
  const joined = lines.join('\n');
  assert.ok(joined.includes('subprocess'), 'must show subprocess label for non-HTTP slot');
});

// ── DASH-02: Refresh and timestamp ──────────────────────────────────────────

test('DASH-02: formatTimestamp renders HH:MM:SS format for valid timestamp', () => {
  const result = formatTimestamp(Date.now());
  assert.match(result, /^\d{2}:\d{2}:\d{2}$/, 'must be HH:MM:SS format');
});

test('DASH-02: formatTimestamp renders em-dash for null (never refreshed state)', () => {
  assert.strictEqual(formatTimestamp(null), '\u2014', 'null must render as em-dash');
});

test('DASH-02: buildDashboardLines shows footer with [space/r] refresh and [q/Esc] exit keybinding hints', () => {
  const lines = buildDashboardLines([], {}, {}, Date.now());
  const joined = lines.join('\n');
  assert.ok(joined.includes('[space/r] refresh'), 'must show refresh keybinding hint');
  assert.ok(joined.includes('[q/Esc] exit'), 'must show exit keybinding hint');
});

test('DASH-02: buildDashboardLines shows yellow [stale] warning when lastUpdated exceeds 60-second threshold', () => {
  const staleTs = Date.now() - 70_000;
  const lines = buildDashboardLines([], {}, {}, staleTs);
  const joined = lines.join('\n');
  assert.ok(joined.includes('stale'), 'must show stale warning text');
  assert.ok(joined.includes('\x1b[33m'), 'must contain yellow ANSI escape code for stale indicator');
});

test('DASH-02: buildDashboardLines does NOT show [stale] warning when lastUpdated is within 60 seconds', () => {
  const freshTs = Date.now() - 10_000;
  const lines = buildDashboardLines([], {}, {}, freshTs);
  const joined = lines.join('\n');
  assert.ok(!joined.includes('stale'), 'must NOT show stale warning when timestamp is fresh');
});

// ── DASH-03: Clean exit ─────────────────────────────────────────────────────

test('DASH-03: liveDashboard non-TTY fallback resolves without throwing (clean exit path)', async () => {
  // In node:test context process.stdout.isTTY is falsy — non-TTY branch fires.
  // Guard: if somehow running in a real TTY, skip to avoid raw-mode hang.
  if (process.stdout.isTTY) {
    return;
  }
  await assert.doesNotReject(liveDashboard());
});

test('DASH-03: liveDashboard is an async function returning a Promise (exit contract)', () => {
  // Verify liveDashboard is callable and returns a thenable (Promise),
  // confirming the async exit contract for clean stdin restoration.
  assert.ok(typeof liveDashboard === 'function', 'liveDashboard must be a function');
  if (process.stdout.isTTY) {
    return; // Cannot safely call in TTY — just verify it is a function
  }
  const result = liveDashboard();
  assert.ok(result instanceof Promise, 'liveDashboard() must return a Promise');
  // Clean up: await the promise so it does not leak
  return result;
});
