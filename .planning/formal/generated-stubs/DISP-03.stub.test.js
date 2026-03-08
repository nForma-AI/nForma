#!/usr/bin/env node
// @requirement DISP-03
// Structural test: Dispatch list ordered by recent success rate from scoreboard slot stats
// rather than static FALLBACK-01 tier sequence. Most reliable slots dispatched first.
// Verifies sortBySuccessRate() function structure and its integration into dispatch.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-prompt.js');
const content = fs.readFileSync(SOURCE, 'utf8');

test('DISP-03: sortBySuccessRate function is defined', () => {
  assert.match(content, /function sortBySuccessRate/, 'sortBySuccessRate must be defined');
});

test('DISP-03: sortBySuccessRate reads scoreboard slots section', () => {
  assert.match(content, /scoreboard\.slots/, 'Must read scoreboard.slots');
});

test('DISP-03: success rate computed from tp and fn values', () => {
  // tp = true positive, fn = false negative — success rate = tp / (tp + fn)
  assert.match(content, /totalTp/, 'Must aggregate tp (true positive) values');
  assert.match(content, /totalFn/, 'Must aggregate fn (false negative) values');
  assert.match(content, /totalTp\s*\/\s*\(totalTp\s*\+\s*totalFn\)/, 'Rate must be tp/(tp+fn)');
});

test('DISP-03: slots are sorted with most reliable first', () => {
  // Sort must use .sort() comparing rates
  assert.match(content, /\.sort\(/, 'Must use .sort() to order slots');
  assert.match(content, /getRate\(b\.slot\)\s*-\s*getRate\(a\.slot\)/, 'Must sort by rate descending (b - a)');
});

test('DISP-03: sortBySuccessRate is called in dispatch flow with DISP-03 tag', () => {
  assert.match(content, /DISP-03/, 'DISP-03 requirement tag must appear in source');
  assert.match(content, /sortBySuccessRate\(cappedSlots/, 'sortBySuccessRate must be called on cappedSlots');
});

test('DISP-03: sortBySuccessRate is fail-open (returns original order on error)', () => {
  assert.match(content, /function sortBySuccessRate[\s\S]*?catch[\s\S]*?return \[\.\.\.slots\]/,
    'sortBySuccessRate must return original slots on error (fail-open)');
});
