#!/usr/bin/env node
// @requirement AGT-01
// Structural test: QGSDAgentLoop.tla exists and contains TypeOK invariant with @requirement AGT-01

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('AGT-01 — QGSDAgentLoop.tla contains TypeOK invariant annotated with @requirement AGT-01', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDAgentLoop.tla');
  assert.ok(fs.existsSync(tlaPath), 'QGSDAgentLoop.tla must exist');

  const content = fs.readFileSync(tlaPath, 'utf8');

  // Verify TypeOK invariant is defined
  assert.match(content, /^TypeOK\s*==/m, 'TypeOK invariant must be defined');

  // Verify @requirement AGT-01 annotation exists
  assert.match(content, /@requirement\s+AGT-01/, '@requirement AGT-01 annotation must be present');

  // Verify the model defines the expected state variables for autonomous looping
  assert.match(content, /iteration/, 'Model must track iteration count');
  assert.match(content, /status/, 'Model must track agent status');
  assert.match(content, /goalMet/, 'Model must track whether goal is met');
});
