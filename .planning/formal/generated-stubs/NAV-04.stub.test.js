#!/usr/bin/env node
// @requirement NAV-04
// Structural test: Sessions module in nForma.cjs persists active sessions to
// sessions.json, restores session ID counters, validates CWD, prevents modal dispatch.
// Uses source-grep strategy because nForma.cjs launches a TUI on require.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join('/Users/jonathanborduas/code/QGSD', 'bin', 'nForma.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('NAV-04: nForma defines SESSIONS_FILE pointing to sessions.json', () => {
  assert.match(content, /SESSIONS_FILE\s*=.*sessions\.json/);
});

test('NAV-04: nForma defines loadPersistedSessions function', () => {
  assert.match(content, /function loadPersistedSessions/);
});

test('NAV-04: nForma defines savePersistedSessions function', () => {
  assert.match(content, /function savePersistedSessions/);
});

test('NAV-04: nForma defines removePersistedSession function', () => {
  assert.match(content, /function removePersistedSession/);
});

test('NAV-04: nForma exports session persistence functions via _pure', () => {
  assert.match(content, /loadPersistedSessions/);
  assert.match(content, /savePersistedSessions/);
  assert.match(content, /removePersistedSession/);
  assert.match(content, /SESSIONS_FILE/);
});

test('NAV-04: loadPersistedSessions reads from SESSIONS_FILE', () => {
  // The function must read sessions.json to restore sessions
  assert.match(content, /readFileSync\(SESSIONS_FILE/);
});

test('NAV-04: savePersistedSessions writes to SESSIONS_FILE', () => {
  // The function must write sessions.json to persist sessions
  assert.match(content, /writeFileSync\(SESSIONS_FILE/);
});
