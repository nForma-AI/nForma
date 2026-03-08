#!/usr/bin/env node
// @requirement REDACT-01
// Auto-generated stub for uncovered invariant: CompleteRedaction
// `check-trace-redaction.cjs` checks traces for PII/secret patterns and emits check-results.ndjson

const { test } = require('node:test');
const assert = require('node:assert/strict');

const path = require('node:path');

// Behavioral: import and call the module's exported functions
const { parseRedactionPolicy, validateTraceEvent } = require(
  path.resolve(__dirname, '../../../bin/check-trace-redaction.cjs')
);

test('REDACT-01 — CompleteRedaction: parseRedactionPolicy and validateTraceEvent are exported', () => {
  assert.equal(typeof parseRedactionPolicy, 'function',
    'parseRedactionPolicy must be exported as a function');
  assert.equal(typeof validateTraceEvent, 'function',
    'validateTraceEvent must be exported as a function');
});

test('REDACT-01 — CompleteRedaction: validateTraceEvent detects forbidden keys', () => {
  const policy = {
    forbidden_keys: ['api_key', 'secret'],
    forbidden_patterns: [],
  };
  const event = { api_key: 'sk-1234', action: 'test' };
  const violations = validateTraceEvent(event, policy);

  assert.ok(violations.length > 0, 'must detect forbidden key violation');
  assert.equal(violations[0].violation_type, 'forbidden_key');
  assert.equal(violations[0].key, 'api_key');
});

test('REDACT-01 — CompleteRedaction: validateTraceEvent detects forbidden patterns', () => {
  const policy = {
    forbidden_keys: [],
    forbidden_patterns: [
      { name: 'api-key-pattern', regex: 'sk-[a-zA-Z0-9]+', compiled: /sk-[a-zA-Z0-9]+/ },
    ],
  };
  const event = { data: 'token is sk-abc123xyz' };
  const violations = validateTraceEvent(event, policy);

  assert.ok(violations.length > 0, 'must detect forbidden pattern violation');
  assert.equal(violations[0].violation_type, 'forbidden_pattern');
  assert.equal(violations[0].pattern_name, 'api-key-pattern');
});

test('REDACT-01 — CompleteRedaction: validateTraceEvent returns empty for clean events', () => {
  const policy = {
    forbidden_keys: ['secret'],
    forbidden_patterns: [
      { name: 'ssn', regex: '\\d{3}-\\d{2}-\\d{4}', compiled: /\d{3}-\d{2}-\d{4}/ },
    ],
  };
  const event = { action: 'test', status: 'ok' };
  const violations = validateTraceEvent(event, policy);

  assert.equal(violations.length, 0, 'clean event must produce no violations');
});
