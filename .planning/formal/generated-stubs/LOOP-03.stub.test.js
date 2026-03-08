#!/usr/bin/env node
// @requirement LOOP-03
// Test: sensitivity-sweep-feedback.cjs detects threshold violations and triggers PRISM re-run
// Formal property: FilterRoundsBounded (NFPreFilter.tla) — constant verification

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'bin', 'sensitivity-sweep-feedback.cjs');

test('LOOP-03: sensitivity-sweep-feedback.cjs exists', () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'bin/sensitivity-sweep-feedback.cjs must exist');
});

test('LOOP-03: DEVIATION_THRESHOLD constant is defined as 0.05', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const match = content.match(/const\s+DEVIATION_THRESHOLD\s*=\s*([\d.]+)/);
  assert.ok(match, 'DEVIATION_THRESHOLD constant must be defined');
  assert.strictEqual(parseFloat(match[1]), 0.05, 'DEVIATION_THRESHOLD must equal 0.05');
});

test('LOOP-03: script reads sensitivity-report.ndjson', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /sensitivity-report\.ndjson/, 'script must read sensitivity-report.ndjson');
});

test('LOOP-03: script triggers PRISM re-run on deviation', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');
  assert.match(content, /run-prism\.cjs/, 'script must invoke run-prism.cjs for PRISM re-run');
});

test('LOOP-03: FilterRoundsBounded invariant defined in NFPreFilter.tla', () => {
  const tlaPath = path.join(PROJECT_ROOT, '.planning', 'formal', 'tla', 'NFPreFilter.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /FilterRoundsBounded\s*==/, 'FilterRoundsBounded invariant must be defined in NFPreFilter.tla');
  assert.match(content, /filterRound\s*<=\s*MaxFilterRounds/, 'FilterRoundsBounded must bound filterRound to MaxFilterRounds');
});
