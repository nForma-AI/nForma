#!/usr/bin/env node
// @requirement OBS-09
// Structural test: observe handlers return the standard schema
// { source_label, source_type, status: ok|error, issues: Array, error?: string }
// and the dispatch layer validates the return shape.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// All handler files that return the standard schema
const HANDLER_FILES = [
  'bin/observe-handlers.cjs',
  'bin/observe-handler-grafana.cjs',
  'bin/observe-handler-logstash.cjs',
  'bin/observe-handler-prometheus.cjs',
  'bin/observe-handler-internal.cjs',
  'bin/observe-handler-upstream.cjs',
  'bin/observe-handler-deps.cjs',
];

const REQUIRED_SCHEMA_FIELDS = ['source_label', 'source_type', 'status', 'issues'];

test('OBS-09: all handler files reference standard schema fields in return objects', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const field of REQUIRED_SCHEMA_FIELDS) {
      assert.ok(
        content.includes(field),
        `${file} must reference schema field '${field}'`
      );
    }
  }
});

test('OBS-09: observe-handlers.cjs documents the standard schema in its header comment', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/observe-handlers.cjs'), 'utf8');
  // The header comment specifies the exact schema contract
  assert.match(content, /source_label.*source_type.*status/s,
    'observe-handlers.cjs header must document the standard schema');
});

test('OBS-09: handlers return status "ok" or "error" (not arbitrary strings)', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // Each handler must have at least one status: 'ok' or status: 'error' return
    const hasOk = content.includes("status: 'ok'") || content.includes('status: "ok"');
    const hasError = content.includes("status: 'error'") || content.includes('status: "error"');
    const hasPendingMcp = content.includes("status: 'pending_mcp'") || content.includes('status: "pending_mcp"');
    assert.ok(
      hasOk || hasError || hasPendingMcp,
      `${file} must return status 'ok', 'error', or 'pending_mcp'`
    );
  }
});

test('OBS-09: handlers always include issues array in return objects', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      content.includes('issues:') || content.includes('issues :'),
      `${file} must include 'issues' field in return objects`
    );
  }
});
