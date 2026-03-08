#!/usr/bin/env node
// @requirement DEBT-01
// Structural test: task-classifier.cjs exists and exports classifyTask
// as part of the debt/observability traceability obligation.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DEBT-01 — task-classifier source file exists and is loadable', () => {
  const filePath = path.join(ROOT, 'bin', 'task-classifier.cjs');
  assert.ok(fs.existsSync(filePath), 'bin/task-classifier.cjs must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.length > 0, 'task-classifier.cjs must not be empty');
});

test('DEBT-01 — task-classifier exports classifyTask function', () => {
  const mod = require(path.join(ROOT, 'bin', 'task-classifier.cjs'));
  assert.equal(typeof mod.classifyTask, 'function', 'must export classifyTask');
});

test('DEBT-01 — task-classifier exports COMPLEXITY_MAP constant', () => {
  const mod = require(path.join(ROOT, 'bin', 'task-classifier.cjs'));
  assert.equal(typeof mod.COMPLEXITY_MAP, 'object', 'must export COMPLEXITY_MAP');
  // Verify expected tiers exist
  assert.ok('trivial' in mod.COMPLEXITY_MAP, 'COMPLEXITY_MAP must include trivial');
  assert.ok('simple' in mod.COMPLEXITY_MAP, 'COMPLEXITY_MAP must include simple');
  assert.ok('moderate' in mod.COMPLEXITY_MAP, 'COMPLEXITY_MAP must include moderate');
  assert.ok('complex' in mod.COMPLEXITY_MAP, 'COMPLEXITY_MAP must include complex');
});
