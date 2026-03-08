#!/usr/bin/env node
// @requirement QUORUM-05
// Structural test: RevisePosition action and deliberation revision invariants in QGSDDeliberationRevision.tla

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('QUORUM-05: RevisePosition action is defined in QGSDDeliberationRevision.tla', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDDeliberationRevision.tla'), 'utf8');
  assert.match(tla, /RevisePosition\(v\)\s*==/, 'RevisePosition action must be defined');
  assert.match(tla, /@requirement QUORUM-05/, 'QUORUM-05 requirement tag must be present');
});

test('QUORUM-05: RevisePosition requires peer review of all other voters', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDDeliberationRevision.tla'), 'utf8');
  assert.match(tla, /reviewedPeers\[v\]\s*=\s*Voters\s*\\\s*\{v\}/, 'RevisePosition must require reviewing all peers before revision');
});

test('QUORUM-05: NoFrozenPositions invariant prevents stale positions', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDDeliberationRevision.tla'), 'utf8');
  assert.match(tla, /NoFrozenPositions\s*==/, 'NoFrozenPositions invariant must exist');
  assert.match(tla, /lastRevised\[v\]\s*>=\s*round\s*-\s*1/, 'NoFrozenPositions must check lastRevised is recent');
});

test('QUORUM-05: AllVotersReviseBeforeAdvance temporal property exists', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDDeliberationRevision.tla'), 'utf8');
  assert.match(tla, /AllVotersReviseBeforeAdvance\s*==/, 'AllVotersReviseBeforeAdvance must be defined');
});

test('QUORUM-05: PeerReviewBeforeRevision temporal property exists', () => {
  const tla = fs.readFileSync(path.join(ROOT, '.planning/formal/tla/QGSDDeliberationRevision.tla'), 'utf8');
  assert.match(tla, /PeerReviewBeforeRevision\s*==/, 'PeerReviewBeforeRevision must be defined');
});
