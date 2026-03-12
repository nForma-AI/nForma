// test/mcp-setup-auth-type.test.cjs
// Tests proving auth_type schema completeness and correct classification
// Uses Node.js built-in test runner (node --test)

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_PATH = path.join(__dirname, '..', 'bin', 'providers.json');
const providersData = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
const providers = providersData.providers || [];

// Build a lookup map keyed by provider name
const providerMap = {};
for (const p of providers) {
  providerMap[p.name] = p;
}

describe('auth_type schema in providers.json', () => {

  test('every provider in providers.json has auth_type field', () => {
    for (const p of providers) {
      assert.ok(
        p.auth_type && typeof p.auth_type === 'string',
        `Provider "${p.name}" is missing a truthy auth_type string`
      );
    }
  });

  test('auth_type values are only "sub" or "api"', () => {
    const allowed = new Set(['sub', 'api']);
    for (const p of providers) {
      assert.ok(
        allowed.has(p.auth_type),
        `Provider "${p.name}" has invalid auth_type "${p.auth_type}" — must be "sub" or "api"`
      );
    }
  });

  test('subscription CLI slots have auth_type=sub', () => {
    const expectedSub = ['codex-1', 'codex-2', 'gemini-1', 'gemini-2', 'opencode-1', 'copilot-1'];
    for (const name of expectedSub) {
      const p = providerMap[name];
      assert.ok(p, `Expected provider "${name}" to exist in providers.json`);
      assert.equal(
        p.auth_type, 'sub',
        `Provider "${name}" should have auth_type "sub" but has "${p.auth_type}"`
      );
    }
  });

  test('API-backed ccr slots have auth_type=api', () => {
    const expectedApi = ['claude-1', 'claude-2', 'claude-3', 'claude-4', 'claude-5', 'claude-6'];
    for (const name of expectedApi) {
      const p = providerMap[name];
      assert.ok(p, `Expected provider "${name}" to exist in providers.json`);
      assert.equal(
        p.auth_type, 'api',
        `Provider "${name}" should have auth_type "api" but has "${p.auth_type}"`
      );
    }
  });

  test('auth_type matches display_type pattern', () => {
    const cliDisplayTypes = new Set(['codex-cli', 'gemini-cli', 'opencode-cli', 'copilot-cli']);
    const routerDisplayType = 'claude-code-router';

    for (const p of providers) {
      if (!p.display_type) continue; // some entries may lack display_type (e.g. codex-2, gemini-2)

      if (cliDisplayTypes.has(p.display_type)) {
        assert.equal(
          p.auth_type, 'sub',
          `Provider "${p.name}" has display_type "${p.display_type}" (CLI) but auth_type is "${p.auth_type}" — expected "sub"`
        );
      } else if (p.display_type === routerDisplayType) {
        assert.equal(
          p.auth_type, 'api',
          `Provider "${p.name}" has display_type "${p.display_type}" (router) but auth_type is "${p.auth_type}" — expected "api"`
        );
      }
    }
  });

  test('no name-prefix inference needed for classification', () => {
    // Verify that providerMap[name].auth_type returns a valid value for every provider.
    // This proves the lookup pattern works without substring matching on the slot name.
    const allowed = new Set(['sub', 'api']);

    for (const p of providers) {
      const lookedUp = providerMap[p.name];
      assert.ok(lookedUp, `providerMap lookup for "${p.name}" returned undefined`);
      assert.ok(
        allowed.has(lookedUp.auth_type),
        `providerMap["${p.name}"].auth_type is "${lookedUp.auth_type}" — not a valid classification`
      );

      // Prove no regex/startsWith/includes needed: direct property access works
      const authType = lookedUp.auth_type;
      assert.notEqual(authType, undefined, `auth_type should be directly accessible, not inferred`);
      assert.equal(typeof authType, 'string', `auth_type should be a string, not computed`);
    }
  });

});
