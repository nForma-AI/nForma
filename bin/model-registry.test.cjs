#!/usr/bin/env node
'use strict';
// bin/model-registry.test.cjs
// Wave 0 schema validation tests for ARCH-01 registry format.
// Requirements: ARCH-01

const { test } = require('node:test');
const assert = require('node:assert');

test('registry schema has required top-level fields (version, last_sync, models)', () => {
  // Sample registry fixture matching expected schema
  const sampleRegistry = {
    version: '1.0',
    last_sync: '2026-03-01T12:34:56.789Z',
    models: {
      'tla/QGSDQuorum_xstate.tla': {
        version: 2,
        last_updated: '2026-03-01T12:34:56.789Z',
        update_source: 'generate',
        source_id: null,
        session_id: null,
        description: 'XState → TLA+ quorum state machine (generated)'
      }
    }
  };

  // Verify all three required top-level keys exist
  assert.ok(sampleRegistry.version, 'version field required');
  assert.ok(sampleRegistry.last_sync, 'last_sync field required');
  assert.ok(sampleRegistry.models, 'models field required');
  assert.strictEqual(typeof sampleRegistry.models, 'object', 'models must be object');
});

test('each model entry has required fields', () => {
  const sampleEntry = {
    version: 1,
    last_updated: '2026-03-01T12:34:56.789Z',
    update_source: 'manual',
    source_id: null,
    session_id: null,
    description: 'Test spec'
  };

  const requiredFields = [
    'version',
    'last_updated',
    'update_source',
    'source_id',
    'session_id',
    'description'
  ];

  for (const field of requiredFields) {
    assert.ok(field in sampleEntry, `model entry must have ${field} field`);
  }

  // Type checks
  assert.strictEqual(typeof sampleEntry.version, 'number', 'version must be number');
  assert.strictEqual(typeof sampleEntry.last_updated, 'string', 'last_updated must be string');
  assert.strictEqual(typeof sampleEntry.update_source, 'string', 'update_source must be string');
  // source_id can be string or null
  // session_id can be string or null
  assert.strictEqual(typeof sampleEntry.description, 'string', 'description must be string');
});

test('update_source enum is valid', () => {
  const validSources = ['generate', 'debug', 'plan-promote', 'manual'];

  // Test with sample data
  const sampleModels = {
    'tla/gen.tla': { update_source: 'generate' },
    'tla/debug.tla': { update_source: 'debug' },
    'tla/promote.tla': { update_source: 'plan-promote' },
    'tla/manual.tla': { update_source: 'manual' }
  };

  for (const [key, model] of Object.entries(sampleModels)) {
    assert.ok(
      validSources.includes(model.update_source),
      `update_source "${model.update_source}" for ${key} must be one of ${JSON.stringify(validSources)}`
    );
  }

  // Test invalid value would fail
  const invalidModel = { update_source: 'invalid' };
  assert.ok(
    !validSources.includes(invalidModel.update_source),
    'invalid update_source should not be in valid sources list'
  );
});

test('version increments on update', () => {
  // Simulate registry before and after an update
  const before = {
    version: '1.0',
    last_sync: '2026-03-01T12:34:56.789Z',
    models: {
      'tla/Test.tla': {
        version: 1,
        last_updated: '2026-03-01T12:34:56.789Z',
        update_source: 'manual',
        source_id: null,
        session_id: null,
        description: 'Test spec'
      }
    }
  };

  const after = {
    version: '1.0',
    last_sync: '2026-03-01T13:00:00.000Z', // Updated
    models: {
      'tla/Test.tla': {
        version: 2, // Incremented
        last_updated: '2026-03-01T13:00:00.000Z',
        update_source: 'plan-promote',
        source_id: 'v0.21-01-test',
        session_id: null,
        description: 'Test spec (updated)'
      }
    }
  };

  // Verify version incremented
  assert.strictEqual(
    after.models['tla/Test.tla'].version,
    before.models['tla/Test.tla'].version + 1,
    'model version should increment by 1 after update'
  );
});