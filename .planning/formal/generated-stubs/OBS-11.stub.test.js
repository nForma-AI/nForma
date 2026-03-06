#!/usr/bin/env node
// @requirement OBS-11
// Assertion test for: UpstreamAlwaysEvaluated
// Formal model: .planning/formal/alloy/observability-handlers.als
// Requirement: Every upstream issue has a classification field (SKIP/CANDIDATE/INCOMPATIBLE).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = '/Users/jonathanborduas/code/QGSD';

test('OBS-11 — UpstreamAlwaysEvaluated: classifyUpstreamOverlap returns valid values', () => {
  const { classifyUpstreamOverlap } = require(`${REPO_ROOT}/bin/observe-handler-upstream.cjs`);
  const validValues = ['SKIP', 'CANDIDATE', 'INCOMPATIBLE'];

  // Feature => CANDIDATE
  const feat = classifyUpstreamOverlap({ title: 'feat: add new hooks' }, 'loose');
  assert.ok(validValues.includes(feat), `Expected valid value, got: ${feat}`);
  assert.equal(feat, 'CANDIDATE');

  // Breaking => INCOMPATIBLE
  const breaking = classifyUpstreamOverlap({ title: 'breaking: remove old API' }, 'tight');
  assert.equal(breaking, 'INCOMPATIBLE');

  // Docs => SKIP
  const docs = classifyUpstreamOverlap({ title: 'docs: update readme' }, 'loose');
  assert.equal(docs, 'SKIP');

  // Major version bump with tight coupling => INCOMPATIBLE
  const majorVer = classifyUpstreamOverlap({ tagName: 'v3.0.0', name: 'Release 3.0.0' }, 'tight');
  assert.equal(majorVer, 'INCOMPATIBLE');
});

test('OBS-11 — UpstreamAlwaysEvaluated: handleUpstream issues include classification', () => {
  const { handleUpstream } = require(`${REPO_ROOT}/bin/observe-handler-upstream.cjs`);

  // Create a temp dir for state file so we don't pollute project
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs11-'));

  const mockExec = (cmd, args, opts) => {
    // Mock gh release list
    if (args.includes('release')) {
      return JSON.stringify([
        { tagName: 'v1.2.0', name: 'Release 1.2.0', publishedAt: new Date().toISOString(), isPrerelease: false, url: 'https://example.com' }
      ]);
    }
    // Mock gh pr list
    if (args.includes('pr')) {
      return JSON.stringify([
        { number: 42, title: 'feat: add plugin system', url: 'https://example.com/pr/42', mergedAt: new Date().toISOString(), changedFiles: 10, additions: 200, deletions: 50, labels: [] }
      ]);
    }
    return '[]';
  };

  const result = handleUpstream(
    { label: 'Test Upstream', repo: 'owner/repo', coupling: 'loose' },
    { execFn: mockExec, basePath: tmpDir }
  );

  assert.equal(result.status, 'ok');
  assert.ok(result.issues.length > 0, 'Should have at least one issue');

  const validClassifications = ['SKIP', 'CANDIDATE', 'INCOMPATIBLE'];
  for (const issue of result.issues) {
    assert.ok(issue._upstream, `Issue ${issue.id} must have _upstream field`);
    assert.ok(
      'classification' in issue._upstream,
      `Issue ${issue.id} _upstream must have classification field`
    );
    assert.ok(
      validClassifications.includes(issue._upstream.classification),
      `Issue ${issue.id} classification must be SKIP|CANDIDATE|INCOMPATIBLE, got: ${issue._upstream.classification}`
    );
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('OBS-11 — UpstreamAlwaysEvaluated: classifyUpstreamOverlap is exported', () => {
  const upstream = require(`${REPO_ROOT}/bin/observe-handler-upstream.cjs`);
  assert.equal(typeof upstream.classifyUpstreamOverlap, 'function');
});
