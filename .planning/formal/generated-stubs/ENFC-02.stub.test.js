#!/usr/bin/env node
// @requirement ENFC-02
// Structural test: Block reason names oscillating file set, confirms breaker active,
// and lists allowed operations (read-only Bash)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('ENFC-02 — BuildBlockMessage: nf-circuit-breaker.js exports buildBlockReason', () => {
  const mod = require(path.join(ROOT, 'hooks', 'nf-circuit-breaker.js'));
  assert.equal(typeof mod.buildBlockReason, 'function', 'must export buildBlockReason');
});

test('ENFC-02 — BuildBlockMessage: block message structure includes all required sections', () => {
  const { buildBlockReason } = require(path.join(ROOT, 'hooks', 'nf-circuit-breaker.js'));
  const state = {
    file_set: ['src/engine.js', 'src/parser.js'],
    commit_window_snapshot: [['src/engine.js'], ['src/parser.js'], ['src/engine.js']],
  };
  const msg = buildBlockReason(state);

  // Must confirm circuit breaker is active
  assert.match(msg, /CIRCUIT BREAKER ACTIVE/, 'must state breaker is active');

  // Must name the oscillating file set
  assert.match(msg, /src\/engine\.js/, 'must list oscillating file');
  assert.match(msg, /src\/parser\.js/, 'must list oscillating file');

  // Must include commit graph table
  assert.match(msg, /Commit Graph/, 'must show commit graph');
  assert.match(msg, /Files Changed/, 'must have table header');

  // Must mention read-only allowed
  assert.match(msg, /[Rr]ead-only/, 'must mention read-only operations are allowed');
});

test('ENFC-02 — BuildBlockMessage: source code contains permissionDecision deny path', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-circuit-breaker.js'), 'utf8');
  assert.match(content, /permissionDecision:\s*'deny'/, 'must set permissionDecision to deny');
  assert.match(content, /buildBlockReason/, 'must use buildBlockReason for the deny reason');
});
