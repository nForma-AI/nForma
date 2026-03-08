#!/usr/bin/env node
// @requirement TRACE-06
// Validates: formal-test-sync.cjs exports key functions for cross-referencing formal models with unit test coverage

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SYNC_PATH = path.join(ROOT, 'bin', 'formal-test-sync.cjs');

test('TRACE-06: formal-test-sync.cjs exists', () => {
  assert.ok(fs.existsSync(SYNC_PATH), 'bin/formal-test-sync.cjs must exist');
});

test('TRACE-06: exports parseAlloyDefaults function', () => {
  const mod = require(SYNC_PATH);
  assert.equal(typeof mod.parseAlloyDefaults, 'function', 'must export parseAlloyDefaults');
});

test('TRACE-06: exports extractPropertyDefinition function', () => {
  const mod = require(SYNC_PATH);
  assert.equal(typeof mod.extractPropertyDefinition, 'function', 'must export extractPropertyDefinition');
});

test('TRACE-06: exports findSourceFiles function', () => {
  const mod = require(SYNC_PATH);
  assert.equal(typeof mod.findSourceFiles, 'function', 'must export findSourceFiles');
});

test('TRACE-06: exports classifyTestStrategy function', () => {
  const mod = require(SYNC_PATH);
  assert.equal(typeof mod.classifyTestStrategy, 'function', 'must export classifyTestStrategy');
});

test('TRACE-06: exports classifyTestTemplate function', () => {
  const mod = require(SYNC_PATH);
  assert.equal(typeof mod.classifyTestTemplate, 'function', 'must export classifyTestTemplate');
});
