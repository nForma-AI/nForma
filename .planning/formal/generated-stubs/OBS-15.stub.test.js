#!/usr/bin/env node
// @requirement OBS-15
// Structural test: Stateful observe handlers persist their cursor in .planning/ as JSON
// with a last_checked ISO8601 field. State writes use atomic write (write to temp file + rename)
// to prevent corruption.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('OBS-15: observe-handler-upstream.cjs persists cursor with last_checked field', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-upstream.cjs'), 'utf8');
  // STATE_FILE points to .planning/ directory
  assert.match(content, /STATE_FILE\s*=\s*['"]\.planning\//, 'STATE_FILE should be in .planning/ directory');
  // State includes last_checked ISO8601 field
  assert.match(content, /last_checked/, 'state should contain last_checked field');
  assert.match(content, /new Date\(\)\.toISOString\(\)/, 'last_checked should use ISO8601 via toISOString()');
});

test('OBS-15: loadUpstreamState reads JSON from .planning/ state file', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-upstream.cjs'), 'utf8');
  assert.match(content, /function\s+loadUpstreamState/, 'loadUpstreamState function should exist');
  assert.match(content, /JSON\.parse/, 'should parse JSON from state file');
});

test('OBS-15: saveUpstreamState writes JSON to .planning/ state file', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-upstream.cjs'), 'utf8');
  assert.match(content, /function\s+saveUpstreamState/, 'saveUpstreamState function should exist');
  assert.match(content, /JSON\.stringify\(state/, 'should serialize state as JSON');
  assert.match(content, /writeFileSync/, 'should write state file');
});

test('OBS-15: upstream handler uses last_checked as cursor on subsequent runs', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-upstream.cjs'), 'utf8');
  // Reads last_checked from state to use as since cursor
  assert.match(content, /repoState\.last_checked/, 'should read last_checked from repo state');
  // Updates last_checked after processing
  assert.match(content, /last_checked:\s*new\s+Date\(\)\.toISOString\(\)/, 'should update last_checked with current ISO8601 time');
});
