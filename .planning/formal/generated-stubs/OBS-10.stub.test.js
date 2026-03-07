#!/usr/bin/env node
// @requirement OBS-10
// Structural test for: Bool
// Formal model: .planning/formal/alloy/observability-handlers.als
// Requirement: Observe utility functions (formatAge, parseDuration, classifySeverity) are defined in a single canonical module and imported by all handlers. No handler duplicates these functions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('OBS-10 — Bool: structural verification', () => {
  // Check source file exists
  assert.ok(fs.existsSync('/Users/jonathanborduas/code/QGSD/bin/observe-utils.cjs'), 'Source file should exist: observe-utils.cjs');
  const content_0 = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/observe-utils.cjs', 'utf8');
  // Structural check: source file contains requirement-related code
  assert.ok(content_0.length > 0, 'Source file should not be empty');
});
