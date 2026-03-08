#!/usr/bin/env node
// @requirement NAV-01
// Structural test: Main TUI menu organized into 3+ modules (Agents, Reqs, Config)
// with activity bar sidebar, F1/F2/F3 hotkeys, and Tab cycling

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NFORMA_PATH = path.resolve(__dirname, '../../../bin/nForma.cjs');

test('NAV-01 — nForma.cjs defines MODULES array with Agents, Reqs, Config', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /const\s+MODULES\s*=\s*\[/,
    'nForma.cjs should define a MODULES array');
  assert.match(content, /name:\s*'Agents'/,
    'MODULES should include Agents module');
  assert.match(content, /name:\s*'Reqs'/,
    'MODULES should include Reqs module');
  assert.match(content, /name:\s*'Config'/,
    'MODULES should include Config module');
});

test('NAV-01 — modules are mapped to F1/F2/F3 hotkeys', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /key:\s*'f1'/,
    'Agents module should have f1 hotkey');
  assert.match(content, /key:\s*'f2'/,
    'Reqs module should have f2 hotkey');
  assert.match(content, /key:\s*'f3'/,
    'Config module should have f3 hotkey');
});

test('NAV-01 — activity bar displays F-key hints', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  // The TUI renders key hints like [F1] A  [F2] R  [F3] C
  assert.match(content, /\[F1\]/,
    'Activity bar should show [F1] hint');
  assert.match(content, /\[F2\]/,
    'Activity bar should show [F2] hint');
  assert.match(content, /\[F3\]/,
    'Activity bar should show [F3] hint');
});

test('NAV-01 — Tab cycling is supported for module switching', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  // Tab hint is shown in the key hints bar
  assert.match(content, /\[Tab\].*cycle/,
    'Activity bar should show [Tab] cycle hint');
});

test('NAV-01 — activeModuleIdx tracks current module selection', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /activeModuleIdx/,
    'nForma.cjs should track active module via activeModuleIdx');
});
