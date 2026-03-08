#!/usr/bin/env node
// @requirement DETECT-03
// Structural test: hook identifies oscillation when the exact same file set (strict set
// equality) appears in >= oscillation_depth of the last commit_window commits

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');

test('DETECT-03: hook defines detectOscillation function', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must define detectOscillation function
  assert.match(content, /function\s+detectOscillation/, 'should define detectOscillation');

  // Must accept fileSets and depth parameters
  assert.match(content, /detectOscillation\(fileSets,\s*depth/, 'should accept fileSets and depth params');
});

test('DETECT-03: detectOscillation uses strict set equality via sorted join', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must sort files before comparing (strict set equality, not intersection)
  assert.match(content, /\.sort\(\)\.join/, 'should sort and join files for strict set equality');

  // Must collapse consecutive identical sets into run-groups
  assert.match(content, /runs/, 'should use run-group collapsing');
});

test('DETECT-03: detectOscillation checks oscillation_depth threshold', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must compare run-group count against depth threshold
  assert.match(content, />=\s*depth/, 'should check >= depth for oscillation threshold');

  // Must use oscillation_depth from config when calling detectOscillation
  assert.match(content, /oscillation_depth/, 'should reference oscillation_depth config');
});

test('DETECT-03: detectOscillation returns detected flag and fileSet', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must return { detected: true/false, fileSet: [...] }
  assert.match(content, /detected:\s*true/, 'should return detected: true on oscillation');
  assert.match(content, /detected:\s*false/, 'should return detected: false when no oscillation');
  assert.match(content, /fileSet/, 'should return the oscillating fileSet');
});

test('DETECT-03: second-pass reversion check prevents false positives during TDD', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must have hasReversionInHashes for second-pass reversion check
  assert.match(content, /function\s+hasReversionInHashes/, 'should define hasReversionInHashes');

  // Must check net change to distinguish TDD progression from real oscillation
  assert.match(content, /totalNetChange/, 'should track totalNetChange across pairs');
  assert.match(content, /hasNegativePair/, 'should track whether any pair has negative net change');
});
