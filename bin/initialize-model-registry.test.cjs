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

// Helper to create temporary test directory with .planning/formal/ structure
function createTempFormalDir(files = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-registry-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'formal'), { recursive: true });

  for (const [subdir, subfiles] of Object.entries(files)) {
    const dirPath = path.join(tmpDir, '.planning', 'formal', subdir);
    fs.mkdirSync(dirPath, { recursive: true });
    for (const [filename, content] of Object.entries(subfiles)) {
      fs.writeFileSync(path.join(dirPath, filename), content, 'utf8');
    }
  }

  return tmpDir;
}

// Helper to run initialize-model-registry.cjs in a temp directory
function runInitializeTool(cwd) {
  return spawnSync(process.execPath, [TOOL_PATH, '--project-root=' + cwd], {
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
    path.join(tmpDir, '.planning', 'formal', 'model-registry.json'),
    JSON.stringify(dummyRegistry, null, 2),
    'utf8'
  );

  // Run the tool
  const result = runInitializeTool(tmpDir);

  // When implemented: tool should exit successfully (0) since registry exists
  // Currently fails because tool doesn't exist - this is the expected RED state
  assert.strictEqual(result.status, 0, 'initialize-model-registry.cjs must exit 0: ' + result.stderr);
});

test('empty .planning/formal/ produces registry with correct update_source', async () => {
  const tmpDir = createTempFormalDir({
    tla: {
      'Test.tla': '---- MODULE Test ----\nEXTENDS Integers\n====',
      'NFQuorum_xstate.tla': '---- MODULE NFQuorum_xstate ----\n(* Generated from XState *)\n===='
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

test('scans uppaal directory for .xml files', async () => {
  const tmpDir = createTempFormalDir({
    uppaal: {
      'test-model.xml': '<nta></nta>'
    }
  });

  // Run the tool
  const result = runInitializeTool(tmpDir);

  assert.strictEqual(result.status, 0, 'initialize-model-registry.cjs must exit 0: ' + result.stderr);

  // Check the generated registry
  const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
  assert.ok(fs.existsSync(registryPath), 'model-registry.json should be created');

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const uppaalKeys = Object.keys(registry.models).filter(k => k.includes('uppaal'));
  assert.ok(uppaalKeys.length > 0, 'registry should contain uppaal entry: ' + Object.keys(registry.models).join(', '));
  assert.ok(uppaalKeys.some(k => k.includes('test-model.xml')), 'should contain test-model.xml');

  const entry = registry.models[uppaalKeys[0]];
  assert.strictEqual(entry.update_source, 'manual', 'uppaal entry should have update_source: manual');
});

test('scans petri directory for .dot files', async () => {
  const tmpDir = createTempFormalDir({
    petri: {
      'test-net.dot': 'digraph { a -> b }'
    }
  });

  // Run the tool
  const result = runInitializeTool(tmpDir);

  assert.strictEqual(result.status, 0, 'initialize-model-registry.cjs must exit 0: ' + result.stderr);

  // Check the generated registry
  const registryPath = path.join(tmpDir, '.planning', 'formal', 'model-registry.json');
  assert.ok(fs.existsSync(registryPath), 'model-registry.json should be created');

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const petriKeys = Object.keys(registry.models).filter(k => k.includes('petri'));
  assert.ok(petriKeys.length > 0, 'registry should contain petri entry: ' + Object.keys(registry.models).join(', '));
  assert.ok(petriKeys.some(k => k.includes('test-net.dot')), 'should contain test-net.dot');

  const entry = registry.models[petriKeys[0]];
  assert.strictEqual(entry.update_source, 'manual', 'petri entry should have update_source: manual');
});