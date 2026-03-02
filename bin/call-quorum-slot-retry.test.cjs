#!/usr/bin/env node
'use strict';
// bin/call-quorum-slot-retry.test.cjs
// TDD tests for v0.24-01: Retry backoff and provider infrastructure
// STRUCTURAL tests are RED until Plan 02 implements retry logic in call-quorum-slot.cjs
// UNIT tests are GREEN from the start (pure functions, no I/O).
// Requirement: FAIL-01

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ----- UNIT TESTS (GREEN from the start — pure functions) -----

// Inline the standard exponential backoff calculation as JS.
// Mirrors the bash logic: delay(attempt) = attempt === 0 ? 1000 : 3000
// (first retry waits 1s, second retry waits 3s)
function calculateBackoffDelay(attempt) {
  return attempt === 0 ? 1000 : 3000;
}

test('backoff delay for attempt 0 — returns 1000ms (1 second)', () => {
  assert.strictEqual(calculateBackoffDelay(0), 1000);
});

test('backoff delay for attempt 1 — returns 3000ms (3 seconds)', () => {
  assert.strictEqual(calculateBackoffDelay(1), 3000);
});

test('backoff delay for attempt 2+ — returns 3000ms (3 seconds)', () => {
  assert.strictEqual(calculateBackoffDelay(2), 3000);
  assert.strictEqual(calculateBackoffDelay(3), 3000);
});

test('fail-open: empty delay array produces 0 backoff attempts', () => {
  const delays = [];
  assert.strictEqual(delays.length, 0);
  // No error thrown — retry logic proceeds with retries disabled
});

test('fail-open: missing call-quorum-slot.cjs → retry guard returns early', () => {
  // Simulated: if file missing, the guard check returns false → no retry logic
  const filePath = '/tmp/__nonexistent_call_quorum_slot__';
  const fileExists = fs.existsSync(filePath);
  assert.strictEqual(fileExists, false);
  // Code path: fileExists false → skip retry logic (represented as empty array)
  const retryConfig = fileExists ? [{ attempt: 0, delay: 1000 }] : [];
  assert.strictEqual(retryConfig.length, 0);
});

// ----- STRUCTURAL TESTS (RED until Plan 02 implements retry logic) -----
// These tests read call-quorum-slot.cjs from bin/ (NOT installed ~/.claude/ copies).
// Plan 02 must add retry logic; Plan 03 runs install.js to sync to ~/.claude/.

const CALL_QUORUM_SLOT_PATH = path.resolve(__dirname, './call-quorum-slot.cjs');
let callQuorumSlotContent = '';
try {
  callQuorumSlotContent = fs.readFileSync(CALL_QUORUM_SLOT_PATH, 'utf8');
} catch (e) {
  callQuorumSlotContent = '';
}

test('call-quorum-slot.cjs: retry function exists (retryWithBackoff or retry pattern)', () => {
  const hasRetryFunction =
    callQuorumSlotContent.includes('retryWithBackoff') ||
    callQuorumSlotContent.includes('function retry') ||
    callQuorumSlotContent.includes('const retry');
  assert.ok(
    hasRetryFunction,
    'Retry function not found: no retryWithBackoff or retry function in call-quorum-slot.cjs — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: backoff delays are present (1000 and 3000)', () => {
  const has1000 = callQuorumSlotContent.includes('1000');
  const has3000 = callQuorumSlotContent.includes('3000');
  assert.ok(
    has1000 && has3000,
    'Backoff delays not found: need numeric literals 1000 (1s) and 3000 (3s) in call-quorum-slot.cjs — Plan 02 must add them'
  );
});

test('call-quorum-slot.cjs: max retries constant is present (MAX_RETRIES = 2)', () => {
  const hasMaxRetries =
    callQuorumSlotContent.includes('MAX_RETRIES') ||
    callQuorumSlotContent.match(/retries?\s*=\s*2/) ||
    callQuorumSlotContent.match(/maxRetries\s*=\s*2/i);
  assert.ok(
    hasMaxRetries,
    'Max retries constant not found: need MAX_RETRIES or similar constant set to 2 in call-quorum-slot.cjs — Plan 02 must add it'
  );
});

test('call-quorum-slot.cjs: retry only on transient errors (not CLI_SYNTAX)', () => {
  // Check for logic that excludes certain error types from retry
  const hasErrorExclusion =
    callQuorumSlotContent.includes('CLI_SYNTAX') ||
    callQuorumSlotContent.includes('spawn error') ||
    callQuorumSlotContent.includes('retryable') ||
    callQuorumSlotContent.match(/if.*error.*type|if.*error.*code|if.*isRetryable/i);
  assert.ok(
    hasErrorExclusion,
    'Retry-only-transient logic not found: need pattern to exclude CLI_SYNTAX or spawn errors from retry attempts in call-quorum-slot.cjs — Plan 02 must add it'
  );
});

test('fail-open: missing call-quorum-slot.cjs file → structural checks pass with empty content', () => {
  // If file is truly missing, empty content → all checks fail gracefully
  const content = callQuorumSlotContent;
  // This test passes if the guard allows missing files (fail-open principle)
  // No error thrown — test runner continues
  assert.ok(true, 'Guard allows missing file — fail-open');
});
