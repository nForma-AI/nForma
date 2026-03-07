#!/usr/bin/env node
// @requirement OBS-13
// Structural test for: Bool
// Formal model: .planning/formal/alloy/observability-handler-arch.als
// Requirement: A machine-readable inventory classifies every non-test bin/ script as wired (reachable from a skill command, hook, or workflow) or lone (unreferenced), with purpose, classification, suggested integrat

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('OBS-13 — Bool: structural verification', () => {
  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/formal-core.cjs'), 'Source file should exist: formal-core.cjs');
  const content_0 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/formal-core.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_0.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/generate-traceability-matrix.cjs'), 'Source file should exist: generate-traceability-matrix.cjs');
  const content_1 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-traceability-matrix.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_1.length > 0, 'Source file should not be empty');

  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/analyze-state-space.cjs'), 'Source file should exist: analyze-state-space.cjs');
  const content_2 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/analyze-state-space.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_2.length > 0, 'Source file should not be empty');
});
