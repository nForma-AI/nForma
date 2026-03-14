#!/usr/bin/env node
'use strict';
// bin/adapters/qmuntal-stateless.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./qmuntal-stateless.cjs');

const fixture = `
package main
import "github.com/qmuntal/stateless"
const (
    stateIdle    = "idle"
    stateRunning = "running"
    stateDone    = "done"
    triggerStart = "start"
    triggerStop  = "stop"
    triggerDone  = "done"
)
func main() {
    sm := stateless.NewStateMachine(stateIdle)
    sm.Configure(stateIdle).Permit(triggerStart, stateRunning)
    sm.Configure(stateRunning).Permit(triggerStop, stateIdle).Permit(triggerDone, stateDone)
}
`;

test('adapter id is stateless', () => {
  assert.strictEqual(id, 'stateless');
});

test('detect returns high confidence for qmuntal/stateless Go code', () => {
  assert.ok(detect('main.go', fixture) >= 85);
});

test('detect returns 0 for Python code', () => {
  assert.strictEqual(detect('app.py', 'import sys'), 0);
});

test('extract parses qmuntal/stateless fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'stateless-test-' + Date.now() + '.go');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'stateless');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
