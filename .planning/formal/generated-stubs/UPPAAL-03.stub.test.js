#!/usr/bin/env node
// @requirement UPPAAL-03
// Test: Model surfaces two critical measurement points as annotated properties:
// (a) minimum inter-slot response gap preventing race conditions (MIN_GAP_MS)
// (b) maximum timeout for quorum consensus before planning gate deadline (TIMEOUT_MS)
// Constant strategy: verify run-uppaal.cjs defines both measurement constants.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runUppaalSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'bin', 'run-uppaal.cjs'), 'utf8'
);

test('UPPAAL-03: run-uppaal.cjs defines DEFAULT_MIN_GAP_MS (minimum inter-slot gap)', () => {
  assert.match(runUppaalSrc, /DEFAULT_MIN_GAP_MS\s*=\s*\d+/,
    'Must define DEFAULT_MIN_GAP_MS constant for minimum inter-slot response gap');
});

test('UPPAAL-03: run-uppaal.cjs defines DEFAULT_TIMEOUT_MS (maximum timeout for consensus)', () => {
  assert.match(runUppaalSrc, /DEFAULT_TIMEOUT_MS\s*=\s*\d+/,
    'Must define DEFAULT_TIMEOUT_MS constant for maximum quorum consensus timeout');
});

test('UPPAAL-03: run-uppaal.cjs passes MIN_GAP_MS to verifyta as -C constant', () => {
  assert.ok(runUppaalSrc.includes('MIN_GAP_MS='),
    'Must pass MIN_GAP_MS to verifyta via -C flag for model parameterization');
});

test('UPPAAL-03: run-uppaal.cjs passes TIMEOUT_MS to verifyta as -C constant', () => {
  assert.ok(runUppaalSrc.includes('TIMEOUT_MS='),
    'Must pass TIMEOUT_MS to verifyta via -C flag for model parameterization');
});

test('UPPAAL-03: uppaal:quorum-races maps to UPPAAL-03 requirement', () => {
  const { getRequirementIds } = require('../../../bin/requirement-map.cjs');
  const reqIds = getRequirementIds('uppaal:quorum-races');
  assert.ok(reqIds.includes('UPPAAL-03'), 'UPPAAL-03 must be in uppaal:quorum-races requirement IDs');
});
