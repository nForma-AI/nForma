#!/usr/bin/env node
// hooks/qgsd-stop-fan-out.test.cjs — Wave 0 test scaffold for FAN-04
// Integration tests for qgsd-stop.js ceiling verification with adaptive fan-out
// Uses node:test + node:assert/strict with child_process.spawnSync
//
// Purpose: Define test contracts for stop hook ceiling check before implementation.
// Tests verify that qgsd-stop.js reads --n N from transcript and verifies correct ceiling.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

// Path to the hook
const HOOK_PATH = path.join(__dirname, 'qgsd-stop.js');

// Helper: spawn qgsd-stop.js as child process with stdin
function runHook(stdinPayload) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(stdinPayload),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

// FAN-STOP-TC1: --n 2 in prompt text → ceiling = 1 external model required
test('FAN-STOP-TC1: --n 2 in prompt text → ceiling = 1 external model required', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase --n 2',
    transcript_path: '/tmp/mock-transcript.jsonl',
    success_count: 1,
  });
  assert.fail('TODO: FAN-04 ceiling verification — implement after qgsd-prompt.js fan-out is done');
});

// FAN-STOP-TC2: --n 3 in prompt text → ceiling = 2 external models required
test('FAN-STOP-TC2: --n 3 in prompt text → ceiling = 2 external models required', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase --n 3',
    transcript_path: '/tmp/mock-transcript.jsonl',
    success_count: 2,
  });
  assert.fail('TODO: FAN-04 ceiling verification — implement after qgsd-prompt.js fan-out is done');
});

// FAN-STOP-TC3: --n 1 solo mode → no external models required (existing behavior preserved)
test('FAN-STOP-TC3: --n 1 solo mode → no external models required (existing behavior)', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase --n 1',
    transcript_path: '/tmp/mock-transcript.jsonl',
    success_count: 0,
  });
  assert.fail('TODO: FAN-04 ceiling verification — implement after qgsd-prompt.js fan-out is done');
});

// FAN-STOP-TC4: no --n flag → ceiling falls back to config.quorum.maxSize (existing behavior)
test('FAN-STOP-TC4: no --n flag → ceiling falls back to config.quorum.maxSize', () => {
  const { stdout } = runHook({
    prompt: '/qgsd:plan-phase',
    transcript_path: '/tmp/mock-transcript.jsonl',
    success_count: 2,  // default maxSize-1 = 2
  });
  assert.fail('TODO: FAN-04 ceiling verification — implement after qgsd-prompt.js fan-out is done');
});
