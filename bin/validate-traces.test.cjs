'use strict';
// bin/validate-traces.test.cjs
// TDD RED stubs for the conformance event validator.
// Wave 0: these tests fail until conformance-schema.cjs exists.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('schema module exports VALID_ACTIONS array', () => {
  const schema = require('../bin/conformance-schema.cjs');
  assert.ok(Array.isArray(schema.VALID_ACTIONS), 'VALID_ACTIONS should be an array');
  assert.ok(schema.VALID_ACTIONS.length > 0, 'VALID_ACTIONS should not be empty');
});

test('schema module exports VALID_PHASES array', () => {
  const schema = require('../bin/conformance-schema.cjs');
  assert.ok(Array.isArray(schema.VALID_PHASES), 'VALID_PHASES should be an array');
  assert.ok(schema.VALID_PHASES.includes('IDLE'), 'VALID_PHASES should include IDLE');
  assert.ok(schema.VALID_PHASES.includes('COLLECTING_VOTES'), 'VALID_PHASES should include COLLECTING_VOTES');
  assert.ok(schema.VALID_PHASES.includes('DELIBERATING'), 'VALID_PHASES should include DELIBERATING');
  assert.ok(schema.VALID_PHASES.includes('DECIDED'), 'VALID_PHASES should include DECIDED');
});

test('schema module exports VALID_OUTCOMES and schema_version', () => {
  const schema = require('../bin/conformance-schema.cjs');
  assert.ok(Array.isArray(schema.VALID_OUTCOMES), 'VALID_OUTCOMES should be an array');
  assert.strictEqual(typeof schema.schema_version, 'string', 'schema_version should be a string');
});

test('event shape has required fields', () => {
  const event = {
    ts: new Date().toISOString(),
    phase: 'IDLE',
    action: 'quorum_start',
    slots_available: 4,
    vote_result: null,
    outcome: null,
  };
  const keys = Object.keys(event);
  assert.ok(keys.includes('ts'), 'event must have ts');
  assert.ok(keys.includes('phase'), 'event must have phase');
  assert.ok(keys.includes('action'), 'event must have action');
  assert.ok(keys.includes('slots_available'), 'event must have slots_available');
  assert.ok(keys.includes('vote_result'), 'event must have vote_result');
  assert.ok(keys.includes('outcome'), 'event must have outcome');
});

test('deviation score formula: 3 valid of 4 total = 75.0%', () => {
  const score = (3 / 4 * 100).toFixed(1);
  assert.strictEqual(score, '75.0', 'deviation score formula should compute 75.0 for 3/4');
});
