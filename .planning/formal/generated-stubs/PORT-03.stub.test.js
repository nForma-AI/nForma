#!/usr/bin/env node
// @requirement PORT-03
// Formal property: CreateBackup — import creates timestamped backup before applying changes

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { _pure } = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'manage-agents-core.cjs'));
const { buildBackupPath } = _pure;

test('PORT-03: buildBackupPath exists as a function', () => {
  assert.equal(typeof buildBackupPath, 'function');
});

test('PORT-03: buildBackupPath produces timestamped backup path', () => {
  const claudeJsonPath = '/home/user/.claude.json';
  const ts = '2026-03-07T12-00-00.000Z';
  const result = buildBackupPath(claudeJsonPath, ts);
  assert.ok(result.startsWith(claudeJsonPath), 'backup path should start with original path');
  assert.ok(result.includes(ts), 'backup path should include timestamp');
  assert.ok(result.includes('pre-import'), 'backup path should include pre-import marker');
});

test('PORT-03: buildBackupPath format is path.pre-import.timestamp', () => {
  const result = buildBackupPath('/tmp/.claude.json', '2026-01-01T00-00-00.000Z');
  assert.equal(result, '/tmp/.claude.json.pre-import.2026-01-01T00-00-00.000Z');
});
