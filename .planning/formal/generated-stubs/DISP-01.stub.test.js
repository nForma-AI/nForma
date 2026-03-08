#!/usr/bin/env node
// @requirement DISP-01
// Structural test: nf-prompt.js runs a fast health probe (<3s) per provider before
// building the dispatch list. Dead providers' slots are excluded from DISPATCH_LIST.
// Verifies triggerHealthProbe() and getDownProviderSlots() exist and are wired into dispatch.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../hooks/nf-prompt.js');
const content = fs.readFileSync(SOURCE, 'utf8');

test('DISP-01: triggerHealthProbe function is defined', () => {
  assert.match(content, /function triggerHealthProbe/, 'triggerHealthProbe must be defined');
});

test('DISP-01: triggerHealthProbe uses 3s timeout', () => {
  // The timeout must be <= 3000ms per the requirement (<3s)
  assert.match(content, /timeout:\s*3000/, 'Health probe must use 3000ms timeout');
});

test('DISP-01: triggerHealthProbe is called before dispatch list construction', () => {
  // DISP-01 comment marks where the probe is called
  assert.match(content, /DISP-01.*triggerHealthProbe|triggerHealthProbe\(\)[\s\S]*?DISP-01/,
    'triggerHealthProbe must be called, tagged with DISP-01');
});

test('DISP-01: getDownProviderSlots function is defined for filtering dead providers', () => {
  assert.match(content, /function getDownProviderSlots/, 'getDownProviderSlots must be defined');
});

test('DISP-01: dead provider slots are filtered from dispatch list', () => {
  // providerSkips must be used to filter cappedSlots
  assert.match(content, /providerSkips\s*=\s*getDownProviderSlots/,
    'providerSkips must be populated from getDownProviderSlots');
  assert.match(content, /skipSet/, 'skipSet must be used to filter out dead provider slots');
});

test('DISP-01: health probe is fail-open (does not block dispatch on failure)', () => {
  // triggerHealthProbe must have try/catch with fail-open behavior
  assert.match(content, /function triggerHealthProbe[\s\S]*?catch[\s\S]*?fail-open/,
    'triggerHealthProbe must be fail-open');
});
