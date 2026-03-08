#!/usr/bin/env node
// @requirement ARCH-01
// Structural test: all formal models declared in model-registry.json as
// single source of truth with provenance tracking.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/generate-formal-specs.cjs');

test('ARCH-01: generate-formal-specs.cjs exists', () => {
  assert.ok(fs.existsSync(SOURCE), 'bin/generate-formal-specs.cjs must exist');
});

test('ARCH-01: references model-registry.json for SSOT tracking', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /model-registry\.json/, 'must reference model-registry.json');
});

test('ARCH-01: includes updateModelRegistry function for provenance', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /updateModelRegistry/, 'must have updateModelRegistry function');
});

test('ARCH-01: tracks provenance with version and update_source', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /version/, 'must track version in registry');
  assert.match(content, /update_source/, 'must track update_source provenance');
});
