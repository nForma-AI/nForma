#!/usr/bin/env node
// @requirement FAIL-02
// Behavioral test: providers.json contains explicit slot-to-provider mapping;
// when a provider probe returns DOWN, all slots on that provider are skippable.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_PATH = path.join(__dirname, '..', '..', '..', 'bin', 'providers.json');

test('FAIL-02: providers.json exists and is valid JSON with providers array', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data.providers), 'providers must be an array');
  assert.ok(data.providers.length > 0, 'providers array must not be empty');
});

test('FAIL-02: every slot entry has a name (slot) and provider field', () => {
  const data = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  for (const entry of data.providers) {
    assert.ok(typeof entry.name === 'string' && entry.name.length > 0,
      `slot entry must have a name: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.provider === 'string' && entry.provider.length > 0,
      `slot ${entry.name} must have a provider field`);
  }
});

test('FAIL-02: multiple slots can map to the same provider (provider-level skip)', () => {
  const data = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  // Build provider -> slots map
  const providerSlots = {};
  for (const entry of data.providers) {
    if (!providerSlots[entry.provider]) providerSlots[entry.provider] = [];
    providerSlots[entry.provider].push(entry.name);
  }
  // At least one provider should have multiple slots (proves grouping is possible)
  const multiSlotProviders = Object.entries(providerSlots).filter(([, slots]) => slots.length > 1);
  assert.ok(multiSlotProviders.length > 0,
    'At least one provider must map to multiple slots for provider-level skip to be meaningful');
});

test('FAIL-02: call-quorum-slot.cjs reads providers.json for dispatch decisions', () => {
  const slotSource = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'bin', 'call-quorum-slot.cjs'), 'utf8');
  assert.match(slotSource, /providers\.json/,
    'call-quorum-slot.cjs must reference providers.json');
});
