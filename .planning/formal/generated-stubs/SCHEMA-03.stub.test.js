#!/usr/bin/env node
// @requirement SCHEMA-03
// Structural test: verification runners emit requirement_ids in NDJSON output,
// extracted from requirement-map.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REQ_MAP_SRC = path.resolve(__dirname, '../../../bin/requirement-map.cjs');

test('SCHEMA-03: requirement-map.cjs exports CHECK_ID_TO_REQUIREMENTS', () => {
  const mod = require(REQ_MAP_SRC);
  assert.ok(mod.CHECK_ID_TO_REQUIREMENTS, 'must export CHECK_ID_TO_REQUIREMENTS');
  assert.equal(typeof mod.CHECK_ID_TO_REQUIREMENTS, 'object',
    'CHECK_ID_TO_REQUIREMENTS must be an object');
});

test('SCHEMA-03: requirement-map.cjs exports getRequirementIds function', () => {
  const mod = require(REQ_MAP_SRC);
  assert.equal(typeof mod.getRequirementIds, 'function',
    'must export getRequirementIds as a function');
});

test('SCHEMA-03: getRequirementIds returns string[] for known check_id', () => {
  const { getRequirementIds } = require(REQ_MAP_SRC);
  const ids = getRequirementIds('alloy:scoreboard');
  assert.ok(Array.isArray(ids), 'must return an array');
  assert.ok(ids.length > 0, 'alloy:scoreboard must have mapped requirement IDs');
  for (const id of ids) {
    assert.equal(typeof id, 'string', 'each requirement ID must be a string');
  }
});

test('SCHEMA-03: getRequirementIds returns empty array for unknown check_id', () => {
  const { getRequirementIds } = require(REQ_MAP_SRC);
  const ids = getRequirementIds('nonexistent:check');
  assert.ok(Array.isArray(ids), 'must return array even for unknown IDs');
  assert.equal(ids.length, 0, 'unknown check_id must return empty array (fail-open)');
});

test('SCHEMA-03: CHECK_ID_TO_REQUIREMENTS covers all runner types', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQ_MAP_SRC);
  const keys = Object.keys(CHECK_ID_TO_REQUIREMENTS);
  // Must have TLA+, Alloy, PRISM, and CI checks
  assert.ok(keys.some(k => k.startsWith('tla:')), 'must have tla: check IDs');
  assert.ok(keys.some(k => k.startsWith('alloy:')), 'must have alloy: check IDs');
  assert.ok(keys.some(k => k.startsWith('prism:')), 'must have prism: check IDs');
  assert.ok(keys.some(k => k.startsWith('ci:')), 'must have ci: check IDs');
});
