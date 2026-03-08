#!/usr/bin/env node
// @requirement PROV-02
// Structural test: Wizard offers curated provider list (AkashML, Together.xyz, Fireworks) + custom entry
// Verifies PROVIDER_PRESETS constant contains the three known providers.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../../bin/manage-agents-core.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('PROV-02: PROVIDER_PRESETS array is defined with three curated providers', () => {
  assert.match(content, /PROVIDER_PRESETS\s*=\s*\[/, 'PROVIDER_PRESETS must be a defined array');
  assert.match(content, /AkashML/, 'AkashML must appear in PROVIDER_PRESETS');
  assert.match(content, /Together\.xyz/, 'Together.xyz must appear in PROVIDER_PRESETS');
  assert.match(content, /Fireworks\.ai/, 'Fireworks.ai must appear in PROVIDER_PRESETS');
});

test('PROV-02: PROVIDER_PRESETS contains correct base URLs', () => {
  assert.match(content, /api\.akashml\.com\/v1/, 'AkashML URL must be present');
  assert.match(content, /api\.together\.xyz\/v1/, 'Together.xyz URL must be present');
  assert.match(content, /api\.fireworks\.ai\/inference\/v1/, 'Fireworks.ai URL must be present');
});

test('PROV-02: findPresetForUrl supports custom entry via __custom__ sentinel', () => {
  const mod = require(SOURCE);
  const { findPresetForUrl } = mod._pure;
  // Custom URL returns __custom__ sentinel, enabling custom entry path
  assert.equal(findPresetForUrl('https://custom.example.com/v1'), '__custom__');
});
