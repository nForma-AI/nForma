#!/usr/bin/env node
// @requirement PORT-01
// Formal property: ExportConfig — export roster config with API keys replaced by __redacted__

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { _pure } = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'manage-agents-core.cjs'));
const { buildRedactedEnv, buildExportData } = _pure;

test('PORT-01: buildRedactedEnv replaces sensitive key values with __redacted__', () => {
  const env = {
    API_KEY: 'sk-secret-123',
    OPENAI_SECRET: 'my-secret',
    AUTH_TOKEN: 'tok-abc',
    DB_PASSWORD: 'hunter2',
    NORMAL_VAR: 'keep-this',
  };
  const redacted = buildRedactedEnv(env);
  assert.equal(redacted.API_KEY, '__redacted__');
  assert.equal(redacted.OPENAI_SECRET, '__redacted__');
  assert.equal(redacted.AUTH_TOKEN, '__redacted__');
  assert.equal(redacted.DB_PASSWORD, '__redacted__');
  assert.equal(redacted.NORMAL_VAR, 'keep-this');
});

test('PORT-01: buildExportData redacts all mcpServer env keys', () => {
  const claudeJson = {
    mcpServers: {
      'codex-1': { command: 'node', args: ['server.mjs'], env: { OPENAI_KEY: 'real-key', HOST: 'localhost' } },
      'gemini-1': { command: 'node', args: ['server.mjs'], env: { GEMINI_SECRET: 'gem-secret' } },
    },
  };
  const exported = buildExportData(claudeJson);
  assert.equal(exported.mcpServers['codex-1'].env.OPENAI_KEY, '__redacted__');
  assert.equal(exported.mcpServers['codex-1'].env.HOST, 'localhost');
  assert.equal(exported.mcpServers['gemini-1'].env.GEMINI_SECRET, '__redacted__');
});

test('PORT-01: buildRedactedEnv handles empty/null env gracefully', () => {
  assert.deepEqual(buildRedactedEnv(null), {});
  assert.deepEqual(buildRedactedEnv(undefined), {});
  assert.deepEqual(buildRedactedEnv({}), {});
});
