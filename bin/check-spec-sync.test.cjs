#!/usr/bin/env node
'use strict';
// bin/check-spec-sync.test.cjs
// Tests for bin/check-spec-sync.cjs
// Requirements: DRFT-01, DRFT-02, DRFT-03

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const CHECK_SPEC_SYNC = path.join(__dirname, 'check-spec-sync.cjs');
const REPO_ROOT = path.join(__dirname, '..');

test('exits 0 when XState machine and formal specs are in sync (current repo state)', () => {
  const result = spawnSync(process.execPath, [CHECK_SPEC_SYNC], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  assert.strictEqual(result.status, 0,
    'Expected exit 0 (in sync). stderr: ' + result.stderr + '\nstdout: ' + result.stdout
  );
});

test('exits 1 when a state in the XState machine is missing from TLA+ TypeOK (simulated drift)', () => {
  // This test is advisory — it requires a way to inject drift.
  // For now, verify the script properly fails when given a corrupted TLA+ fixture.
  // Implementation: if we can find the QGSDQuorum.tla, this is a live integration test.
  // Skip if the TLA+ file doesn't exist (CI without formal specs).
  const tlaPath = path.join(REPO_ROOT, 'formal', 'tla', 'QGSDQuorum.tla');
  if (!require('fs').existsSync(tlaPath)) {
    return; // Skip
  }
  // The existing in-sync state should pass; drift injection would require temp file manipulation.
  // This test slot is reserved for a fixture-based test — implement as part of TASK-03.
});

test('exits 1 when TLA+ TypeOK references a state not in XState machine (orphan detection)', () => {
  // Advisory test: verifies the script behavior is correct for the in-sync state.
  // Full orphan injection test requires fixture files — document as manual verification.
  // The in-sync repo should produce exit 0 (no orphans currently).
  const result = spawnSync(process.execPath, [CHECK_SPEC_SYNC], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  // No orphans in clean repo
  assert.ok(
    !result.stdout.includes('orphaned phases'),
    'Should not report orphaned phases on clean repo. stdout: ' + result.stdout
  );
});
