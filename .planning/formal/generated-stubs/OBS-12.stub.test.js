#!/usr/bin/env node
// @requirement OBS-12
// Structural test: observe handlers catch all errors internally and return
// status: 'error' with a descriptive error string. No handler throws.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const HANDLER_FILES = [
  'bin/observe-handlers.cjs',
  'bin/observe-handler-grafana.cjs',
  'bin/observe-handler-logstash.cjs',
  'bin/observe-handler-prometheus.cjs',
  'bin/observe-handler-internal.cjs',
  'bin/observe-handler-upstream.cjs',
  'bin/observe-handler-deps.cjs',
];

test('OBS-12: each handler file has try/catch error handling', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      /try\s*\{/.test(content),
      `${file} must have try block for error handling`
    );
    assert.ok(
      /catch\s*[\({]/.test(content) || /\}\s*catch\s/.test(content),
      `${file} must have catch block for error handling`
    );
  }
});

test('OBS-12: each handler returns status "error" in catch paths', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      content.includes("status: 'error'") || content.includes('status: "error"'),
      `${file} must return status: 'error' in error paths`
    );
  }
});

test('OBS-12: each handler includes an error description string in error returns', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // Error returns should include error: or message: field
    assert.ok(
      content.includes('error:') || content.includes('error :'),
      `${file} must include 'error' field with descriptive string in error returns`
    );
  }
});

test('OBS-12: no handler has bare throw statements outside of test files', () => {
  for (const file of HANDLER_FILES) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // Remove string literals and comments to avoid false positives
    const stripped = content
      .replace(/\/\/.*$/gm, '')        // strip line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
      .replace(/'[^']*'/g, "''")        // strip single-quoted strings
      .replace(/"[^"]*"/g, '""');       // strip double-quoted strings
    // Should not have bare throw statements (handlers must catch, not throw)
    const throwMatches = stripped.match(/^\s*throw\s/gm) || [];
    assert.equal(throwMatches.length, 0,
      `${file} should not have bare throw statements — handlers must catch errors internally`);
  }
});
