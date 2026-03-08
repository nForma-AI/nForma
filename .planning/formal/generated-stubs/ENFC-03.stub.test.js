#!/usr/bin/env node
// @requirement ENFC-03
// Structural test for BuildBlockMessage invariant from QGSDEnforcement.tla
// Verifies that the circuit breaker's buildBlockReason contains RCA instructions
// and instructs manual commit (per TLA+ BuildBlockMessage action).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cbPath = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');

test('ENFC-03: buildBlockReason is exported from nf-circuit-breaker.js', () => {
  const mod = require(cbPath);
  assert.ok(typeof mod.buildBlockReason === 'function',
    'buildBlockReason must be an exported function');
});

test('ENFC-03: buildBlockReason instructs root cause analysis', () => {
  const { buildBlockReason } = require(cbPath);
  const msg = buildBlockReason({ file_set: ['foo.js'], commit_window_snapshot: [] });
  assert.match(msg, /root.cause/i,
    'Block message must instruct root cause analysis');
});

test('ENFC-03: buildBlockReason instructs manual commit', () => {
  const { buildBlockReason } = require(cbPath);
  const msg = buildBlockReason({ file_set: ['foo.js'], commit_window_snapshot: [] });
  assert.match(msg, /manually commit/i,
    'Block message must instruct user to manually commit the fix');
});

test('ENFC-03: source code contains root cause and manual commit instructions', () => {
  const content = fs.readFileSync(cbPath, 'utf8');
  assert.match(content, /root.cause/i,
    'Source must contain root cause reference');
  assert.match(content, /manually commit/i,
    'Source must contain manual commit instruction');
});
