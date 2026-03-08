#!/usr/bin/env node
// @requirement PLCY-01
// Structural test: manage-agents-core.cjs exports timeout configuration functions
// Formal property: UpdatePolicy from quorum-policy.als — TimeoutPerSlot fact

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

test('PLCY-01 — manage-agents-core.cjs exports buildTimeoutChoices via _pure', () => {
  const mod = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.buildTimeoutChoices, 'function');
});

test('PLCY-01 — manage-agents-core.cjs exports validateTimeout via _pure', () => {
  const mod = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.validateTimeout, 'function');
});

test('PLCY-01 — manage-agents-core.cjs exports applyTimeoutUpdate via _pure', () => {
  const mod = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.applyTimeoutUpdate, 'function');
});

test('PLCY-01 — nForma.cjs TUI includes Tune Timeouts menu item', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/nForma.cjs'), 'utf8');
  assert.match(content, /Tune Timeouts/);
});

test('PLCY-01 — Alloy model defines TimeoutPerSlot fact', () => {
  const content = fs.readFileSync(path.join(ROOT, '.planning/formal/alloy/quorum-policy.als'), 'utf8');
  assert.match(content, /fact TimeoutPerSlot/);
  assert.match(content, /timeoutMs > 0/);
});
