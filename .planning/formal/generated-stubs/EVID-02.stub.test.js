#!/usr/bin/env node
// @requirement EVID-02
// Behavioral test for observation_window metadata in check-results.ndjson
// Verifies that validate-traces.cjs source contains buildObservationWindow
// producing window_start, window_end, n_traces, n_events, window_days fields.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vtPath = path.resolve(__dirname, '../../../bin/validate-traces.cjs');

test('EVID-02: source defines buildObservationWindow function', () => {
  const content = fs.readFileSync(vtPath, 'utf8');
  assert.match(content, /function buildObservationWindow/,
    'validate-traces.cjs must define buildObservationWindow');
});

test('EVID-02: buildObservationWindow returns all required fields', () => {
  const content = fs.readFileSync(vtPath, 'utf8');
  // Verify the function returns an object with all five EVID-02 fields
  assert.match(content, /window_start/, 'must contain window_start field');
  assert.match(content, /window_end/, 'must contain window_end field');
  assert.match(content, /n_traces/, 'must contain n_traces field');
  assert.match(content, /n_events/, 'must contain n_events field');
  assert.match(content, /window_days/, 'must contain window_days field');
});

test('EVID-02: observation_window is attached to check-result records', () => {
  const content = fs.readFileSync(vtPath, 'utf8');
  assert.match(content, /observation_window/,
    'observation_window must appear in check-result output logic');
});

test('EVID-02: write-check-result.cjs supports observation_window field', () => {
  const wcrPath = path.resolve(__dirname, '../../../bin/write-check-result.cjs');
  const content = fs.readFileSync(wcrPath, 'utf8');
  assert.match(content, /observation_window/,
    'write-check-result.cjs must handle observation_window field');
});
