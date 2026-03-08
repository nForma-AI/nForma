#!/usr/bin/env node
// @requirement AGT-01
// Verifies QGSDAgentLoop.tla contains TypeOK invariant with correct state space

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MODEL_FILE = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDAgentLoop.tla');

test('AGT-01: QGSDAgentLoop.tla defines TypeOK invariant with autonomous loop state space', () => {
  const content = fs.readFileSync(MODEL_FILE, 'utf8');

  // TypeOK invariant must exist
  assert.match(content, /TypeOK\s*==/, 'TypeOK invariant definition must exist');

  // Must constrain status to the four terminal/running states
  assert.match(content, /"running"/, 'status must include "running"');
  assert.match(content, /"success"/, 'status must include "success"');
  assert.match(content, /"cap_exhausted"/, 'status must include "cap_exhausted"');
  assert.match(content, /"unrecoverable"/, 'status must include "unrecoverable"');

  // Must reference iteration bounded by MaxIterations
  assert.match(content, /iteration\s*\\in\s*0\.\.MaxIterations/, 'iteration must be bounded by MaxIterations');

  // Must have @requirement AGT-01 annotation on TypeOK
  assert.match(content, /@requirement\s+AGT-01/, '@requirement AGT-01 annotation must be present');
});
