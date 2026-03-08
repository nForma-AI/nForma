#!/usr/bin/env node
// @requirement DECOMP-03
// Structural test: generate-traceability-matrix.cjs validates that no
// requirement loses coverage when a model is split into sub-models.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DECOMP-03 — traceability matrix source contains coverage regression detection', () => {
  const filePath = path.join(ROOT, 'bin', 'generate-traceability-matrix.cjs');
  const content = fs.readFileSync(filePath, 'utf8');

  // Must detect when current coverage < baseline coverage
  assert.match(
    content,
    /currentCount\s*<\s*baselineCount/,
    'Source must compare current vs baseline property counts'
  );
});

test('DECOMP-03 — regression detection tracks lost coverage count', () => {
  const filePath = path.join(ROOT, 'bin', 'generate-traceability-matrix.cjs');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.match(
    content,
    /lost_count/,
    'Source must track lost_count in regressions'
  );
  assert.match(
    content,
    /regressions/,
    'Source must collect regressions array'
  );
});

test('DECOMP-03 — regression output references model split as possible cause', () => {
  const filePath = path.join(ROOT, 'bin', 'generate-traceability-matrix.cjs');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.match(
    content,
    /model split dropped coverage/,
    'Regression detail must mention model split as possible cause'
  );
});

test('DECOMP-03 — validateBidirectionalLinks function exists for cross-validation', () => {
  const filePath = path.join(ROOT, 'bin', 'generate-traceability-matrix.cjs');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.match(
    content,
    /function\s+validateBidirectionalLinks/,
    'Source must define validateBidirectionalLinks function'
  );
});
