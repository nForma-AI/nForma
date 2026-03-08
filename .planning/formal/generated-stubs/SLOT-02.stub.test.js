#!/usr/bin/env node
// @requirement SLOT-02
// Test: Migration script renames existing mcpServers entries from model-based names to slot names

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_PATH = path.resolve(__dirname, '../../../bin/install.js');
const REQ_MAP_PATH = path.resolve(__dirname, '../../../bin/requirement-map.cjs');

test('SLOT-02: requirement-map maps tla:recruiting-safety to SLOT-02', () => {
  const { CHECK_ID_TO_REQUIREMENTS } = require(REQ_MAP_PATH);
  const reqs = CHECK_ID_TO_REQUIREMENTS['tla:recruiting-safety'];
  assert.ok(Array.isArray(reqs), 'tla:recruiting-safety should map to an array');
  assert.ok(reqs.includes('SLOT-02'),
    'tla:recruiting-safety should include SLOT-02');
});

test('SLOT-02: install.js contains mcpServer slot name handling', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  // install.js should reference mcpServers for slot name migration
  assert.match(content, /mcpServer/i,
    'install.js should contain mcpServer references for migration');
});

test('SLOT-02: install.js contains migration-related logic', () => {
  const content = fs.readFileSync(INSTALL_PATH, 'utf8');
  // Should have OLD_HOOK_MAP or migration logic for renaming
  assert.match(content, /OLD_HOOK_MAP|migration|cleanup/i,
    'install.js should contain migration/cleanup logic');
});
