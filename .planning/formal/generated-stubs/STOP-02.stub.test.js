#!/usr/bin/env node
// @requirement STOP-02
// Verify: Stop hook checks stop_hook_active flag first — if true, exits 0 immediately
// Strategy: structural — assert the stop_hook_active guard is present and appears before other guards

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const stopHookPath = path.join(ROOT, 'hooks', 'nf-stop.js');

test('STOP-02: stop hook checks stop_hook_active flag', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // Must check input.stop_hook_active
  assert.match(content, /input\.stop_hook_active/,
    'Stop hook should check input.stop_hook_active');

  // Must exit(0) when stop_hook_active is true
  assert.match(content, /stop_hook_active[\s\S]*?process\.exit\(0\)/,
    'Stop hook should exit(0) when stop_hook_active is true');
});

test('STOP-02: stop_hook_active guard is the FIRST guard (infinite loop prevention)', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // The stop_hook_active check must appear before other guards
  // Find positions of GUARD 1 (stop_hook_active) and GUARD 2
  const guard1Pos = content.indexOf('stop_hook_active');
  const guard2Match = content.match(/GUARD\s*2/);

  assert.ok(guard1Pos !== -1, 'stop_hook_active guard must exist');
  assert.ok(guard2Match, 'GUARD 2 must exist (proving there are multiple guards)');

  const guard2Pos = guard2Match.index;
  assert.ok(guard1Pos < guard2Pos,
    'stop_hook_active (GUARD 1) must appear before GUARD 2 — it prevents infinite loops');
});

test('STOP-02: stop_hook_active is labeled as STOP-02 requirement', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // The guard should be documented with STOP-02 reference
  assert.match(content, /STOP-02/,
    'Stop hook should reference STOP-02 requirement in guard comment');
});
