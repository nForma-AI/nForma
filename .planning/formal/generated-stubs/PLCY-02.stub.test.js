#!/usr/bin/env node
// @requirement PLCY-02
// Structural test: manage-agents-core.cjs exports update policy validation (auto/prompt/skip)
// Formal property: UpdatePolicy from quorum-policy.als — PolicyPerSlot fact

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');

test('PLCY-02 — manage-agents-core.cjs exports validateUpdatePolicy via _pure', () => {
  const mod = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  assert.equal(typeof mod._pure.validateUpdatePolicy, 'function');
});

test('PLCY-02 — validateUpdatePolicy accepts auto, prompt, skip', () => {
  const { _pure: { validateUpdatePolicy } } = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  for (const policy of ['auto', 'prompt', 'skip']) {
    const result = validateUpdatePolicy(policy);
    assert.ok(result.valid, `validateUpdatePolicy('${policy}') should be valid`);
  }
});

test('PLCY-02 — validateUpdatePolicy rejects invalid policies', () => {
  const { _pure: { validateUpdatePolicy } } = require(path.join(ROOT, 'bin/manage-agents-core.cjs'));
  const result = validateUpdatePolicy('invalid');
  assert.equal(result.valid, false);
});

test('PLCY-02 — nForma.cjs TUI includes Set Update Policy menu item', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/nForma.cjs'), 'utf8');
  assert.match(content, /Set Update Policy/);
  assert.match(content, /update-policy/);
});

test('PLCY-02 — Alloy model defines PolicyPerSlot with Auto + Prompt + Skip', () => {
  const content = fs.readFileSync(path.join(ROOT, '.planning/formal/alloy/quorum-policy.als'), 'utf8');
  assert.match(content, /fact PolicyPerSlot/);
  assert.match(content, /Auto \+ Prompt \+ Skip/);
});
