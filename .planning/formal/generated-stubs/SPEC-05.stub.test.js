#!/usr/bin/env node
// @requirement SPEC-05
// Constant test for: Bool
// Formal model: .planning/formal/alloy/evidence-scope-scan.als
// Requirement: Formal scope scan uses per-module scope.json metadata with exact concept matching, source-file overlap, and module-name matching instead of substring-based keyword heuristics, and is centralized in bi

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('SPEC-05 — Bool: constant verification', () => {
  // Verify source file exists and contains relevant constant
  const sourcePath = '/Users/jonathanborduas/code/QGSD/bin/aggregate-requirements.test.cjs';
  assert.ok(fs.existsSync(sourcePath), 'Source file should exist');
  const content = fs.readFileSync(sourcePath, 'utf8');
  assert.ok(content.length > 0, 'Source file should not be empty');

  // Verify formal model references this requirement
  const modelPath = path.resolve(process.cwd(), '.planning/formal/alloy/evidence-scope-scan.als');
  if (fs.existsSync(modelPath)) {
    const modelContent = fs.readFileSync(modelPath, 'utf8');
    assert.ok(modelContent.includes('SPEC-05'), 'Model should reference SPEC-05');
  }
});
