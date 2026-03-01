#!/usr/bin/env node
'use strict';
// bin/run-uppaal.test.cjs
// Wave 0 RED tests for UPPAAL-01, UPPAAL-02, UPPAAL-03.
// Requirements: UPPAAL-01, UPPAAL-02, UPPAAL-03

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TOOL_PATH = path.join(__dirname, 'run-uppaal.cjs');
const RFV_PATH  = path.join(__dirname, 'run-formal-verify.cjs');

// Run run-uppaal.cjs in an isolated tmp dir with a seeded NDJSON
function runUppaal(ndjsonContent, env) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uppaal-test-'));
  fs.mkdirSync(path.join(tmpDir, 'formal'), { recursive: true });
  if (ndjsonContent !== undefined) {
    fs.writeFileSync(path.join(tmpDir, 'formal', 'check-results.ndjson'), ndjsonContent, 'utf8');
  }
  const result = spawnSync(process.execPath, [TOOL_PATH], {
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env, PATH: '/nonexistent:' + (process.env.PATH || '') },
  });
  return { tmpDir, result };
}

// Test 1: syntax check
test('run-uppaal.cjs loads without syntax errors (UPPAAL-01)', () => {
  const result = spawnSync(process.execPath, ['--check', TOOL_PATH], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, 'node --check must exit 0 (file must exist and be valid JS): ' + (result.stderr || result.error));
});

// Test 2: graceful degradation — exit 0 when verifyta not found
test('run-uppaal.cjs exits 0 when verifyta is not in PATH (UPPAAL-01)', () => {
  const { tmpDir, result } = runUppaal(undefined, {});
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.strictEqual(result.status, 0, 'must exit 0 even when verifyta missing: ' + (result.stderr || result.error));
});

// Test 3: writes inconclusive result to NDJSON when verifyta not found
test('run-uppaal.cjs writes inconclusive result to NDJSON when verifyta not found (UPPAAL-02)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uppaal-test-'));
  fs.mkdirSync(path.join(tmpDir, 'formal'), { recursive: true });
  const ndjsonOut = path.join(tmpDir, 'formal', 'check-results.ndjson');
  const result = spawnSync(process.execPath, [TOOL_PATH], {
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      CHECK_RESULTS_PATH: ndjsonOut,
      PATH: '/nonexistent:' + (process.env.PATH || ''),
    },
  });
  let ndjson = '';
  if (fs.existsSync(ndjsonOut)) {
    ndjson = fs.readFileSync(ndjsonOut, 'utf8');
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.ok(ndjson.includes('uppaal:quorum-races'), 'NDJSON must contain check_id uppaal:quorum-races');
  assert.ok(
    ndjson.includes('"result":"inconclusive"') || ndjson.includes('"result": "inconclusive"'),
    'NDJSON must contain result=inconclusive when verifyta absent'
  );
});

// Test 4: reads runtime_ms bounds from check-results.ndjson
test('run-uppaal.cjs reads runtime_ms bounds from check-results.ndjson (UPPAAL-02)', () => {
  const sampleNdjson = JSON.stringify({
    tool: 'run-tlc', formalism: 'tla', result: 'pass',
    check_id: 'tla:quorum-safety', surface: 'tla',
    property: 'Safety invariants', runtime_ms: 1234,
    summary: 'pass: MCsafety in 1234ms', triage_tags: [],
    timestamp: new Date().toISOString(),
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uppaal-test-'));
  fs.mkdirSync(path.join(tmpDir, 'formal'), { recursive: true });
  const ndjsonIn = path.join(tmpDir, 'formal', 'check-results.ndjson');
  fs.writeFileSync(ndjsonIn, sampleNdjson, 'utf8');
  const result = spawnSync(process.execPath, [TOOL_PATH], {
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      CHECK_RESULTS_PATH: ndjsonIn,
      PATH: '/nonexistent:' + (process.env.PATH || ''),
    },
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.strictEqual(result.status, 0, 'must exit 0 when reading bounds — file not found = ENOENT (RED): ' + (result.stderr || result.error));
});

// Test 5: formal/uppaal/quorum-races.xml exists and is valid XML
test('formal/uppaal/quorum-races.xml exists and is valid XML (UPPAAL-01)', () => {
  const xmlPath = path.join(__dirname, '..', 'formal', 'uppaal', 'quorum-races.xml');
  assert.ok(fs.existsSync(xmlPath), 'quorum-races.xml must exist (create in Plan 03)');
  const content = fs.readFileSync(xmlPath, 'utf8');
  assert.ok(content.includes('</nta>'), 'quorum-races.xml must be valid UPPAAL XML closing with </nta>');
  assert.ok(content.includes('MIN_SLOT_MS'), 'quorum-races.xml must reference MIN_SLOT_MS constant');
  assert.ok(content.includes('MAX_SLOT_MS'), 'quorum-races.xml must reference MAX_SLOT_MS constant');
  assert.ok(content.includes('TIMEOUT_MS'), 'quorum-races.xml must reference TIMEOUT_MS constant');
});

// Test 6: formal/uppaal/quorum-races.q exists and contains required property queries
test('formal/uppaal/quorum-races.q exists and contains required property queries (UPPAAL-03)', () => {
  const qPath = path.join(__dirname, '..', 'formal', 'uppaal', 'quorum-races.q');
  assert.ok(fs.existsSync(qPath), 'quorum-races.q must exist (create in Plan 03)');
  const content = fs.readFileSync(qPath, 'utf8');
  assert.ok(content.includes('A[] not deadlock'), 'quorum-races.q must include A[] not deadlock property');
  assert.ok(content.includes('UPPAAL-03') || content.includes('UPPAAL-01'), 'quorum-races.q must annotate UPPAAL requirement references');
});

// Test 7: run-formal-verify.cjs STEPS contains uppaal:quorum-races entry
test('run-formal-verify.cjs STEPS contains uppaal:quorum-races entry (UPPAAL-02)', () => {
  const src = fs.readFileSync(RFV_PATH, 'utf8');
  assert.ok(src.includes('uppaal:quorum-races'), 'STEPS must include uppaal:quorum-races (UPPAAL-02) — add in Plan 04');
});
