#!/usr/bin/env node
// @requirement QUORUM-02
// Structural test: ThresholdPasses assertion exists in quorum-votes.als and QUORUM-02 is mapped

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('QUORUM-02: ThresholdPasses assertion is defined in quorum-votes.als', () => {
  const als = fs.readFileSync(path.join(ROOT, '.planning/formal/alloy/quorum-votes.als'), 'utf8');
  assert.match(als, /assert\s+ThresholdPasses\s*\{/, 'ThresholdPasses assertion must exist');
  assert.match(als, /@requirement QUORUM-02/, 'QUORUM-02 requirement tag must be present');
});

test('QUORUM-02: ThresholdPasses checks unanimity implies UnanimityReached', () => {
  const als = fs.readFileSync(path.join(ROOT, '.planning/formal/alloy/quorum-votes.als'), 'utf8');
  assert.match(als, /UnanimityReached/, 'ThresholdPasses must reference UnanimityReached predicate');
  assert.match(als, /check\s+ThresholdPasses/, 'ThresholdPasses must be checked');
});

test('QUORUM-02: requirement-map maps QUORUM-02 to both tla and alloy specs', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(path.join(ROOT, 'bin/requirement-map.cjs'));
  const tlaSafety = CHECK_ID_TO_REQUIREMENTS['tla:quorum-safety'];
  const alloyVotes = CHECK_ID_TO_REQUIREMENTS['alloy:quorum-votes'];
  assert.ok(tlaSafety.includes('QUORUM-02'), 'QUORUM-02 must be in tla:quorum-safety');
  assert.ok(alloyVotes.includes('QUORUM-02'), 'QUORUM-02 must be in alloy:quorum-votes');
});
