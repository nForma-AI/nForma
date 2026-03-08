#!/usr/bin/env node
// @requirement ANNOT-05
// Structural test: traceability matrix generator reads extracted annotations
// as primary data source, with model-registry requirements arrays as fallback.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/generate-traceability-matrix.cjs');

test('ANNOT-05: generate-traceability-matrix.cjs exists', () => {
  assert.ok(fs.existsSync(SOURCE), 'bin/generate-traceability-matrix.cjs must exist');
});

test('ANNOT-05: references extract-annotations as primary data source', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /extract-annotations/, 'must reference extract-annotations.cjs as primary source');
});

test('ANNOT-05: references model-registry.json as fallback', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /model-registry\.json/, 'must reference model-registry.json as fallback');
});

test('ANNOT-05: documents annotation-primary, registry-fallback priority', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // The source must mention both primary and fallback data source semantics
  assert.match(content, /primary/, 'must document primary data source');
  assert.match(content, /fallback/, 'must document fallback data source');
});
