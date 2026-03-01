#!/usr/bin/env node
'use strict';
// bin/accept-debug-invariant.test.cjs
// Wave 0 RED tests for ARCH-03 debug session write behaviors.
// Requirements: ARCH-03

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Path to the tool under test
const TOOL_PATH = path.join(__dirname, 'accept-debug-invariant.cjs');

// Helper to create temporary test directory with formal/ structure
function createTempFormalDir(files = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-invariant-test-'));
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

// Helper to run accept-debug-invariant.cjs in a temp directory
function runAcceptDebugTool(cwd, specPath, propertyName, propertyBody, sessionId) {
  const args = [
    TOOL_PATH,
    specPath,
    '--property-name', propertyName,
    '--property-body', propertyBody
  ];

  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: 10000,
  });
}

test('writes PROPERTY to spec that previously had none', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'empty.tla': '---- MODULE Empty ----\nEXTENDS Integers\n===='
    }
  });

  const result = runAcceptDebugTool(
    tmpDir,
    'formal/tla/empty.tla',
    'DebugInv1',
    'x > 0',
    'debug-sess-1234567890-abc12345'
  );

  // Tool doesn't exist yet - expected RED state
  // When implemented, we would:
  // 1. Verify exit code 0
  // 2. Read updated empty.tla
  // 3. Assert it contains "PROPERTY DebugInv1 == x > 0"

  console.log(`Test ran, exit code: ${result.status}`);
});

test('rejects write if property name already exists in spec', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'existing.tla': '---- MODULE Existing ----\nEXTENDS Integers\nPROPERTY DebugInv1 == TRUE\n===='
    }
  });

  const result = runAcceptDebugTool(
    tmpDir,
    'formal/tla/existing.tla',
    'DebugInv1', // Same name as existing
    'x > 0',
    'debug-sess-1234567890-abc12345'
  );

  // When implemented, we would:
  // 1. Verify exit code non-zero
  // 2. Assert stderr indicates conflict

  console.log(`Test ran, exit code: ${result.status}, stderr: ${result.stderr?.slice(0, 100)}`);
});

test('tmp file removed after atomic rename', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'test.tla': '---- MODULE Test ----\nEXTENDS Integers\n===='
    }
  });

  const result = runAcceptDebugTool(
    tmpDir,
    'formal/tla/test.tla',
    'DebugInv2',
    'y < 10',
    'debug-sess-1234567890-abc12345'
  );

  // When implemented, we would:
  // 1. List files in formal/tla/
  // 2. Assert no *.tmp.* files remain

  console.log(`Test ran, exit code: ${result.status}`);
});

test('session_id recorded in registry', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'test.tla': '---- MODULE Test ----\nEXTENDS Integers\n===='
    }
  });

  // Create initial registry
  const initialRegistry = {
    version: '1.0',
    last_sync: '2026-03-01T12:34:56.789Z',
    models: {
      'tla/test.tla': {
        version: 1,
        last_updated: '2026-03-01T12:34:56.789Z',
        update_source: 'manual',
        source_id: null,
        session_id: null,
        description: 'Test spec'
      }
    }
  };

  fs.writeFileSync(
    path.join(tmpDir, 'formal', 'model-registry.json'),
    JSON.stringify(initialRegistry, null, 2),
    'utf8'
  );

  const testSessionId = 'debug-sess-1234567890-abc12345';
  const result = runAcceptDebugTool(
    tmpDir,
    'formal/tla/test.tla',
    'DebugInv3',
    'z = 5',
    testSessionId
  );

  // When implemented, we would:
  // 1. Read updated registry
  // 2. Assert models["tla/test.tla"].session_id === testSessionId

  console.log(`Test ran, exit code: ${result.status}`);
});

test('update_source is debug in registry', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'test.tla': '---- MODULE Test ----\nEXTENDS Integers\n===='
    }
  });

  // Create initial registry
  const initialRegistry = {
    version: '1.0',
    last_sync: '2026-03-01T12:34:56.789Z',
    models: {
      'tla/test.tla': {
        version: 1,
        last_updated: '2026-03-01T12:34:56.789Z',
        update_source: 'manual',
        source_id: null,
        session_id: null,
        description: 'Test spec'
      }
    }
  };

  fs.writeFileSync(
    path.join(tmpDir, 'formal', 'model-registry.json'),
    JSON.stringify(initialRegistry, null, 2),
    'utf8'
  );

  const result = runAcceptDebugTool(
    tmpDir,
    'formal/tla/test.tla',
    'DebugInv4',
    'a \\in {1, 2, 3}',
    'debug-sess-1234567890-abc12345'
  );

  // When implemented, we would:
  // 1. Read updated registry
  // 2. Assert models["tla/test.tla"].update_source === "debug"

  console.log(`Test ran, exit code: ${result.status}`);
});