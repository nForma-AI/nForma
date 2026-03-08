#!/usr/bin/env node
// @requirement UPPAAL-01
// Test: UPPAAL timed automaton model captures concurrency structure of quorum protocol
// using empirical timing from check-results.ndjson, not hardcoded constants.
// Behavioral: verify requirement-map maps uppaal:quorum-races to UPPAAL-01 requirement ID.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getRequirementIds, CHECK_ID_TO_REQUIREMENTS } = require('../../../bin/requirement-map.cjs');

test('UPPAAL-01: uppaal:quorum-races check_id maps to UPPAAL-01 requirement', () => {
  const reqIds = getRequirementIds('uppaal:quorum-races');
  assert.ok(Array.isArray(reqIds), 'getRequirementIds should return an array');
  assert.ok(reqIds.includes('UPPAAL-01'), 'UPPAAL-01 must be in uppaal:quorum-races requirement IDs');
});

test('UPPAAL-01: getRequirementIds returns a copy (not the original)', () => {
  const first = getRequirementIds('uppaal:quorum-races');
  const second = getRequirementIds('uppaal:quorum-races');
  assert.notStrictEqual(first, second, 'Each call should return a new array copy');
  assert.deepStrictEqual(first, second, 'Contents should be identical');
});

test('UPPAAL-01: uppaal:quorum-races entry exists in CHECK_ID_TO_REQUIREMENTS', () => {
  assert.ok('uppaal:quorum-races' in CHECK_ID_TO_REQUIREMENTS,
    'uppaal:quorum-races must be a registered check_id');
});
