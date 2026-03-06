#!/usr/bin/env node
// @requirement OBS-12
// Assertion test for: HandlerNeverThrows
// Formal model: .planning/formal/alloy/observability-handlers.als
// Requirement: No handler throws exceptions. Errors are caught internally and returned as status: 'error'.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = '/Users/jonathanborduas/code/QGSD';

test('OBS-12 — HandlerNeverThrows: handleGitHub does not throw on exec failure', () => {
  const { handleGitHub } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  const errorExec = () => { throw new Error('network timeout'); };
  // Must not throw
  const result = handleGitHub({ label: 'Test', repo: 'owner/repo' }, { execFn: errorExec });
  assert.equal(result.status, 'error');
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.length > 0);
  assert.ok(Array.isArray(result.issues));
});

test('OBS-12 — HandlerNeverThrows: handleGitHub does not throw on missing repo', () => {
  const { handleGitHub } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  const errorExec = () => { throw new Error('no remote'); };
  const result = handleGitHub({ label: 'Test' }, { execFn: errorExec });
  assert.equal(result.status, 'error');
  assert.equal(typeof result.error, 'string');
});

test('OBS-12 — HandlerNeverThrows: handleSentry does not throw on invalid config', () => {
  const { handleSentry } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  // Even with unusual config, should not throw
  const result = handleSentry({ label: 'Test', project: '' }, {});
  assert.ok('status' in result);
  assert.ok('issues' in result);
});

test('OBS-12 — HandlerNeverThrows: handleBash does not throw on command failure', () => {
  const { handleBash } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  const errorExec = () => { throw new Error('command not found'); };
  const result = handleBash({ label: 'Test', command: 'false' }, { execFn: errorExec });
  assert.equal(result.status, 'error');
  assert.equal(typeof result.error, 'string');
  assert.ok(Array.isArray(result.issues));
});

test('OBS-12 — HandlerNeverThrows: handleBash does not throw on missing command config', () => {
  const { handleBash } = require(`${REPO_ROOT}/bin/observe-handlers.cjs`);
  const result = handleBash({ label: 'Test' }, {});
  assert.equal(result.status, 'error');
  assert.ok(result.error.includes('No command'));
});

test('OBS-12 — HandlerNeverThrows: handleUpstream does not throw on exec failure', () => {
  const { handleUpstream } = require(`${REPO_ROOT}/bin/observe-handler-upstream.cjs`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs12-'));

  // An exec function that always throws
  const errorExec = () => { throw new Error('gh not found'); };
  const result = handleUpstream(
    { label: 'Test', repo: 'owner/repo', coupling: 'tight' },
    { execFn: errorExec, basePath: tmpDir }
  );
  // handleUpstream catches errors in fetchReleases (returns []), but the saveUpstreamState
  // should still succeed, giving status: 'ok' with empty issues.
  // Either way, it must NOT throw.
  assert.ok(['ok', 'error'].includes(result.status));
  assert.ok(Array.isArray(result.issues));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('OBS-12 — HandlerNeverThrows: handleInternal does not throw on nonexistent path', () => {
  const { handleInternal } = require(`${REPO_ROOT}/bin/observe-handler-internal.cjs`);
  const result = handleInternal(
    { label: 'Test' },
    { projectRoot: '/nonexistent-obs12-test-path' }
  );
  // Should return ok with empty or partial issues, not throw
  assert.ok(['ok', 'error'].includes(result.status));
  assert.ok(Array.isArray(result.issues));
});

test('OBS-12 — HandlerNeverThrows: handleUpstream does not throw on missing repo', () => {
  const { handleUpstream } = require(`${REPO_ROOT}/bin/observe-handler-upstream.cjs`);
  const result = handleUpstream({ label: 'Test' }, {});
  assert.equal(result.status, 'error');
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.includes('No repo'));
});
