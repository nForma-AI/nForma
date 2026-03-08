#!/usr/bin/env node
// @requirement QUORUM-04
// Structural test: EventualConsensus liveness property exists in QGSDQuorum.tla and QUORUM-04 is mapped

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('QUORUM-04: EventualConsensus liveness property is defined in QGSDQuorum.tla', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDQuorum.tla'), 'utf8');
  assert.match(tla, /EventualConsensus\s*==\s*<>\(phase\s*=\s*"DECIDED"\)/, 'EventualConsensus must be a temporal liveness property reaching DECIDED');
  assert.match(tla, /@requirement QUORUM-04/, 'QUORUM-04 requirement tag must be present');
});

test('QUORUM-04: Spec includes weak fairness for convergence', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDQuorum.tla'), 'utf8');
  assert.match(tla, /WF_vars\(Decide\)/, 'Spec must include WF_vars(Decide) for liveness');
  assert.match(tla, /WF_vars\(StartQuorum\)/, 'Spec must include WF_vars(StartQuorum)');
});

test('QUORUM-04: requirement-map maps QUORUM-04 to tla:quorum-liveness', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(path.join(ROOT, 'bin/requirement-map.cjs'));
  const livenessReqs = CHECK_ID_TO_REQUIREMENTS['tla:quorum-liveness'];
  assert.ok(Array.isArray(livenessReqs), 'tla:quorum-liveness must be an array');
  assert.ok(livenessReqs.includes('QUORUM-04'), 'QUORUM-04 must be in tla:quorum-liveness');
});
