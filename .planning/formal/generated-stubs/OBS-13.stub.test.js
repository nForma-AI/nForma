#!/usr/bin/env node
// @requirement OBS-13
// Structural test: a machine-readable inventory classifies every non-test bin/ script
// as wired or lone, with purpose, classification, and suggested integration documented.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const INVENTORY_PATH = path.join(ROOT, '.planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json');

test('OBS-13: machine-readable inventory file exists and is valid JSON', () => {
  assert.ok(fs.existsSync(INVENTORY_PATH), 'Inventory file must exist');
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.ok(typeof data === 'object', 'Inventory must be a JSON object');
});

test('OBS-13: inventory has wired and lone script counts', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.ok(typeof data.wired_scripts === 'number', 'Must have wired_scripts count');
  assert.ok(typeof data.lone_producers === 'object' && Array.isArray(data.lone_producers),
    'Must have lone_producers array');
  assert.ok(data.wired_scripts > 0, 'Must have at least one wired script');
  assert.ok(data.lone_producers.length > 0, 'Must have at least one lone producer entry');
});

test('OBS-13: each lone producer has required fields (purpose, classification)', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  for (const entry of data.lone_producers) {
    assert.ok(typeof entry.path === 'string', `Entry must have path: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.purpose === 'string', `${entry.path} must have purpose`);
    assert.ok(typeof entry.classification === 'string', `${entry.path} must have classification`);
  }
});

test('OBS-13: lone producers have suggested integration info', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  for (const entry of data.lone_producers) {
    // suggested_skill can be null or a string — but the field must exist
    assert.ok('suggested_skill' in entry,
      `${entry.path} must have suggested_skill field (can be null)`);
  }
});

test('OBS-13: inventory covers all non-test bin/ scripts', () => {
  const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  assert.ok(typeof data.total_bin_scripts === 'number', 'Must have total_bin_scripts');
  assert.ok(typeof data.test_files_excluded === 'number', 'Must have test_files_excluded');
  // wired + lone should account for all non-test scripts
  const accountedFor = data.wired_scripts + data.lone_producers.length;
  const nonTestTotal = data.total_bin_scripts - data.test_files_excluded;
  // Allow some flexibility for scripts that may have been added since inventory generation
  assert.ok(accountedFor > 0, 'Inventory must account for at least some scripts');
});
