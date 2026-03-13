#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  fileHash,
  generateManifest,
  saveLocalPatches,
  reportLocalPatches,
  PATCHES_DIR_NAME,
  MANIFEST_NAME,
} = require('../bin/install.js');

// Suppress console.log during tests
const origLog = console.log;
let logOutput = [];
function captureLog() { logOutput = []; console.log = (...args) => logOutput.push(args.join(' ')); }
function restoreLog() { console.log = origLog; }

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nf-patch-test-'));
}

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─────────────────────────────────────────────
// Test 1: PATCHES_DIR_NAME is nf-local-patches (regression guard)
// ─────────────────────────────────────────────
(function testPatchesDirName() {
  assert.strictEqual(PATCHES_DIR_NAME, 'nf-local-patches',
    'PATCHES_DIR_NAME must be nf-local-patches, not gsd-local-patches');
  origLog('  PASS: test 1 - PATCHES_DIR_NAME is nf-local-patches');
})();

// ─────────────────────────────────────────────
// Test 2: MANIFEST_NAME is nf-file-manifest.json
// ─────────────────────────────────────────────
(function testManifestName() {
  assert.strictEqual(MANIFEST_NAME, 'nf-file-manifest.json',
    'MANIFEST_NAME must be nf-file-manifest.json');
  origLog('  PASS: test 2 - MANIFEST_NAME is nf-file-manifest.json');
})();

// ─────────────────────────────────────────────
// Test 3: fileHash returns consistent SHA256
// ─────────────────────────────────────────────
(function testFileHash() {
  const tmp = makeTmpDir();
  try {
    const f = path.join(tmp, 'test.txt');
    fs.writeFileSync(f, 'hello world');
    const h1 = fileHash(f);
    const h2 = fileHash(f);
    assert.strictEqual(h1, h2, 'Same file should produce same hash');
    assert.strictEqual(h1.length, 64, 'SHA256 hex should be 64 chars');
    origLog('  PASS: test 3 - fileHash returns consistent SHA256');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 4: generateManifest collects files recursively
// ─────────────────────────────────────────────
(function testGenerateManifest() {
  const tmp = makeTmpDir();
  try {
    fs.writeFileSync(path.join(tmp, 'a.txt'), 'aaa');
    fs.mkdirSync(path.join(tmp, 'sub'));
    fs.writeFileSync(path.join(tmp, 'sub', 'b.txt'), 'bbb');

    const m = generateManifest(tmp);
    assert.ok(m['a.txt'], 'Should find a.txt');
    assert.ok(m['sub/b.txt'], 'Should find sub/b.txt');
    assert.strictEqual(Object.keys(m).length, 2, 'Should have exactly 2 entries');
    origLog('  PASS: test 4 - generateManifest collects files recursively');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 5: generateManifest returns empty for non-existent dir
// ─────────────────────────────────────────────
(function testGenerateManifestMissing() {
  const m = generateManifest('/tmp/nf-nonexistent-' + Date.now());
  assert.deepStrictEqual(m, {}, 'Non-existent dir should return empty manifest');
  origLog('  PASS: test 5 - generateManifest returns empty for missing dir');
})();

// ─────────────────────────────────────────────
// Test 6: saveLocalPatches detects modified files
// ─────────────────────────────────────────────
(function testSaveLocalPatches() {
  const tmp = makeTmpDir();
  try {
    // Simulate an installed file tracked by manifest
    const trackedFile = path.join(tmp, 'nf', 'workflow.md');
    fs.mkdirSync(path.join(tmp, 'nf'), { recursive: true });
    fs.writeFileSync(trackedFile, 'original content');
    const originalHash = fileHash(trackedFile);

    // Write a manifest that records the original hash
    const manifest = {
      version: '0.33.1',
      timestamp: new Date().toISOString(),
      files: { 'nf/workflow.md': originalHash }
    };
    fs.writeFileSync(path.join(tmp, MANIFEST_NAME), JSON.stringify(manifest));

    // Modify the file
    fs.writeFileSync(trackedFile, 'modified content');

    // Run saveLocalPatches
    captureLog();
    const modified = saveLocalPatches(tmp);
    restoreLog();

    assert.deepStrictEqual(modified, ['nf/workflow.md'], 'Should detect modified file');

    // Verify backup was created in nf-local-patches/
    const backupPath = path.join(tmp, PATCHES_DIR_NAME, 'nf', 'workflow.md');
    assert.ok(fs.existsSync(backupPath), 'Backup should exist in nf-local-patches/');
    assert.strictEqual(fs.readFileSync(backupPath, 'utf8'), 'modified content',
      'Backup should contain the modified content');

    // Verify backup-meta.json
    const meta = JSON.parse(fs.readFileSync(
      path.join(tmp, PATCHES_DIR_NAME, 'backup-meta.json'), 'utf8'));
    assert.strictEqual(meta.from_version, '0.33.1');
    assert.deepStrictEqual(meta.files, ['nf/workflow.md']);

    origLog('  PASS: test 6 - saveLocalPatches detects and backs up modified files');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 7: saveLocalPatches returns empty when no manifest
// ─────────────────────────────────────────────
(function testSaveLocalPatchesNoManifest() {
  const tmp = makeTmpDir();
  try {
    captureLog();
    const modified = saveLocalPatches(tmp);
    restoreLog();
    assert.deepStrictEqual(modified, [], 'No manifest should return empty array');
    origLog('  PASS: test 7 - saveLocalPatches returns empty when no manifest');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 8: saveLocalPatches ignores unmodified files
// ─────────────────────────────────────────────
(function testSaveLocalPatchesUnmodified() {
  const tmp = makeTmpDir();
  try {
    const trackedFile = path.join(tmp, 'nf', 'unchanged.md');
    fs.mkdirSync(path.join(tmp, 'nf'), { recursive: true });
    fs.writeFileSync(trackedFile, 'same content');

    const manifest = {
      version: '0.33.1',
      timestamp: new Date().toISOString(),
      files: { 'nf/unchanged.md': fileHash(trackedFile) }
    };
    fs.writeFileSync(path.join(tmp, MANIFEST_NAME), JSON.stringify(manifest));

    captureLog();
    const modified = saveLocalPatches(tmp);
    restoreLog();

    assert.deepStrictEqual(modified, [], 'Unmodified file should not be detected');
    assert.ok(!fs.existsSync(path.join(tmp, PATCHES_DIR_NAME)),
      'Patches dir should not be created when nothing modified');
    origLog('  PASS: test 8 - saveLocalPatches ignores unmodified files');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 9: reportLocalPatches reads backup-meta.json
// ─────────────────────────────────────────────
(function testReportLocalPatches() {
  const tmp = makeTmpDir();
  try {
    const patchesDir = path.join(tmp, PATCHES_DIR_NAME);
    fs.mkdirSync(patchesDir, { recursive: true });
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({
      backed_up_at: '2026-03-12T00:00:00Z',
      from_version: '0.33.0',
      files: ['nf/workflow.md', 'commands/nf/help.md']
    }));

    captureLog();
    const files = reportLocalPatches(tmp);
    restoreLog();

    assert.deepStrictEqual(files, ['nf/workflow.md', 'commands/nf/help.md'],
      'Should return the list of patched files');
    origLog('  PASS: test 9 - reportLocalPatches reads backup-meta.json');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 10: reportLocalPatches returns empty when no patches
// ─────────────────────────────────────────────
(function testReportLocalPatchesEmpty() {
  const tmp = makeTmpDir();
  try {
    captureLog();
    const files = reportLocalPatches(tmp);
    restoreLog();
    assert.deepStrictEqual(files, [], 'No patches dir should return empty array');
    origLog('  PASS: test 10 - reportLocalPatches returns empty when no patches');
  } finally {
    rimraf(tmp);
  }
})();

// ─────────────────────────────────────────────
// Test 11: Full round-trip (save → report)
// ─────────────────────────────────────────────
(function testRoundTrip() {
  const tmp = makeTmpDir();
  try {
    // Setup: install a file and write manifest
    fs.mkdirSync(path.join(tmp, 'nf'), { recursive: true });
    const f1 = path.join(tmp, 'nf', 'a.md');
    const f2 = path.join(tmp, 'nf', 'b.md');
    fs.writeFileSync(f1, 'original-a');
    fs.writeFileSync(f2, 'original-b');

    const manifest = {
      version: '0.33.1',
      timestamp: new Date().toISOString(),
      files: {
        'nf/a.md': fileHash(f1),
        'nf/b.md': fileHash(f2),
      }
    };
    fs.writeFileSync(path.join(tmp, MANIFEST_NAME), JSON.stringify(manifest));

    // Modify only f1
    fs.writeFileSync(f1, 'modified-a');

    // Save patches
    captureLog();
    const saved = saveLocalPatches(tmp);
    restoreLog();
    assert.deepStrictEqual(saved, ['nf/a.md']);

    // Report patches
    captureLog();
    const reported = reportLocalPatches(tmp);
    restoreLog();
    assert.deepStrictEqual(reported, ['nf/a.md']);

    // Verify backup content
    const backup = fs.readFileSync(path.join(tmp, PATCHES_DIR_NAME, 'nf', 'a.md'), 'utf8');
    assert.strictEqual(backup, 'modified-a');

    origLog('  PASS: test 11 - full round-trip (save → report)');
  } finally {
    rimraf(tmp);
  }
})();

origLog('\n  All 11 patch persistence tests passed.');
