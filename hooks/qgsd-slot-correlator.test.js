#!/usr/bin/env node
// Test suite for hooks/qgsd-slot-correlator.js
// Uses Node.js built-in test runner: node --test hooks/qgsd-slot-correlator.test.js

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_PATH = path.join(__dirname, 'qgsd-slot-correlator.js');

// Helper: create isolated tmpdir per test
function makeTmpDir() {
  return path.join(os.tmpdir(), 'qgsd-sc-' + Date.now() + '-' + Math.random().toString(36).slice(2));
}

// Helper: run the hook with a given stdin JSON payload using tmpDir as cwd
function runHook(stdinPayload, tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    cwd: tmpDir,
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

test('writes correlation placeholder for qgsd-quorum-slot-worker', () => {
  const tmpDir = makeTmpDir();

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    agent_id: 'agent42',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const corrFile = path.join(tmpDir, '.planning', 'quorum', 'correlations', 'quorum-slot-corr-agent42.json');
  assert.equal(fs.existsSync(corrFile), true, 'Correlation file should exist');

  const data = JSON.parse(fs.readFileSync(corrFile, 'utf8'));
  assert.equal(data.agent_id, 'agent42');
  assert.equal(data.slot, null, 'slot should be null in SubagentStart (prompt not available)');
  assert.ok(data.ts, 'ts field should be present');
});

test('non-qgsd agent type: exits 0, no file written', () => {
  const tmpDir = makeTmpDir();

  const payload = {
    agent_type: 'other',
    agent_id: 'agent99',
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);

  const planningDir = path.join(tmpDir, '.planning');
  // No .planning dir should be created at all
  const anyFile = fs.existsSync(planningDir);
  assert.equal(anyFile, false, 'No files should be written for non-qgsd agents');
});

test('missing agent_id: exits 0 gracefully', () => {
  const tmpDir = makeTmpDir();

  const payload = {
    agent_type: 'qgsd-quorum-slot-worker',
    agent_id: null,
  };

  const { exitCode } = runHook(payload, tmpDir);
  assert.equal(exitCode, 0);
  // No crash — exits gracefully when agent_id is null
});
