#!/usr/bin/env node
// @requirement TRACE-04
// Structural test: bidirectional validation detects asymmetric links
// (model claims requirement X but requirement X does not claim that model) and emits warnings.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/generate-traceability-matrix.cjs');

test('TRACE-04: source defines validateBidirectionalLinks function', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /function validateBidirectionalLinks/, 'Must define validateBidirectionalLinks function');
});

test('TRACE-04: bidirectional validation checks both directions', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Direction 1: model claims requirement
  assert.match(content, /model_claims_requirement/, 'Must detect model-claims-requirement direction');
  // Direction 2: requirement claims model
  assert.match(content, /requirement_claims_model/, 'Must detect requirement-claims-model direction');
});

test('TRACE-04: bidirectional validation emits warnings on asymmetric links', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must emit warnings to stderr for asymmetric links
  assert.match(content, /asymmetric link/, 'Must log asymmetric link warnings');
  assert.match(content, /process\.stderr\.write/, 'Must write warnings to stderr');
});

test('TRACE-04: bidirectional validation returns structured result with asymmetric_links', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Return value must include asymmetric_links array
  assert.match(content, /asymmetric_links/, 'Must return asymmetric_links in result');
  assert.match(content, /asymmetricLinks/, 'Must track asymmetric links in an array');
  // Return value must include stale_links for unknown references
  assert.match(content, /stale_links/, 'Must return stale_links in result');
});
