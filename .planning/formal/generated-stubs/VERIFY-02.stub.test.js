#!/usr/bin/env node
// @requirement VERIFY-02
// Structural test: verify-formal-results.cjs generates a "## Formal Verification"
// section summarizing pass/fail/warn counts per formalism (tla, alloy, prism, ci).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../../bin/verify-formal-results.cjs');

test('VERIFY-02: verify-formal-results.cjs exports generateFVSection function', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /function generateFVSection/,
    'should define generateFVSection function');
  assert.match(content, /module\.exports.*generateFVSection/,
    'should export generateFVSection');
});

test('VERIFY-02: generateFVSection output includes ## Formal Verification and per-formalism counts', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // The section template must include the heading and per-formalism pass/fail/warn tables
  assert.match(content, /## Formal Verification/,
    'template must produce ## Formal Verification heading');
  assert.match(content, /pass.*fail.*warn/s,
    'template must include pass/fail/warn count columns');
  assert.match(content, /Results/,
    'template must label per-formalism result subsections');
});

test('VERIFY-02: generateFVSection includes groupByFormalism for dynamic formalism keying', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /function groupByFormalism/,
    'should define groupByFormalism to dynamically group by formalism key');
  assert.match(content, /result\.formalism/,
    'should read formalism field from each result object');
});
