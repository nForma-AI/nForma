#!/usr/bin/env node
'use strict';
// bin/adapters/python-transitions.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./python-transitions.cjs');

const fixture = `
from transitions import Machine
states = ['idle', 'processing', 'done']
transitions = [
    { 'trigger': 'start', 'source': 'idle', 'dest': 'processing' },
    { 'trigger': 'finish', 'source': 'processing', 'dest': 'done' },
    { 'trigger': 'reset', 'source': 'done', 'dest': 'idle' }
]
machine = Machine(model, states=states, transitions=transitions, initial='idle')
`;

test('adapter id is py-transitions', () => {
  assert.strictEqual(id, 'py-transitions');
});

test('detect returns high confidence for Python transitions', () => {
  assert.ok(detect('app.py', fixture) >= 85);
});

test('detect returns 0 for JS content', () => {
  assert.strictEqual(detect('app.js', 'const x = 1;'), 0);
});

test('extract parses Python transitions fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'py-transitions-test-' + Date.now() + '.py');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'py-transitions');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
