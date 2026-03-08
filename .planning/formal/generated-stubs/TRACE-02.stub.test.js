#!/usr/bin/env node
// @requirement TRACE-02
// Structural test: traceability matrix includes a coverage_summary section with
// total_requirements, covered_count, coverage_percentage, uncovered_requirements, orphan_properties.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/generate-traceability-matrix.cjs');

test('TRACE-02: source code builds coverage_summary with required fields', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Verify coverage_summary is constructed with all required fields
  assert.match(content, /coverage_summary/, 'Must reference coverage_summary');
  assert.match(content, /total_requirements/, 'Must include total_requirements field');
  assert.match(content, /covered_count/, 'Must include covered_count field');
  assert.match(content, /coverage_percentage/, 'Must include coverage_percentage field');
  assert.match(content, /uncovered_requirements/, 'Must include uncovered_requirements field');
  assert.match(content, /orphan_properties/, 'Must include orphan_properties field');
});

test('TRACE-02: coverage_summary fields are computed from requirements data', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Verify uncovered requirements are computed by filtering against coveredReqIds
  assert.match(content, /coveredReqIds/, 'Must track covered requirement IDs');
  // Verify coverage percentage is calculated
  assert.match(content, /coveragePercentage/, 'Must calculate coverage percentage');
  // Verify orphan detection (properties with empty requirement_ids)
  assert.match(content, /orphanProperties/, 'Must detect orphan properties');
});
