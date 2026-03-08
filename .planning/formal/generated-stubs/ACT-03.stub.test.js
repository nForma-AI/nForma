#!/usr/bin/env node
// @requirement ACT-03
// Structural test: activity-set writes and activity-clear removes current-activity.json

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GSD_TOOLS = path.join(process.env.HOME, '.claude/nf/bin/gsd-tools.cjs');

test('ACT-03: gsd-tools has activity-set command that writes current-activity.json', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  assert.match(content, /case\s+'activity-set'/, 'must have activity-set command case');
  assert.match(content, /cmdActivitySet/, 'must dispatch to cmdActivitySet function');
  assert.match(content, /writeFileSync\(filePath/, 'cmdActivitySet must write file');
});

test('ACT-03: gsd-tools has activity-clear command that removes current-activity.json', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  assert.match(content, /case\s+'activity-clear'/, 'must have activity-clear command case');
  assert.match(content, /cmdActivityClear/, 'must dispatch to cmdActivityClear function');
  assert.match(content, /unlinkSync\(filePath\)/, 'cmdActivityClear must unlink file');
});

test('ACT-03: activity-clear is idempotent (no error if file absent)', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  // The try/catch around unlinkSync ensures idempotency
  assert.match(content, /try\s*\{\s*fs\.unlinkSync\(filePath\);\s*\}\s*catch/, 'activity-clear must catch missing file errors');
});

test('ACT-03: TLA+ model defines ActivityClear action for ACT-03', () => {
  const tlaPath = path.join(__dirname, '../tla/QGSDActivityTracking.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /ActivityClear\s*==/, 'TLA+ model must define ActivityClear action');
  assert.match(content, /@requirement ACT-03/, 'TLA+ model must tag ACT-03 requirement');
});
