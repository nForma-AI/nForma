#!/usr/bin/env node
// @requirement ARCH-02
// Structural test: promote-model.cjs provides atomic promotion from per-phase
// specs to canonical specs with duplicate detection.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/promote-model.cjs');

test('ARCH-02: promote-model.cjs exists', () => {
  assert.ok(fs.existsSync(SOURCE), 'bin/promote-model.cjs must exist');
});

test('ARCH-02: implements atomic write pattern (tmp+rename)', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Atomic writes use a temporary file then rename
  assert.match(content, /rename/, 'must use rename for atomic writes');
});

test('ARCH-02: includes duplicate detection logic', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /duplicate/i, 'must include duplicate detection');
});

test('ARCH-02: updates model-registry.json after promotion', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /model-registry\.json/, 'must update model-registry.json');
});
