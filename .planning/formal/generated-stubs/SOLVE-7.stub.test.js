#!/usr/bin/env node
// @requirement SOLVE-7
// Structural test: solve F->T remediation pipeline provides pre-resolved context
// (requirement text, formal property definition, source file hints) alongside each
// test stub so executors can generate meaningful tests without codebase-wide search.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FORMAL_TEST_SYNC_PATH = path.resolve(__dirname, '../../../bin/formal-test-sync.cjs');
const STUBS_DIR = path.resolve(__dirname);

test('SOLVE-7: formal-test-sync.cjs generateStubs produces recipe sidecar with pre-resolved context', () => {
  const content = fs.readFileSync(FORMAL_TEST_SYNC_PATH, 'utf8');
  // The recipe object must contain all required pre-resolved fields
  assert.match(content, /requirement_id/, 'recipe must include requirement_id');
  assert.match(content, /requirement_text/, 'recipe must include requirement_text');
  assert.match(content, /formal_property/, 'recipe must include formal_property');
  assert.match(content, /source_files/, 'recipe must include source_files');
  assert.match(content, /source_file_absolute/, 'recipe must include source_file_absolute');
  assert.match(content, /import_hint/, 'recipe must include import_hint');
  assert.match(content, /test_strategy/, 'recipe must include test_strategy');
});

test('SOLVE-7: existing recipe JSON files contain all required pre-resolved context fields', () => {
  // Validate that at least one generated recipe has the expected schema
  const recipeFiles = fs.readdirSync(STUBS_DIR).filter(f => f.endsWith('.stub.recipe.json'));
  assert.ok(recipeFiles.length > 0, 'at least one recipe JSON must exist in stubs dir');

  for (const file of recipeFiles.slice(0, 3)) {
    const recipe = JSON.parse(fs.readFileSync(path.join(STUBS_DIR, file), 'utf8'));
    assert.ok(recipe.requirement_id, `${file}: must have requirement_id`);
    assert.ok('requirement_text' in recipe, `${file}: must have requirement_text`);
    assert.ok(recipe.formal_property, `${file}: must have formal_property`);
    assert.ok('name' in recipe.formal_property, `${file}: formal_property must have name`);
    assert.ok('model_file' in recipe.formal_property, `${file}: formal_property must have model_file`);
    assert.ok(Array.isArray(recipe.source_files), `${file}: must have source_files array`);
    assert.ok('import_hint' in recipe, `${file}: must have import_hint`);
    assert.ok('test_strategy' in recipe, `${file}: must have test_strategy`);
  }
});

test('SOLVE-7: formal-test-sync.cjs exports findSourceFiles for source-file resolution', () => {
  const mod = require(FORMAL_TEST_SYNC_PATH);
  assert.equal(typeof mod.findSourceFiles, 'function', 'findSourceFiles must be exported');
});

test('SOLVE-7: formal-test-sync.cjs exports extractPropertyDefinition for formal property extraction', () => {
  const mod = require(FORMAL_TEST_SYNC_PATH);
  assert.equal(typeof mod.extractPropertyDefinition, 'function', 'extractPropertyDefinition must be exported');
});
