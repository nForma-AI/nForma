#!/usr/bin/env node
// @requirement ENFC-01
// Behavioral test: When circuit breaker is active, hook returns permissionDecision:'deny'

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { buildBlockReason } = require(path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-circuit-breaker.js'));

test('ENFC-01 — BlockDecision: buildBlockReason returns deny-style block message', () => {
  const state = {
    file_set: ['src/foo.js', 'src/bar.js'],
    commit_window_snapshot: [['src/foo.js'], ['src/bar.js'], ['src/foo.js']],
  };
  const reason = buildBlockReason(state);
  assert.equal(typeof reason, 'string', 'buildBlockReason must return a string');
  assert.match(reason, /CIRCUIT BREAKER ACTIVE/, 'block reason must indicate breaker is active');
});

test('ENFC-01 — BlockDecision: block message names the oscillating file set', () => {
  const state = {
    file_set: ['hooks/nf-stop.js'],
    commit_window_snapshot: [],
  };
  const reason = buildBlockReason(state);
  assert.match(reason, /hooks\/nf-stop\.js/, 'block reason must name the oscillating files');
});

test('ENFC-01 — BlockDecision: block message mentions read-only operations allowed', () => {
  const state = {
    file_set: ['a.js'],
    commit_window_snapshot: [['a.js'], ['a.js']],
  };
  const reason = buildBlockReason(state);
  assert.match(reason, /[Rr]ead-only/, 'block reason must mention read-only operations are allowed');
});
