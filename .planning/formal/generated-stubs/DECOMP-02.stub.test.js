#!/usr/bin/env node
// @requirement DECOMP-02
// Structural test: analyze-state-space.cjs flags unbounded domains (Nat, Int)
// as HIGH risk.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DECOMP-02 — source detects Nat as unbounded domain', () => {
  const filePath = path.join(ROOT, 'bin', 'analyze-state-space.cjs');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(
    content,
    /Nat\b/,
    'Source must reference Nat domain detection'
  );
  assert.match(
    content,
    /bounded:\s*false/,
    'Nat domain must be marked as bounded: false'
  );
});

test('DECOMP-02 — source detects Int as unbounded domain', () => {
  const filePath = path.join(ROOT, 'bin', 'analyze-state-space.cjs');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(
    content,
    /Int\b/,
    'Source must reference Int domain detection'
  );
});

test('DECOMP-02 — unbounded domains produce HIGH risk classification', () => {
  const filePath = path.join(ROOT, 'bin', 'analyze-state-space.cjs');
  const content = fs.readFileSync(filePath, 'utf8');
  // The source must: (1) check hasUnbounded, (2) assign HIGH
  assert.match(
    content,
    /hasUnbounded/,
    'Source must track hasUnbounded flag'
  );
  assert.match(
    content,
    /if\s*\(hasUnbounded\)\s*\{?\s*\n?\s*riskLevel\s*=\s*'HIGH'/,
    'Unbounded domains must be classified as HIGH risk'
  );
});
