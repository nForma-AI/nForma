#!/usr/bin/env node
'use strict';
// bin/adapters/xstate-v4.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./xstate-v4.cjs');

test('adapter id is xstate-v4', () => {
  assert.strictEqual(id, 'xstate-v4');
});

test('detect returns 0 for non-XState content', () => {
  assert.strictEqual(detect('app.py', 'from transitions import Machine'), 0);
});

test('extract parses v4-shaped machine object', () => {
  const fixture = `module.exports = { initial: "idle", states: { idle: { on: { START: { target: "running" } } }, running: { on: { STOP: { target: "idle" } } } }, context: {} };`;
  const tmpFile = path.join(os.tmpdir(), 'xstate-v4-test-' + Date.now() + '.js');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'xstate-v4');
    assert.strictEqual(ir.initial, 'idle');
    assert.deepStrictEqual(ir.stateNames.sort(), ['idle', 'running']);
    assert.strictEqual(ir.transitions.length, 2);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
