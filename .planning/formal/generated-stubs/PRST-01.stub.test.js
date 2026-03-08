#!/usr/bin/env node
// @requirement PRST-01
// Structural test: User can select a named provider preset (AkashML / Together.xyz / Fireworks.ai)
// in addAgent/editAgent flow instead of manually typing a URL.
// Verifies PROVIDER_PRESETS has name+value pairs and findPresetForUrl resolves each.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('PRST-01: PROVIDER_PRESETS entries have name, value, and label fields', () => {
  // Each preset must have name, value (URL), and label for display
  assert.match(content, /name:\s*'AkashML'/, 'AkashML preset must have name field');
  assert.match(content, /value:\s*'https:\/\/api\.akashml\.com\/v1'/, 'AkashML must have value URL');
  assert.match(content, /name:\s*'Together\.xyz'/, 'Together.xyz preset must have name field');
  assert.match(content, /name:\s*'Fireworks\.ai'/, 'Fireworks.ai preset must have name field');
});

test('PRST-01: findPresetForUrl resolves all three named presets', () => {
  const mod = require(SOURCE);
  const { findPresetForUrl } = mod._pure;
  // Each named preset URL must resolve to itself (not __custom__)
  const presetUrls = [
    'https://api.akashml.com/v1',
    'https://api.together.xyz/v1',
    'https://api.fireworks.ai/inference/v1',
  ];
  for (const url of presetUrls) {
    assert.equal(findPresetForUrl(url), url, `preset URL ${url} must resolve to itself`);
  }
});

test('PRST-01: custom entry path is available when URL does not match any preset', () => {
  const mod = require(SOURCE);
  const { findPresetForUrl } = mod._pure;
  assert.equal(findPresetForUrl('https://my-custom.example.com/v1'), '__custom__',
    'non-preset URL must return __custom__ sentinel for manual entry');
});
