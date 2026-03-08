#!/usr/bin/env node
// @requirement ARCH-03
// Structural test: accept-debug-invariant.cjs writes debug-discovered invariants
// directly to canonical specs with session provenance.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/accept-debug-invariant.cjs');

test('ARCH-03: accept-debug-invariant.cjs exists', () => {
  assert.ok(fs.existsSync(SOURCE), 'bin/accept-debug-invariant.cjs must exist');
});

test('ARCH-03: accepts --session-id CLI argument for provenance', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /--session-id/, 'must accept --session-id argument');
});

test('ARCH-03: accepts --property-name and --property-body arguments', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /--property-name/, 'must accept --property-name');
  assert.match(content, /--property-body/, 'must accept --property-body');
});

test('ARCH-03: records debug update_source in model-registry', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /update_source/, 'must track update_source');
  assert.match(content, /debug/, 'must record debug as source type');
});
