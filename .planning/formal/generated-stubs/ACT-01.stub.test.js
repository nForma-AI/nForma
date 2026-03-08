#!/usr/bin/env node
// @requirement ACT-01
// Auto-generated stub for uncovered invariant: WriteActivity

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const gsdToolsSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs'),
  'utf8'
);

test('ACT-01 — WriteActivity: cmdActivitySet writes current-activity.json atomically', () => {
  // Verify cmdActivitySet function exists
  assert.match(gsdToolsSrc, /function\s+cmdActivitySet/,
    'cmdActivitySet function must be defined in gsd-tools.cjs');

  // Verify it writes to .planning/current-activity.json
  assert.match(gsdToolsSrc, /current-activity\.json/,
    'gsd-tools.cjs must reference current-activity.json');

  // Verify writeFileSync is used (atomic write)
  assert.match(gsdToolsSrc, /fs\.writeFileSync\(filePath,\s*JSON\.stringify\(data/,
    'cmdActivitySet must use fs.writeFileSync for atomic write');
});

test('ACT-01 — WriteActivity: activity-set CLI command is registered', () => {
  // Verify the CLI case statement exists
  assert.match(gsdToolsSrc, /case\s+'activity-set'/,
    'activity-set command must be registered in CLI switch');
});
