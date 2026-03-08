#!/usr/bin/env node
// @requirement ACT-06
// Structural test: gsd-tools.cjs contains activity-set command for writing activity at stage boundaries

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs');

test('ACT-06 — StageTransition: gsd-tools exposes activity-set command for stage-boundary writes', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /activity-set/, 'gsd-tools must contain activity-set command for writing activity state');
  assert.match(content, /current-activity\.json/, 'gsd-tools must reference current-activity.json');
});
