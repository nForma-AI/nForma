#!/usr/bin/env node
// @requirement NAV-02
// Structural test: Sessions module (F4) in nForma TUI embeds interactive Claude Code
// terminal sessions via blessed-xterm, with PTY-backed sessions and focus management

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NFORMA_PATH = path.resolve(__dirname, '../../../bin/nForma.cjs');

test('NAV-02 — Sessions module is defined with F4 hotkey', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /name:\s*'Sessions'/,
    'MODULES should include Sessions module');
  assert.match(content, /key:\s*'f4'/,
    'Sessions module should have f4 hotkey');
});

test('NAV-02 — blessed-xterm is required for terminal embedding', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /require\('blessed-xterm'\)/,
    'nForma.cjs should require blessed-xterm for terminal sessions');
});

test('NAV-02 — session creation action is available in Sessions module', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /action:\s*'session-new'/,
    'Sessions module should have a session-new action');
});

test('NAV-02 — session persistence is supported (load/save)', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /loadPersistedSessions/,
    'nForma.cjs should support loading persisted sessions');
  assert.match(content, /savePersistedSessions/,
    'nForma.cjs should support saving persisted sessions');
});

test('NAV-02 — focus management handles module switching from Sessions', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  // When leaving Sessions module, active terminal is hidden
  assert.match(content, /activeModuleIdx\s*===\s*3/,
    'nForma.cjs should handle Sessions module (index 3) focus management');
});

test('NAV-02 — node-pty native addon rebuild is handled gracefully', () => {
  const content = fs.readFileSync(NFORMA_PATH, 'utf8');
  assert.match(content, /node-pty/,
    'nForma.cjs should reference node-pty for PTY support');
  assert.match(content, /rebuild/i,
    'nForma.cjs should handle native addon rebuilds');
});
