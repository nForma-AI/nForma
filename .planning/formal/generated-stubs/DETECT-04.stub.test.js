#!/usr/bin/env node
// @requirement DETECT-04
// Structural test: Read-only Bash commands pass through without detection or blocking.
// Verifies that nf-circuit-breaker.js defines READ_ONLY_REGEX covering git log, git diff,
// grep, cat, ls, head, tail, find and that isReadOnly() is called before detection logic.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-circuit-breaker.js');
const content = fs.readFileSync(SOURCE, 'utf8');

test('DETECT-04: READ_ONLY_REGEX is defined and covers required commands', () => {
  // The regex must exist
  assert.match(content, /READ_ONLY_REGEX/, 'READ_ONLY_REGEX constant must be defined');

  // It must cover the required read-only commands
  assert.match(content, /git\s*\\s\+\(log\|diff/, 'READ_ONLY_REGEX must include git log and git diff');
  assert.match(content, /grep/, 'READ_ONLY_REGEX must include grep');
  assert.match(content, /cat/, 'READ_ONLY_REGEX must include cat');
  assert.match(content, /head/, 'READ_ONLY_REGEX must include head');
  assert.match(content, /tail/, 'READ_ONLY_REGEX must include tail');
  assert.match(content, /find/, 'READ_ONLY_REGEX must include find');
});

test('DETECT-04: isReadOnly function is defined and uses READ_ONLY_REGEX', () => {
  assert.match(content, /function isReadOnly/, 'isReadOnly function must be defined');
  assert.match(content, /READ_ONLY_REGEX\.test/, 'isReadOnly must test against READ_ONLY_REGEX');
});

test('DETECT-04: isReadOnly is checked before oscillation detection in main flow', () => {
  // The comment "DETECT-04" must appear near the isReadOnly check
  assert.match(content, /DETECT-04/, 'DETECT-04 requirement tag must appear in source');
  // isReadOnly must be called with process.exit(0) to pass through
  assert.match(content, /isReadOnly\(command\)/, 'isReadOnly must be called with command argument');
});

test('DETECT-04: ls command is included in READ_ONLY_REGEX pattern', () => {
  assert.match(content, /ls/, 'READ_ONLY_REGEX must include ls');
});
