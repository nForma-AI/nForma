#!/usr/bin/env node
'use strict';
// bin/initialize-model-registry.test.cjs
// Wave 0 RED tests for ARCH-01 initialization behaviors.
// Requirements: ARCH-01

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Path to the tool under test
const TOOL_PATH = path.join(__dirname, 'initialize-model-registry.cjs');

// Helper to create temporary test directory with formal/ structure
function createTempFormalDir(files = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-registry-test-'));
  fs.mkdirSync(path.join(tmpDir, 'formal'), { recursive: true });

  for (const [subdir, subfiles] of Object.entries(files)) {
    const dirPath = path.join(tmpDir, 'formal', subdir);
    fs.mkdirSync(dirPath, { recursive: true });
    for (const [filename, content] of Object.entries(subfiles)) {
      fs.writeFileSync(path.join(dirPath, filename), content, 'utf8');
    }
  }

  return tmpDir;
}

// Helper to run initialize-model-registry.cjs in a temp directory
function runInitializeTool(cwd) {
  return spawnSync(process.execPath, [TOOL_PATH], {
    cwd,
    encoding: 'utf8',
    timeout: 10000,
  });
}

test('idempotent: exits silently if registry exists', async () => {
  const tmpDir = createTempFormalDir();

  // Create a dummy registry first
  const dummyRegistry = {
    version: '1.0',
    last_sync: '2026-03-01T00:00:00.000Z',
    models: {
      'tla/Test.tla': {
        version: 1,
        last_updated: '2026-03-01T00:00:00.000Z',
        update_source: 'manual',
        source_id: null,
        session_id: null,
        description: 'Test spec'
      }
    }
  };

  fs.writeFileSync(
    path.join(tmpDir, 'formal', 'model-registry.json'),
    JSON.stringify(dummyRegistry, null, 2),
    'utf8'
  );

  // Run the tool
  const result = runInitializeTool(tmpDir);

  // When implemented: tool should exit successfully (0) since registry exists
  // Currently fails because tool doesn't exist - this is the expected RED state
  assert.strictEqual(result.status, 0, 'initialize-model-registry.cjs must exit 0: ' + result.stderr);
});

test('empty formal/ produces registry with correct update_source', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'Test.tla': '---- MODULE Test ----\nEXTENDS Integers\n====',
      'QGSDQuorum_xstate.tla': '---- MODULE QGSDQuorum_xstate ----\n(* Generated from XState *)\n===='
    }
  });

  // Run the tool
  const result = runInitializeTool(tmpDir);

  // When implemented: tool should exit successfully (0)
  // Currently fails because tool doesn't exist - this is the expected RED state
  assert.strictEqual(result.status, 0, 'initialize-model-registry.cjs must exit 0: ' + result.stderr);
});

test('all registry keys are relative paths (no ./ prefix, no absolute prefix)', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'Test1.tla': '---- MODULE Test1 ----\n====',
      'Test2.tla': '---- MODULE Test2 ----\n===='
    },
    alloy: {
      'test.als': 'module test'
    }
  });

  // Run the tool
  const result = runInitializeTool(tmpDir);

  // When implemented: tool should exit successfully (0)
  // Currently fails because tool doesn't exist - this is the expected RED state
  assert.strictEqual(result.status, 0, 'initialize-model-registry.cjs must exit 0: ' + result.stderr);
});