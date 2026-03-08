#!/usr/bin/env node
// @requirement ACT-01
// Structural test: current-activity.json is written atomically at every major workflow state transition

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GSD_TOOLS = path.join(process.env.HOME, '.claude/nf/bin/gsd-tools.cjs');

test('ACT-01: gsd-tools activity-set writes current-activity.json atomically via writeFileSync', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  // cmdActivitySet must use fs.writeFileSync for atomic write
  assert.match(content, /function\s+cmdActivitySet/, 'cmdActivitySet function must exist');
  assert.match(content, /writeFileSync\(filePath,\s*JSON\.stringify\(data/, 'must use writeFileSync for atomic write');
  assert.match(content, /current-activity\.json/, 'must reference current-activity.json');
});

test('ACT-01: execute-phase workflow calls activity-set at workflow state transitions', () => {
  const epPath = path.join(process.env.HOME, '.claude/nf/workflows/execute-phase.md');
  const content = fs.readFileSync(epPath, 'utf8');
  // Must contain activity-set calls for major transitions
  assert.match(content, /activity-set/, 'execute-phase must call activity-set');
  assert.match(content, /execute_phase/, 'must track execute_phase activity');
});

test('ACT-01: TLA+ model defines WriteActivity action for ACT-01', () => {
  const tlaPath = path.join(__dirname, '../tla/QGSDActivityTracking.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /WriteActivity\(act\)\s*==/, 'TLA+ model must define WriteActivity action');
  assert.match(content, /@requirement ACT-01/, 'TLA+ model must tag ACT-01 requirement');
});
