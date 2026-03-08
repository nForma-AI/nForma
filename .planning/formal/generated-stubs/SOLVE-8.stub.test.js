#!/usr/bin/env node
// @requirement SOLVE-8
// Structural test: verify solve-legacy-merge.als model and migrate-formal-dir.cjs
// encode canonical-wins conflict resolution and legacy detection before sweep.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

test('SOLVE-8: Alloy model solve-legacy-merge.als exists and defines Bool sig', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'solve-legacy-merge.als');
  assert.ok(fs.existsSync(modelPath), 'solve-legacy-merge.als must exist');
  const content = fs.readFileSync(modelPath, 'utf8');
  assert.match(content, /abstract sig Bool/, 'model must define abstract sig Bool');
});

test('SOLVE-8: Alloy model encodes CanonicalWins conflict policy', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'solve-legacy-merge.als');
  const content = fs.readFileSync(modelPath, 'utf8');
  assert.match(content, /one sig CanonicalWins/, 'model must define CanonicalWins policy');
  assert.match(content, /CanonicalWinsPolicy/, 'model must include CanonicalWinsPolicy fact');
  assert.match(content, /conflictResolution = CanonicalWins/, 'policy must enforce CanonicalWins');
});

test('SOLVE-8: Alloy model defines LegacyAlwaysDetected and CanonicalNeverOverwritten assertions', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'solve-legacy-merge.als');
  const content = fs.readFileSync(modelPath, 'utf8');
  assert.match(content, /assert LegacyAlwaysDetected/, 'model must assert LegacyAlwaysDetected');
  assert.match(content, /assert CanonicalNeverOverwritten/, 'model must assert CanonicalNeverOverwritten');
  assert.match(content, /assert LegacyUniquesMerged/, 'model must assert LegacyUniquesMerged');
});

test('SOLVE-8: migrate-formal-dir.cjs implements canonical-wins merge', () => {
  const srcPath = path.join(ROOT, 'bin', 'migrate-formal-dir.cjs');
  assert.ok(fs.existsSync(srcPath), 'migrate-formal-dir.cjs must exist');
  const content = fs.readFileSync(srcPath, 'utf8');
  // Must detect legacy .formal/ directory
  assert.match(content, /\.formal/, 'must reference .formal directory');
  // Must reference canonical .planning/formal/ location
  assert.match(content, /\.planning.*formal/, 'must reference .planning/formal canonical path');
  // Canonical wins = skip files that already exist in canonical
  assert.match(content, /skip/i, 'must skip conflicts (canonical wins)');
});
