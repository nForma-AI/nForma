#!/usr/bin/env node
// @requirement SPEC-05
// Constant test: formal-scope-scan uses per-module scope.json metadata with
// concepts array and source_files array (not substring keyword heuristics)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/jonathanborduas/code/QGSD';
const SPEC_DIR = path.join(ROOT, '.planning', 'formal', 'spec');
const SCAN_PATH = path.join(ROOT, 'bin', 'formal-scope-scan.cjs');

test('SPEC-05: formal-scope-scan.cjs exists', () => {
  assert.ok(fs.existsSync(SCAN_PATH));
});

test('SPEC-05: formal-scope-scan reads scope.json (not keyword heuristics)', () => {
  const content = fs.readFileSync(SCAN_PATH, 'utf8');
  assert.match(content, /scope\.json/, 'Must reference scope.json files');
  assert.match(content, /concepts/, 'Must use concepts for matching');
  assert.match(content, /source_files/, 'Must use source_files for matching');
});

test('SPEC-05: scope.json files contain concepts and source_files arrays', () => {
  const modules = fs.readdirSync(SPEC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  assert.ok(modules.length > 0, 'Expected at least one spec module');

  let checkedCount = 0;
  for (const mod of modules) {
    const scopePath = path.join(SPEC_DIR, mod, 'scope.json');
    if (!fs.existsSync(scopePath)) continue;
    const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
    assert.ok(Array.isArray(scope.concepts), `${mod}/scope.json must have concepts array`);
    assert.ok(Array.isArray(scope.source_files), `${mod}/scope.json must have source_files array`);
    checkedCount++;
  }
  assert.ok(checkedCount >= 1, 'Expected at least one scope.json validated');
});

test('SPEC-05: formal-scope-scan uses three matching strategies', () => {
  const content = fs.readFileSync(SCAN_PATH, 'utf8');
  // The three strategies from the requirement: source_file overlap, concept match, module_name match
  assert.match(content, /source_file/, 'Must implement source_file matching');
  assert.match(content, /concept/, 'Must implement concept matching');
  assert.match(content, /module_name/, 'Must implement module_name matching');
});
