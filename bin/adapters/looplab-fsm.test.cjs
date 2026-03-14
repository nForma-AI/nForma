#!/usr/bin/env node
'use strict';
// bin/adapters/looplab-fsm.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./looplab-fsm.cjs');

const fixture = `
package main
import "github.com/looplab/fsm"
func main() {
    f := fsm.NewFSM("idle",
        fsm.Events{
            {Name: "start", Src: []string{"idle"}, Dst: "running"},
            {Name: "stop", Src: []string{"running"}, Dst: "idle"},
            {Name: "finish", Src: []string{"running"}, Dst: "done"},
        },
        fsm.Callbacks{},
    )
}
`;

test('adapter id is looplab-fsm', () => {
  assert.strictEqual(id, 'looplab-fsm');
});

test('detect returns high confidence for looplab/fsm Go code', () => {
  assert.ok(detect('main.go', fixture) >= 85);
});

test('detect returns 0 for Python code', () => {
  assert.strictEqual(detect('app.py', 'import sys'), 0);
});

test('extract parses looplab/fsm fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'looplab-test-' + Date.now() + '.go');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'looplab-fsm');
    assert.strictEqual(ir.initial, 'idle');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
