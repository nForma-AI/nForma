#!/usr/bin/env node
// @requirement PLAN-03
// Structural test: quorum-formal-context.cjs exports formal evidence generation functions
// Formal property: TypeOK from NFPreFilter.tla — filterRound, modelAgreement, autoResolved, filterPhase typed correctly

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

test('PLAN-03 — quorum-formal-context.cjs exports generateFormalSpecSummary', () => {
  const mod = require(path.join(ROOT, 'bin/quorum-formal-context.cjs'));
  assert.equal(typeof mod.generateFormalSpecSummary, 'function');
});

test('PLAN-03 — quorum-formal-context.cjs exports buildFormalEvidenceBlock', () => {
  const mod = require(path.join(ROOT, 'bin/quorum-formal-context.cjs'));
  assert.equal(typeof mod.buildFormalEvidenceBlock, 'function');
});

test('PLAN-03 — quorum-formal-context.cjs exports getFormalContext', () => {
  const mod = require(path.join(ROOT, 'bin/quorum-formal-context.cjs'));
  assert.equal(typeof mod.getFormalContext, 'function');
});

test('PLAN-03 — quorum-formal-context.cjs exports generateVerificationResult', () => {
  const mod = require(path.join(ROOT, 'bin/quorum-formal-context.cjs'));
  assert.equal(typeof mod.generateVerificationResult, 'function');
});

test('PLAN-03 — source references @requirement PLAN-03', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/quorum-formal-context.cjs'), 'utf8');
  assert.match(content, /PLAN-03/);
});

test('PLAN-03 — NFPreFilter.tla defines TypeOK invariant', () => {
  const content = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/NFPreFilter.tla'), 'utf8');
  assert.match(content, /TypeOK\s*==/);
  assert.match(content, /filterRound/);
  assert.match(content, /modelAgreement/);
  assert.match(content, /autoResolved/);
  assert.match(content, /filterPhase/);
});
