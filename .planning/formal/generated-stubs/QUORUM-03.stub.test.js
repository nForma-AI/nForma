#!/usr/bin/env node
// @requirement QUORUM-03
// Structural test: QuorumCeilingMet invariant exists in QGSDQuorum.tla and QUORUM-03 is mapped

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('QUORUM-03: QuorumCeilingMet invariant is defined in QGSDQuorum.tla', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDQuorum.tla'), 'utf8');
  assert.match(tla, /QuorumCeilingMet\s*==/, 'QuorumCeilingMet invariant definition must exist');
  assert.match(tla, /@requirement QUORUM-03/, 'QUORUM-03 requirement tag must be present');
});

test('QUORUM-03: QuorumCeilingMet enforces polledCount <= MaxSize when DECIDED', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDQuorum.tla'), 'utf8');
  assert.match(tla, /polledCount\s*<=\s*MaxSize/, 'QuorumCeilingMet must enforce polledCount <= MaxSize');
  assert.match(tla, /phase\s*=\s*"DECIDED"/, 'QuorumCeilingMet must reference DECIDED phase');
});

test('QUORUM-03: requirement-map maps QUORUM-03 to tla:quorum-safety', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(path.join(ROOT, 'bin/requirement-map.cjs'));
  const safetyReqs = CHECK_ID_TO_REQUIREMENTS['tla:quorum-safety'];
  assert.ok(Array.isArray(safetyReqs), 'tla:quorum-safety must be an array');
  assert.ok(safetyReqs.includes('QUORUM-03'), 'QUORUM-03 must be in tla:quorum-safety');
});
