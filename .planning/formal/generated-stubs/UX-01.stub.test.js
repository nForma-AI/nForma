#!/usr/bin/env node
// @requirement UX-01
// Test: Every user-initiated action produces immediate feedback and completion feedback
// Strategy: behavioral — verify sync-baseline-requirements produces structured result feedback

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('UX-01: syncBaselineRequirements returns structured feedback result', () => {
  const { syncBaselineRequirements } = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'sync-baseline-requirements.cjs'));

  // Create a temporary project root with minimal requirements.json
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ux01-'));
  const formalDir = path.join(tmpDir, '.planning', 'formal');
  fs.mkdirSync(formalDir, { recursive: true });
  fs.writeFileSync(path.join(formalDir, 'requirements.json'), JSON.stringify({
    requirements: [],
  }));

  // Call with a valid profile — should return feedback object with counts
  const result = syncBaselineRequirements('cli', tmpDir);

  // Verify result provides completion feedback fields
  assert.ok(typeof result === 'object', 'must return a result object');
  assert.ok(typeof result.total_before === 'number', 'must report total_before count');
  assert.ok(typeof result.total_after === 'number', 'must report total_after count');
  assert.ok(Array.isArray(result.added), 'must report added items');
  assert.ok(Array.isArray(result.skipped), 'must report skipped items');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('UX-01: idempotent re-sync produces zero-change feedback (no silent no-op)', () => {
  const { syncBaselineRequirements } = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'sync-baseline-requirements.cjs'));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ux01b-'));
  const formalDir = path.join(tmpDir, '.planning', 'formal');
  fs.mkdirSync(formalDir, { recursive: true });
  fs.writeFileSync(path.join(formalDir, 'requirements.json'), JSON.stringify({
    requirements: [],
  }));

  // First sync — adds requirements
  const first = syncBaselineRequirements('cli', tmpDir);
  assert.ok(first.added.length > 0, 'first sync should add requirements');

  // Second sync — should report zero additions (not silently succeed)
  const second = syncBaselineRequirements('cli', tmpDir);
  assert.equal(second.added.length, 0, 'idempotent re-sync must add zero new requirements');
  assert.ok(second.skipped.length > 0, 'idempotent re-sync must report skipped items as feedback');
  assert.equal(second.total_before, second.total_after, 'counts must be equal on idempotent sync');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
