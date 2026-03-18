const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { normalizeBugContext } = require('../bin/refinement-loop.cjs');

test('MRF-01: normalizeBugContext returns empty string for null', () => {
  assert.strictEqual(normalizeBugContext(null), '');
});

test('MRF-01: normalizeBugContext returns empty string for undefined', () => {
  assert.strictEqual(normalizeBugContext(undefined), '');
});

test('MRF-01: normalizeBugContext returns empty string for empty string', () => {
  assert.strictEqual(normalizeBugContext(''), '');
});

test('MRF-01: normalizeBugContext returns empty string for whitespace-only string', () => {
  assert.strictEqual(normalizeBugContext('   '), '');
});

test('MRF-01: normalizeBugContext returns inline text when path does not exist', () => {
  const result = normalizeBugContext('circuit breaker timeout causes infinite retry loop');
  assert.strictEqual(result, 'circuit breaker timeout causes infinite retry loop');
});

test('MRF-01: normalizeBugContext trims whitespace from inline text', () => {
  const result = normalizeBugContext('  leading and trailing spaces  ');
  assert.strictEqual(result, 'leading and trailing spaces');
});

test('MRF-01: normalizeBugContext reads file contents when path exists', () => {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `bug-context-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'Bug: circuit breaker does not reset after timeout\n');
  try {
    const result = normalizeBugContext(tmpFile);
    assert.strictEqual(result, 'Bug: circuit breaker does not reset after timeout');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('MRF-01: normalizeBugContext trims whitespace from file contents', () => {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `bug-context-trim-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, '\n  file content with whitespace  \n\n');
  try {
    const result = normalizeBugContext(tmpFile);
    assert.strictEqual(result, 'file content with whitespace');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('MRF-01: normalizeBugContext returns empty string for non-string input', () => {
  assert.strictEqual(normalizeBugContext(42), '');
  assert.strictEqual(normalizeBugContext({}), '');
  assert.strictEqual(normalizeBugContext([]), '');
});
