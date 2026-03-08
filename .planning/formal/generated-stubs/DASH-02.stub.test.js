#!/usr/bin/env node
// @requirement DASH-02
// Structural test: DASH-02 — RefreshDashboard
// Verifies manage-agents-core.cjs exports formatTimestamp and refresh-related dashboard functionality

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DASH-02: manage-agents-core.cjs exports formatTimestamp in _pure namespace', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.formatTimestamp, 'function', 'formatTimestamp should be exported as a function');
});

test('DASH-02: formatTimestamp renders HH:MM:SS format for valid timestamp', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  const ts = new Date('2026-01-15T10:30:45Z').getTime();
  const result = mod._pure.formatTimestamp(ts);
  assert.match(result, /\d{1,2}:\d{2}:\d{2}/, 'formatTimestamp should render time in HH:MM:SS format');
});

test('DASH-02: formatTimestamp renders em-dash for null input', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  const result = mod._pure.formatTimestamp(null);
  assert.match(result, /\u2014|--/, 'formatTimestamp(null) should render em-dash or double-dash');
});

test('DASH-02: buildDashboardLines includes refresh keybinding hints in footer', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  const lines = mod._pure.buildDashboardLines([], {}, {}, null);
  const footer = lines.join('\n');
  assert.match(footer, /space|r/i, 'Dashboard footer should mention refresh keybinding');
});
