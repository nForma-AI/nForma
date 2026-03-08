#!/usr/bin/env node
// @requirement ORES-01
// Structural test: When oscillation is detected and the oscillating file set contains
// only internal code files, Claude MUST enter oscillation resolution mode instead of
// hard-stopping. Verified via nf-prompt.js circuit breaker recovery path.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('ORES-01: nf-prompt.js checks circuit breaker state and enters resolution mode', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  // Must check if breaker is active
  assert.match(content, /isBreakerActive/, 'should call isBreakerActive to check oscillation state');
  // Must inject resolution workflow instead of stopping
  assert.match(content, /OSCILLATION RESOLUTION MODE/, 'should inject oscillation resolution mode context');
  // Must NOT hard-stop — should write additionalContext and exit(0), not process.exit(1)
  assert.match(content, /additionalContext/, 'should inject via additionalContext (not hard-stop)');
});

test('ORES-01: resolution mode locates oscillation-resolution-mode workflow', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  assert.match(content, /function\s+findResolutionWorkflow/, 'should have findResolutionWorkflow function');
  assert.match(content, /oscillation-resolution-mode\.md/, 'should look for oscillation-resolution-mode.md workflow');
});

test('ORES-01: resolution mode provides fallback instructions when workflow file missing', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  // When workflow file not found, inline instructions are provided
  assert.match(content, /resolve the oscillation/, 'fallback should mention resolving oscillation');
  assert.match(content, /git log/, 'fallback should reference git log for identifying oscillating files');
});
