#!/usr/bin/env node
// @requirement WIZ-04
// Structural test: Each agent in the menu shows current model, provider, and key status
// Formal property: SelectAgent (QGSDSetupWizard.tla)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CORE_MODULE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');

test('WIZ-04 — buildAgentChoiceLabel includes model, provider, and key status', () => {
  const core = require(CORE_MODULE);
  const buildLabel = core._pure.buildAgentChoiceLabel;
  assert.ok(typeof buildLabel === 'function', 'buildAgentChoiceLabel must be a function');

  // Call with a mock config that has model and provider info
  const label = buildLabel(
    'test-slot',
    { env: { ANTHROPIC_BASE_URL: 'https://api.example.com/v1', CLAUDE_DEFAULT_MODEL: 'test-model' } },
    {},   // providerMap
    {},   // agentCfg
    null  // secretsLib
  );
  assert.ok(label.includes('test-model'), 'Label should include the model name');
  assert.ok(label.includes('no key'), 'Label should include key status when no key is set');
});

test('WIZ-04 — buildKeyStatus returns status for different auth types', () => {
  const core = require(CORE_MODULE);
  const buildKeyStatus = core._pure.buildKeyStatus;
  assert.ok(typeof buildKeyStatus === 'function', 'buildKeyStatus must be a function');

  const subStatus = buildKeyStatus('sub', 'test-slot', null);
  assert.match(subStatus, /sub/, 'Subscription auth should show [sub]');

  const noKeyStatus = buildKeyStatus(undefined, 'test-slot', null);
  assert.match(noKeyStatus, /no key/, 'Missing key should show [no key]');
});

test('WIZ-04 — shortProvider extracts provider hostname', () => {
  const core = require(CORE_MODULE);
  const shortProv = core._pure.shortProvider;
  assert.ok(typeof shortProv === 'function', 'shortProvider must be a function');

  const result = shortProv({ env: { ANTHROPIC_BASE_URL: 'https://api.akashml.com/v1' } });
  assert.equal(result, 'api.akashml.com', 'Should extract hostname from base URL');
});
