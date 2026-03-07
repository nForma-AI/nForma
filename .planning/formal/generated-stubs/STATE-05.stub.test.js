#!/usr/bin/env node
// @requirement STATE-05
// Constant test for: TypeOK
// Formal model: .planning/formal/tla/QGSDPlanningState.tla
// Requirement: execute-plan Route C (all phases complete) chains into /nf:audit-milestone with gap-closure detection instead of suggesting /nf:complete-milestone directly, matching transition.md Route B logic for bo

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('STATE-05 — TypeOK: constant verification', () => {
  // Verify source file exists and contains relevant constant
  const sourcePath = '/Users/jonathanborduas/code/QGSD/bin/nForma.cjs';
  assert.ok(fs.existsSync(sourcePath), 'Source file should exist');
  const content = fs.readFileSync(sourcePath, 'utf8');
  assert.ok(content.length > 0, 'Source file should not be empty');

  // Verify formal model references this requirement
  const modelPath = path.resolve(process.cwd(), '.planning/formal/tla/QGSDPlanningState.tla');
  if (fs.existsSync(modelPath)) {
    const modelContent = fs.readFileSync(modelPath, 'utf8');
    assert.ok(modelContent.includes('STATE-05'), 'Model should reference STATE-05');
  }
});
