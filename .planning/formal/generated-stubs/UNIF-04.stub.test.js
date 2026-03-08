#!/usr/bin/env node
// @requirement UNIF-04
// Test: CI step exits non-zero when any result=fail entry exists in check-results.ndjson

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'bin', 'check-results-exit.cjs');

function run(ndjsonPath) {
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, CHECK_RESULTS_PATH: ndjsonPath },
  });
}

function writeTmpNdjson(tmpDir, lines) {
  const tmpFile = path.join(tmpDir, 'check-results.ndjson');
  fs.writeFileSync(tmpFile, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf8');
  return tmpFile;
}

test('UNIF-04: exits non-zero when result=fail entry exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unif04-'));
  try {
    const ndjsonFile = writeTmpNdjson(tmpDir, [
      JSON.stringify({ tool: 'run-tlc', formalism: 'tla', result: 'fail', timestamp: new Date().toISOString(), metadata: {} }),
    ]);
    const result = run(ndjsonFile);
    assert.strictEqual(result.status, 1, 'Expected exit code 1 when a fail entry exists');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('UNIF-04: exits zero when all results pass', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unif04-'));
  try {
    const ndjsonFile = writeTmpNdjson(tmpDir, [
      JSON.stringify({ tool: 'run-tlc', formalism: 'tla', result: 'pass', timestamp: new Date().toISOString(), metadata: {} }),
    ]);
    const result = run(ndjsonFile);
    assert.strictEqual(result.status, 0, 'Expected exit code 0 when all pass');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('UNIF-04: exits zero when file is empty', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unif04-'));
  try {
    const ndjsonFile = path.join(tmpDir, 'check-results.ndjson');
    fs.writeFileSync(ndjsonFile, '', 'utf8');
    const result = run(ndjsonFile);
    assert.strictEqual(result.status, 0, 'Expected exit code 0 for empty file');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
