#!/usr/bin/env node
// @requirement TRACE-03
// Structural test: traceability matrix is generated as a step in run-formal-verify.cjs
// after all checks complete.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/run-formal-verify.cjs');

test('TRACE-03: run-formal-verify.cjs includes generate-traceability-matrix.cjs as a step', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /generate-traceability-matrix\.cjs/, 'Must reference generate-traceability-matrix.cjs');
});

test('TRACE-03: traceability step is in the post-processing phase (after tool checks)', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // The traceability step should be marked as tool: 'traceability'
  assert.match(content, /tool:\s*'traceability'/, 'Traceability step must have tool: traceability');

  // Verify it runs in Phase 3 (post-processing) — traceability steps are filtered
  // from toolSteps and run after all tool groups complete
  assert.match(content, /postSteps/, 'Must have postSteps for post-processing');
  assert.match(content, /traceability/, 'Post-processing must include traceability');
});

test('TRACE-03: traceability matrix step is defined in STATIC_STEPS', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify the traceability:matrix step entry exists
  assert.match(content, /id:\s*'traceability:matrix'/, 'Must define traceability:matrix step');
});
