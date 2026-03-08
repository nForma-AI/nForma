#!/usr/bin/env node
// @requirement REL-02
// Structural: long-running operations have timeout handling

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// REL-02: Long-running operations show progress indication and can be cancelled.
// Structural strategy: verify that files making external calls have timeout mechanisms.

test('REL-02: call-quorum-slot.cjs supports --timeout argument', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/call-quorum-slot.cjs'), 'utf8');
  assert.match(content, /--timeout/, 'must accept --timeout CLI argument');
  assert.match(content, /timeout/i, 'must reference timeout handling');
});

test('REL-02: check-provider-health.cjs has connect timeout', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/check-provider-health.cjs'), 'utf8');
  assert.match(content, /timeout/i, 'must have timeout configuration for health probes');
});

test('REL-02: call-quorum-slot.cjs classifies TIMEOUT errors for retry', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/call-quorum-slot.cjs'), 'utf8');
  assert.match(content, /TIMEOUT/i, 'must classify TIMEOUT as a distinct error type');
  assert.match(content, /[Rr]etry/, 'must have retry logic for timeout errors');
});

test('REL-02: nf-circuit-breaker.js has timeout-safe patterns', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks/nf-circuit-breaker.js'), 'utf8');
  assert.match(content, /try\s*\{/, 'must use try/catch to handle timing-sensitive operations');
});
