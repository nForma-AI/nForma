#!/usr/bin/env node
// @requirement UNIF-02
// Test: run-formal-verify.cjs generates check-results.ndjson as canonical output artifact

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('UNIF-02: run-formal-verify.cjs truncates check-results.ndjson at start of runOnce', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // UNIF-02 comment marks the truncation line
  assert.match(source, /check-results\.ndjson/, 'references check-results.ndjson');
  assert.match(source, /writeFileSync\(ndjsonPath,\s*''/,
    'truncates NDJSON file to empty string at start of run');
});

test('UNIF-02: run-formal-verify.cjs reads check-results.ndjson for summary at end', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // The summary section reads NDJSON and parses it
  assert.match(source, /readFileSync\(ndjsonPath/, 'reads NDJSON file for summary');
  assert.match(source, /JSON\.parse\(l\)/, 'parses each NDJSON line as JSON');
});

test('UNIF-02: NDJSON path is under .planning/formal/', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  assert.match(source, /\.planning.*formal.*check-results\.ndjson/,
    'NDJSON path is under .planning/formal/');
});
