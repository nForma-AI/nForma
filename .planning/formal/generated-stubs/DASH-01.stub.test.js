#!/usr/bin/env node
// @requirement DASH-01
// Structural test: DASH-01 — OpenDashboard
// Verifies manage-agents-core.cjs exports buildDashboardLines for live health dashboard

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DASH-01: manage-agents-core.cjs exports buildDashboardLines in _pure namespace', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.buildDashboardLines, 'function', 'buildDashboardLines should be exported as a function');
});

test('DASH-01: buildDashboardLines renders header with dashboard title', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  const lines = mod._pure.buildDashboardLines([], {}, {}, null);
  const header = lines.join('\n');
  assert.match(header, /Dashboard/i, 'Dashboard header should contain "Dashboard"');
});

test('DASH-01: buildDashboardLines accepts slots, mcpServers, healthMap, lastUpdated params', () => {
  const mod = require(path.join(ROOT, 'bin', 'manage-agents-core.cjs'));
  assert.equal(mod._pure.buildDashboardLines.length, 4, 'buildDashboardLines should accept 4 parameters');
});
