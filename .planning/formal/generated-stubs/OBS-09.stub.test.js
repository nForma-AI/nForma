#!/usr/bin/env node
// @requirement OBS-09
// Assertion test for: SchemaAlwaysComplete
// Formal model: .planning/formal/alloy/observability-handlers.als
// Requirement: Every handler result has source_label, source_type, status, and issues fields.
// Error responses include an error string.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = '/Users/jonathanborduas/code/QGSD';

test('OBS-09 — SchemaAlwaysComplete: handleGitHub returns standard schema', () => {
  const { handleGitHub } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  // Use a mock execFn that throws to trigger error path
  const result = handleGitHub(
    { label: 'Test', repo: 'owner/repo' },
    { execFn: () => { throw new Error('mock'); } }
  );
  assert.ok('source_label' in result, 'result must have source_label');
  assert.ok('source_type' in result, 'result must have source_type');
  assert.ok('status' in result, 'result must have status');
  assert.ok('issues' in result, 'result must have issues');
  assert.ok(Array.isArray(result.issues), 'issues must be an array');
});

test('OBS-09 — SchemaAlwaysComplete: handleGitHub error includes error string', () => {
  const { handleGitHub } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  const result = handleGitHub(
    { label: 'Test', repo: 'owner/repo' },
    { execFn: () => { throw new Error('connection failed'); } }
  );
  assert.equal(result.status, 'error');
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.length > 0, 'error string must be descriptive');
});

test('OBS-09 — SchemaAlwaysComplete: handleUpstream returns standard schema', () => {
  const { handleUpstream } = require(`${REPO_ROOT}/bin/observe-handler-upstream.cjs`);
  // Missing repo triggers error path
  const result = handleUpstream({ label: 'Test' }, {});
  assert.ok('source_label' in result, 'result must have source_label');
  assert.ok('source_type' in result, 'result must have source_type');
  assert.ok('status' in result, 'result must have status');
  assert.ok('issues' in result, 'result must have issues');
  assert.ok(Array.isArray(result.issues), 'issues must be an array');
});

test('OBS-09 — SchemaAlwaysComplete: handleInternal returns standard schema', () => {
  const { handleInternal } = require(`${REPO_ROOT}/bin/observe-handler-internal.cjs`);
  const result = handleInternal(
    { label: 'Test' },
    { projectRoot: '/nonexistent-path-for-obs09-test' }
  );
  assert.ok('source_label' in result, 'result must have source_label');
  assert.ok('source_type' in result, 'result must have source_type');
  assert.ok('status' in result, 'result must have status');
  assert.ok('issues' in result, 'result must have issues');
  assert.ok(Array.isArray(result.issues), 'issues must be an array');
});

test('OBS-09 — SchemaAlwaysComplete: handleGitHub ok path has full schema', () => {
  const { handleGitHub } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  const mockExec = (cmd, args) => {
    if (cmd === 'git') return 'git@github.com:owner/repo.git';
    // gh issue list returns JSON array
    return JSON.stringify([
      { number: 1, title: 'Test issue', url: 'https://example.com', labels: [], createdAt: new Date().toISOString(), assignees: [] }
    ]);
  };
  const result = handleGitHub({ label: 'GH', repo: 'owner/repo' }, { execFn: mockExec });
  assert.equal(result.status, 'ok');
  assert.equal(result.source_label, 'GH');
  assert.equal(result.source_type, 'github');
  assert.ok(result.issues.length >= 1);
  // No error field on ok responses
  assert.equal(result.error, undefined);
});
