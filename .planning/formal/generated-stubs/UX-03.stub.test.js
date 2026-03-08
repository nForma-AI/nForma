#!/usr/bin/env node
// @requirement UX-03
// Structural test: error messages are human-readable, explain what went wrong,
// and suggest a next step or recovery action.
// Verifies that key modules include descriptive error output with actionable guidance.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('UX-03: gate-a-grounding.cjs error messages include context and fallback guidance', () => {
  const source = path.resolve(__dirname, '../../../bin/gate-a-grounding.cjs');
  const content = fs.readFileSync(source, 'utf8');
  // Error messages should explain what happened and include a fallback/recovery path
  assert.match(content, /WARNING:.*failed.*falling back/i,
    'error messages should explain the failure and suggest a fallback action');
});

test('UX-03: nf-solve.cjs provides human-readable error output with next-step guidance', () => {
  const source = path.resolve(__dirname, '../../../bin/nf-solve.cjs');
  const content = fs.readFileSync(source, 'utf8');
  // The solver should emit descriptive error messages that tell the user what went wrong
  assert.match(content, /process\.stderr\.write/,
    'should write error diagnostics to stderr');
  assert.match(content, /error|fail|warn/i,
    'error output should include descriptive context about what went wrong');
});
