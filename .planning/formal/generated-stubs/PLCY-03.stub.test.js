#!/usr/bin/env node
// @requirement PLCY-03
// Structural test: manage-agents-core.cjs exports runAutoUpdateCheck for auto-policy slots
// Formal property: UpdatePolicy from quorum-policy.als — AutoCheckable fact

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

test('PLCY-03 — manage-agents-core.cjs exports runAutoUpdateCheck via _pure', () => {
  const mod = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.runAutoUpdateCheck, 'function');
});

test('PLCY-03 — nForma.cjs calls runAutoUpdateCheck on startup', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/nForma.cjs'), 'utf8');
  assert.match(content, /runAutoUpdateCheck\(\)/, 'nForma.cjs must invoke runAutoUpdateCheck() on startup');
});

test('PLCY-03 — Alloy model defines AutoCheckable fact (auto => active)', () => {
  const content = fs.readFileSync(path.join(ROOT, '.planning/formal/alloy/quorum-policy.als'), 'utf8');
  assert.match(content, /fact AutoCheckable/);
  assert.match(content, /updatePolicy = Auto implies/);
});
