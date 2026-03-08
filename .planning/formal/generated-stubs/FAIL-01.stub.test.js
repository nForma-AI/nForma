#!/usr/bin/env node
// @requirement FAIL-01
// Structural test: call-quorum-slot.cjs retries failed slot calls up to 2 times
// with exponential backoff (1s, 3s) before recording UNAVAIL in quorum-failures.json

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', '..', '..', 'bin', 'call-quorum-slot.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('FAIL-01: retryWithBackoff function exists with maxRetries=2 and delays=[1000,3000]', () => {
  // Function signature with defaults
  assert.match(content, /async\s+function\s+retryWithBackoff\b/,
    'retryWithBackoff function must be defined');
  assert.match(content, /maxRetries\s*=\s*2/,
    'maxRetries default must be 2');
  assert.match(content, /delays\s*=\s*\[1000,\s*3000\]/,
    'delays default must be [1000, 3000] (1s, 3s exponential backoff)');
});

test('FAIL-01: retryWithBackoff implements retry loop with sleep', () => {
  assert.match(content, /for\s*\(\s*let\s+attempt\s*=\s*0;\s*attempt\s*<=\s*MAX_RETRIES/,
    'must loop from 0 to MAX_RETRIES inclusive');
  assert.match(content, /await\s+sleep\(/,
    'must await sleep() between retries for backoff');
});

test('FAIL-01: writeFailureLog records to quorum-failures path', () => {
  assert.match(content, /function\s+writeFailureLog\b/,
    'writeFailureLog function must exist');
  assert.match(content, /quorum-failures/,
    'must reference quorum-failures log path');
});

test('FAIL-01: isRetryable classifies non-retryable vs retryable errors', () => {
  assert.match(content, /function\s+isRetryable\b/,
    'isRetryable function must exist');
  assert.match(content, /spawn error/i,
    'spawn errors must be classified as non-retryable');
  assert.match(content, /ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT/,
    'network errors must be classified as retryable');
});
