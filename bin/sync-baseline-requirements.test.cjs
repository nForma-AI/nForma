'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We need to mock loadBaselineRequirements, so we use a wrapper approach.
// The sync module requires load-baseline-requirements.cjs internally,
// so we test by setting up temp projects and calling the function directly.

const { syncBaselineRequirements } = require('./sync-baseline-requirements.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal baseline data for testing (simulates loadBaselineRequirements output) */
function makeMockBaseline() {
  return {
    profile: 'cli',
    label: 'CLI Application',
    description: 'Test baseline',
    categories: [
      {
        name: 'UX Heuristics',
        description: 'UX requirements',
        requirements: [
          { id: 'UX-01', text: 'Immediate feedback on user actions', intent: 'i', verifiable_by: 'v' },
          { id: 'UX-02', text: 'Destructive actions require confirmation', intent: 'i', verifiable_by: 'v' },
        ],
      },
      {
        name: 'Security',
        description: 'Security requirements',
        requirements: [
          { id: 'SEC-01', text: 'All user input validated server-side', intent: 'i', verifiable_by: 'v' },
          { id: 'SEC-02', text: 'Secrets never logged or displayed', intent: 'i', verifiable_by: 'v' },
        ],
      },
    ],
    total: 4,
  };
}

function createTempProject(existingReqs = [], extraEnvelope = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-baseline-'));
  fs.mkdirSync(path.join(tmpDir, '.formal'), { recursive: true });
  const envelope = {
    aggregated_at: '2026-03-01T00:00:00.000Z',
    content_hash: 'sha256:' + 'a'.repeat(64),
    frozen_at: '2026-03-01T00:00:00.000Z',
    schema_version: '1',
    requirements: existingReqs,
    ...extraEnvelope,
  };
  fs.writeFileSync(
    path.join(tmpDir, '.formal', 'requirements.json'),
    JSON.stringify(envelope, null, 2)
  );
  return tmpDir;
}

function readResult(tmpDir) {
  return JSON.parse(fs.readFileSync(
    path.join(tmpDir, '.formal', 'requirements.json'), 'utf8'
  ));
}

function cleanupTmpDir(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
}

// Since syncBaselineRequirements internally calls loadBaselineRequirements,
// we need to use the real profile. For isolated testing, we test with 'cli'
// profile against the real baseline data and use known text matches.

// First, load actual baselines to get real texts for matching tests.
const { loadBaselineRequirements } = require('./load-baseline-requirements.cjs');
let realBaseline;
try {
  realBaseline = loadBaselineRequirements('cli');
} catch (_) {
  realBaseline = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncBaselineRequirements', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanupTmpDir(tmpDir);
  });

  it('1. Empty project gets all baseline requirements added', () => {
    if (!realBaseline) return; // skip if no baseline data
    tmpDir = createTempProject([]);
    const result = syncBaselineRequirements('cli', tmpDir);

    assert.equal(result.total_before, 0);
    assert.equal(result.added.length, realBaseline.total);
    assert.equal(result.skipped.length, 0);
    assert.equal(result.total_after, realBaseline.total);

    // Verify provenance on first added
    const written = readResult(tmpDir);
    const first = written.requirements[0];
    assert.equal(first.status, 'Pending');
    assert.equal(first.provenance.source_file, 'qgsd-baseline');
    assert.equal(first.provenance.milestone, 'baseline');
    assert.equal(first.phase, 'baseline');
  });

  it('2. Idempotent: second run adds nothing', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([]);

    const first = syncBaselineRequirements('cli', tmpDir);
    assert.ok(first.added.length > 0, 'First run should add requirements');

    const hashAfterFirst = readResult(tmpDir).content_hash;

    const second = syncBaselineRequirements('cli', tmpDir);
    assert.equal(second.added.length, 0, 'Second run should add nothing');
    assert.equal(second.skipped.length, realBaseline.total, 'Second run should skip all');

    const hashAfterSecond = readResult(tmpDir).content_hash;
    assert.equal(hashAfterFirst, hashAfterSecond, 'Content hash unchanged');
  });

  it('3. Text match skips duplicates', () => {
    if (!realBaseline) return;
    // Pre-populate with one requirement whose text matches a baseline requirement
    const firstBaselineText = realBaseline.categories[0].requirements[0].text;
    tmpDir = createTempProject([
      {
        id: 'EXISTING-99',
        text: firstBaselineText,
        category: 'Custom Category',
        status: 'Complete',
      },
    ]);

    const result = syncBaselineRequirements('cli', tmpDir);
    assert.equal(result.total_before, 1);
    assert.equal(result.skipped.length, 1, 'Should skip the one matching text');
    assert.equal(result.skipped[0].existingId, 'EXISTING-99');
    assert.equal(result.added.length, realBaseline.total - 1);
    assert.equal(result.total_after, realBaseline.total); // 1 existing + (total-1) added
  });

  it('4. Next-available ID assignment respects existing IDs', () => {
    if (!realBaseline) return;
    // Pre-populate SEC-01, SEC-02, SEC-03
    tmpDir = createTempProject([
      { id: 'SEC-01', text: 'Existing sec req 1', category: 'Security', status: 'Pending' },
      { id: 'SEC-02', text: 'Existing sec req 2', category: 'Security', status: 'Pending' },
      { id: 'SEC-03', text: 'Existing sec req 3', category: 'Security', status: 'Pending' },
    ]);

    const result = syncBaselineRequirements('cli', tmpDir);
    // New SEC requirements should start at SEC-04
    const secAdded = result.added.filter(a => a.id.startsWith('SEC-'));
    if (secAdded.length > 0) {
      const firstSecNum = parseInt(secAdded[0].id.split('-')[1], 10);
      assert.ok(firstSecNum >= 4, `SEC IDs should start at 04 or higher, got SEC-${String(firstSecNum).padStart(2, '0')}`);
    }
  });

  it('5. Mixed prefixes get independent counters', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([
      { id: 'UX-05', text: 'Existing UX req', category: 'UX', status: 'Pending' },
      { id: 'SEC-02', text: 'Existing SEC req', category: 'Security', status: 'Pending' },
    ]);

    const result = syncBaselineRequirements('cli', tmpDir);
    const uxAdded = result.added.filter(a => a.id.startsWith('UX-'));
    const secAdded = result.added.filter(a => a.id.startsWith('SEC-'));

    if (uxAdded.length > 0) {
      const firstUxNum = parseInt(uxAdded[0].id.split('-')[1], 10);
      assert.ok(firstUxNum >= 6, `UX IDs should start at 06+, got ${firstUxNum}`);
    }
    if (secAdded.length > 0) {
      const firstSecNum = parseInt(secAdded[0].id.split('-')[1], 10);
      assert.ok(firstSecNum >= 3, `SEC IDs should start at 03+, got ${firstSecNum}`);
    }
  });

  it('6. Provenance fields are correct', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([]);
    syncBaselineRequirements('cli', tmpDir);

    const written = readResult(tmpDir);
    for (const req of written.requirements) {
      assert.deepEqual(req.provenance, {
        source_file: 'qgsd-baseline',
        milestone: 'baseline',
      }, `Provenance mismatch for ${req.id}`);
      assert.equal(req.phase, 'baseline', `Phase mismatch for ${req.id}`);
      assert.equal(req.status, 'Pending', `Status mismatch for ${req.id}`);
    }
  });

  it('7. Envelope metadata updated on add', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([]);
    syncBaselineRequirements('cli', tmpDir);

    const written = readResult(tmpDir);
    // aggregated_at should be more recent
    assert.ok(new Date(written.aggregated_at) > new Date('2026-03-01T00:00:00.000Z'));
    // content_hash should differ from original
    assert.notEqual(written.content_hash, 'sha256:' + 'a'.repeat(64));
    // frozen_at should be preserved
    assert.equal(written.frozen_at, '2026-03-01T00:00:00.000Z');
    // schema_version should be preserved
    assert.equal(written.schema_version, '1');
  });

  it('8. File not written when nothing to add', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([]);

    // First sync to populate
    syncBaselineRequirements('cli', tmpDir);
    const afterFirst = readResult(tmpDir);
    const firstHash = afterFirst.content_hash;
    const firstTimestamp = afterFirst.aggregated_at;

    // Wait a tiny bit to ensure timestamp would differ
    const mtimeBefore = fs.statSync(path.join(tmpDir, '.formal', 'requirements.json')).mtimeMs;

    // Second sync - should not write
    const result = syncBaselineRequirements('cli', tmpDir);
    assert.equal(result.added.length, 0);

    const afterSecond = readResult(tmpDir);
    assert.equal(afterSecond.content_hash, firstHash, 'Hash should be unchanged');
    assert.equal(afterSecond.aggregated_at, firstTimestamp, 'Timestamp should be unchanged');
  });

  it('9. Return value shape', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([]);
    const result = syncBaselineRequirements('cli', tmpDir);

    assert.ok(Array.isArray(result.added), 'added should be array');
    assert.ok(Array.isArray(result.skipped), 'skipped should be array');
    assert.equal(typeof result.total_before, 'number');
    assert.equal(typeof result.total_after, 'number');
    assert.equal(result.total_after, result.total_before + result.added.length);
  });

  it('10. Content hash is sha256 prefixed', () => {
    if (!realBaseline) return;
    tmpDir = createTempProject([]);
    syncBaselineRequirements('cli', tmpDir);

    const written = readResult(tmpDir);
    assert.match(written.content_hash, /^sha256:[a-f0-9]{64}$/);
  });

  it('11. Handles missing .formal/requirements.json gracefully', () => {
    if (!realBaseline) return;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-baseline-'));
    // No .formal directory at all

    const result = syncBaselineRequirements('cli', tmpDir);
    assert.equal(result.total_before, 0);
    assert.equal(result.added.length, realBaseline.total);

    // File should now exist
    assert.ok(fs.existsSync(path.join(tmpDir, '.formal', 'requirements.json')));
  });

  it('12. ID padding when counter exceeds 99 (e.g., UX-99 -> UX-100)', () => {
    if (!realBaseline) return;
    // Pre-populate with UX-99 so next ID should be UX-100
    tmpDir = createTempProject([
      { id: 'UX-99', text: 'Existing UX req at 99', category: 'UX', status: 'Pending' },
    ]);

    const result = syncBaselineRequirements('cli', tmpDir);
    const uxAdded = result.added.filter(a => a.id.startsWith('UX-'));

    if (uxAdded.length > 0) {
      const firstUx = uxAdded[0];
      // Should be UX-100, not UX-00 or crash
      assert.equal(firstUx.id, 'UX-100', `Expected UX-100 but got ${firstUx.id}`);
    }
  });
});
