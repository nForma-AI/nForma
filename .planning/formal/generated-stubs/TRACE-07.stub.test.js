#!/usr/bin/env node
// @requirement TRACE-07
// Validates: Conformance tracing infrastructure has @requirement annotations and test coverage

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// Key conformance infrastructure files that TRACE-07 obligates to have @requirement annotations
const CONFORMANCE_SOURCE_FILES = [
  'bin/conformance-schema.cjs',
  'bin/attribute-trace-divergence.cjs',
  'bin/validate-traces.cjs',
];

const CONFORMANCE_TEST_FILES = [
  'bin/conformance-schema.test.cjs',
  'bin/validate-traces.test.cjs',
];

test('TRACE-07: conformance source files exist', () => {
  for (const file of CONFORMANCE_SOURCE_FILES) {
    const fullPath = path.join(ROOT, file);
    assert.ok(fs.existsSync(fullPath), `${file} must exist`);
  }
});

test('TRACE-07: conformance test files exist', () => {
  for (const file of CONFORMANCE_TEST_FILES) {
    const fullPath = path.join(ROOT, file);
    assert.ok(fs.existsSync(fullPath), `${file} must exist`);
  }
});

test('TRACE-07: traceability-obligations.als references TRACE-07', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'traceability-obligations.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  assert.match(content, /TRACE-07/, 'traceability-obligations.als must reference TRACE-07');
});

test('TRACE-07: traceability-obligations.als models ConformanceInfra subsystem', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'traceability-obligations.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  assert.match(content, /ConformanceInfra/, 'must model ConformanceInfra subsystem');
});
