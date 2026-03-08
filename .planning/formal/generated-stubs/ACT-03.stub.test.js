#!/usr/bin/env node
// @requirement ACT-03
// Auto-generated stub for uncovered invariant: ActivityClear

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const gsdToolsSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs'),
  'utf8'
);

test('ACT-03 — ActivityClear: activity-clear CLI command exists', () => {
  assert.match(gsdToolsSrc, /case\s+'activity-clear'/,
    'activity-clear command must be registered in CLI switch');
});

test('ACT-03 — ActivityClear: cmdActivityClear function removes the file idempotently', () => {
  assert.match(gsdToolsSrc, /function\s+cmdActivityClear/,
    'cmdActivityClear function must be defined');

  // Verify it uses unlinkSync (file removal)
  assert.match(gsdToolsSrc, /fs\.unlinkSync\(filePath\)/,
    'cmdActivityClear must use fs.unlinkSync to remove the file');
});

test('ACT-03 — ActivityClear: cmdActivitySet function writes the file', () => {
  assert.match(gsdToolsSrc, /function\s+cmdActivitySet/,
    'cmdActivitySet function must be defined');

  assert.match(gsdToolsSrc, /case\s+'activity-set'/,
    'activity-set command must be registered in CLI switch');
});
