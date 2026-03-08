#!/usr/bin/env node
// @requirement QUORUM-01
// Structural test: TypeOK invariant exists in QGSDQuorum.tla and QUORUM-01 is mapped in requirement-map

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('QUORUM-01: TypeOK invariant is defined in QGSDQuorum.tla', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDQuorum.tla'), 'utf8');
  assert.match(tla, /TypeOK\s*==/, 'TypeOK invariant definition must exist');
  assert.match(tla, /@requirement QUORUM-01/, 'QUORUM-01 requirement tag must be present');
});

test('QUORUM-01: TypeOK constrains phase to valid states', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDQuorum.tla'), 'utf8');
  assert.match(tla, /phase\s*\\in\s*\{.*IDLE.*COLLECTING_VOTES.*DELIBERATING.*DECIDED.*\}/, 'TypeOK must constrain phase to the four valid states');
});

test('QUORUM-01: requirement-map maps QUORUM-01 to tla:quorum-safety', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(path.join(ROOT, 'bin/requirement-map.cjs'));
  const safetyReqs = CHECK_ID_TO_REQUIREMENTS['tla:quorum-safety'];
  assert.ok(Array.isArray(safetyReqs), 'tla:quorum-safety must be an array');
  assert.ok(safetyReqs.includes('QUORUM-01'), 'QUORUM-01 must be in tla:quorum-safety');
});
