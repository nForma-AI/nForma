#!/usr/bin/env node
// @requirement DECOMP-01
// Constant test: analyze-state-space.cjs risk thresholds match formal spec
// RiskLevel: MINIMAL <= 1000, LOW <= 100000, MODERATE <= 10000000, else HIGH

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DECOMP-01 — risk threshold constants match formal spec values', () => {
  // Read source directly to extract the constant values
  const filePath = path.join(ROOT, 'bin', 'analyze-state-space.cjs');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify the DEFAULT_THRESHOLDS constant values
  assert.match(content, /MINIMAL:\s*1000/, 'MINIMAL threshold must be 1000');
  assert.match(content, /LOW:\s*100000/, 'LOW threshold must be 100000');
  assert.match(content, /MODERATE:\s*10000000/, 'MODERATE threshold must be 10000000');
});

test('DECOMP-01 — risk classification logic covers all four levels', () => {
  const filePath = path.join(ROOT, 'bin', 'analyze-state-space.cjs');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify all four risk levels are assigned in the classification logic
  const riskLevels = ['MINIMAL', 'LOW', 'MODERATE', 'HIGH'];
  for (const level of riskLevels) {
    assert.match(
      content,
      new RegExp(`riskLevel\\s*=\\s*'${level}'`),
      `Risk classification must assign riskLevel = '${level}'`
    );
  }
});
