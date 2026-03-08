#!/usr/bin/env node
// @requirement SPEC-05
// Constant/structural test: verify formal-scope-scan.cjs uses per-module scope.json
// with exact concept matching and source-file overlap instead of substring heuristics,
// and evidence-scope-scan.als encodes ExactMatchCriteria.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

test('SPEC-05: evidence-scope-scan.als exists and defines ExactMatchRequiresConceptAndOverlap', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'evidence-scope-scan.als');
  assert.ok(fs.existsSync(modelPath), 'evidence-scope-scan.als must exist');
  const content = fs.readFileSync(modelPath, 'utf8');
  assert.match(content, /assert ExactMatchRequiresConceptAndOverlap/, 'model must define ExactMatchRequiresConceptAndOverlap');
});

test('SPEC-05: Alloy model encodes ExactMatchCriteria fact', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'evidence-scope-scan.als');
  const content = fs.readFileSync(modelPath, 'utf8');
  assert.match(content, /fact ExactMatchCriteria/, 'must define ExactMatchCriteria fact');
  // Exact match requires concept match AND (source file overlap OR module name match)
  assert.match(content, /matchedConcepts/, 'must reference matchedConcepts');
  assert.match(content, /matchedSourceFiles/, 'must reference matchedSourceFiles');
  assert.match(content, /matchedModuleName/, 'must reference matchedModuleName');
});

test('SPEC-05: formal-scope-scan.cjs reads per-module scope.json metadata', () => {
  const srcPath = path.join(ROOT, 'bin', 'formal-scope-scan.cjs');
  assert.ok(fs.existsSync(srcPath), 'formal-scope-scan.cjs must exist');
  const content = fs.readFileSync(srcPath, 'utf8');
  assert.match(content, /scope\.json/, 'must read scope.json files');
  assert.match(content, /\.planning.*formal.*spec/, 'must read from .planning/formal/spec/ directory');
});

test('SPEC-05: formal-scope-scan.cjs uses exact concept matching (not substring heuristics)', () => {
  const srcPath = path.join(ROOT, 'bin', 'formal-scope-scan.cjs');
  const content = fs.readFileSync(srcPath, 'utf8');
  // Must have matchesConcepts function that uses exact token match
  assert.match(content, /matchesConcepts/, 'must define matchesConcepts function');
  // Must use tokens.includes (exact token match) not simple substring
  assert.match(content, /tokens\.includes/, 'must use exact token matching via tokens.includes');
});

test('SPEC-05: formal-scope-scan.cjs uses source-file overlap matching', () => {
  const srcPath = path.join(ROOT, 'bin', 'formal-scope-scan.cjs');
  const content = fs.readFileSync(srcPath, 'utf8');
  assert.match(content, /matchesSourceFiles/, 'must define matchesSourceFiles function');
  assert.match(content, /source_file/, 'must use source_file as match category');
});

test('SPEC-05: formal-scope-scan.cjs uses module-name matching', () => {
  const srcPath = path.join(ROOT, 'bin', 'formal-scope-scan.cjs');
  const content = fs.readFileSync(srcPath, 'utf8');
  assert.match(content, /matchesModuleName/, 'must define matchesModuleName function');
  assert.match(content, /module_name/, 'must use module_name as match category');
});
