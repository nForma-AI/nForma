#!/usr/bin/env node
// @requirement ACT-07
// Structural test: gsd-tools.cjs contains activity-clear command for clearing activity on workflow completion

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs');

test('ACT-07 — ClearActivity: gsd-tools exposes activity-clear command', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /activity-clear/, 'gsd-tools must contain activity-clear command');
  assert.match(content, /current-activity\.json/, 'activity-clear must target current-activity.json');
});
