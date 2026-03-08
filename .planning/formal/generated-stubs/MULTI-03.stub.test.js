#!/usr/bin/env node
// @requirement MULTI-03
// Structural test: Adding a new slot of any family is supported by both
// direct config edit and via the mcp-setup wizard

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_PATH = path.resolve(__dirname, '../../../bin/install.js');

test('MULTI-03 — install.js references mcpServers config for slot management', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /mcpServers/,
    'install.js should reference mcpServers for slot config management');
});

test('MULTI-03 — install.js supports /nf:mcp-setup wizard for adding agents', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /mcp-setup/,
    'install.js should reference mcp-setup wizard');
});

test('MULTI-03 — install.js handles --migrate-slots for mcpServers key migration', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(content, /--migrate-slots/,
    'install.js should support --migrate-slots flag for renaming mcpServers entries');
});

test('MULTI-03 — providers.json structure supports adding new slots of any family', () => {
  const providersPath = path.resolve(__dirname, '../../../bin/providers.json');
  const raw = fs.readFileSync(providersPath, 'utf8');
  const { providers } = JSON.parse(raw);

  // Each provider entry follows a consistent schema with name, provider, type fields
  // This uniform structure means adding a new slot just requires adding another entry
  const families = new Set(providers.map(p => p.name.replace(/-\d+$/, '')));
  assert.ok(families.size >= 4,
    `Expected at least 4 slot families, found ${families.size}: ${[...families].join(', ')}`);

  // Every provider has the required fields for slot identity
  for (const p of providers) {
    assert.ok(p.name, `Provider missing name`);
    assert.ok(p.provider, `Provider ${p.name} missing provider field`);
    assert.ok(p.type, `Provider ${p.name} missing type field`);
    assert.match(p.name, /-\d+$/,
      `Provider name ${p.name} should follow family-N naming convention`);
  }
});
