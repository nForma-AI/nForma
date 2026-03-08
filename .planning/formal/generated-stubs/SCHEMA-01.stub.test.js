#!/usr/bin/env node
// @requirement SCHEMA-01
// Structural test: model-registry.json entries gain a requirements array (string[])
// listing the requirement IDs each model covers

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REGISTRY_PATH = path.resolve(__dirname, '../../../.planning/formal/model-registry.json');

test('SCHEMA-01: model-registry.json exists and is valid JSON', () => {
  assert.ok(fs.existsSync(REGISTRY_PATH), 'model-registry.json must exist');
  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  assert.ok(data.models && typeof data.models === 'object', 'must have models object');
});

test('SCHEMA-01: model entries with requirements field have string[] values', () => {
  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const models = data.models;
  const entries = Object.entries(models);
  assert.ok(entries.length > 0, 'registry must have at least one model entry');

  let withReqs = 0;
  for (const [modelPath, entry] of entries) {
    if ('requirements' in entry) {
      withReqs++;
      assert.ok(Array.isArray(entry.requirements),
        `model ${modelPath} requirements must be an array`);
      for (const reqId of entry.requirements) {
        assert.equal(typeof reqId, 'string',
          `requirement IDs in ${modelPath} must be strings`);
      }
    }
  }
  // Majority of entries should have requirements (seeded from traceability map)
  assert.ok(withReqs > entries.length / 2,
    `majority of models should have requirements field (found ${withReqs}/${entries.length})`);
});

test('SCHEMA-01: at least one model has non-empty requirements array', () => {
  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const hasReqs = Object.values(data.models).some(
    entry => Array.isArray(entry.requirements) && entry.requirements.length > 0
  );
  assert.ok(hasReqs, 'at least one model must have populated requirements');
});
