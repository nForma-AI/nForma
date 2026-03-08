#!/usr/bin/env node
// @requirement DISP-02
// Structural test: nf-prompt.js reads scoreboard availability windows and excludes
// slots whose available_at is in the future from dispatch.
// Verifies getAvailableSlots() function structure and its integration into dispatch.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-prompt.js');
const content = fs.readFileSync(SOURCE, 'utf8');

test('DISP-02: getAvailableSlots function is defined', () => {
  assert.match(content, /function getAvailableSlots/, 'getAvailableSlots must be defined');
});

test('DISP-02: getAvailableSlots reads scoreboard availability section', () => {
  assert.match(content, /scoreboard\.availability/, 'Must read scoreboard.availability');
});

test('DISP-02: getAvailableSlots compares available_at_iso against current time', () => {
  assert.match(content, /available_at_iso/, 'Must reference available_at_iso field');
  assert.match(content, /Date\.now\(\)|new Date\(\)/, 'Must compare against current time');
});

test('DISP-02: slots with future available_at are excluded (filtered out)', () => {
  // ts > now means the slot is still cooling down and should be excluded
  assert.match(content, /ts\s*>\s*now/, 'Must check if timestamp is in the future');
  assert.match(content, /return false/, 'Must return false to exclude cooling-down slots');
});

test('DISP-02: getAvailableSlots is called in dispatch flow with DISP-02 tag', () => {
  assert.match(content, /DISP-02/, 'DISP-02 requirement tag must appear in source');
  assert.match(content, /getAvailableSlots\(cappedSlots/, 'getAvailableSlots must be called on cappedSlots');
});

test('DISP-02: getAvailableSlots is fail-open (returns all slots on error)', () => {
  assert.match(content, /function getAvailableSlots[\s\S]*?catch[\s\S]*?return slots/,
    'getAvailableSlots must return all slots on error (fail-open)');
});
