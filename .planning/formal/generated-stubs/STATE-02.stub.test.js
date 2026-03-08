#!/usr/bin/env node
// @requirement STATE-02
// Verifies TypeOK: state schema { active, file_set[], activated_at, commit_window_snapshot[] }
// captures what triggered the breaker (structural strategy).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CB_SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-circuit-breaker.js');

test('STATE-02: circuit breaker state object contains all TypeOK fields', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // The writeState function must construct an object with all four schema fields
  assert.match(content, /active:\s*true/,
    'State schema must include active field');
  assert.match(content, /file_set:/,
    'State schema must include file_set field');
  assert.match(content, /activated_at:/,
    'State schema must include activated_at field');
  assert.match(content, /commit_window_snapshot:/,
    'State schema must include commit_window_snapshot field');
});

test('STATE-02: TLA+ model defines TypeOK with bounded domains', () => {
  const tlaPath = path.resolve(__dirname, '..', 'tla', 'QGSDBreakerState.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');

  // TypeOK must use bounded ranges, not raw Nat/Int
  assert.match(content, /TypeOK\s*==/,
    'TLA+ model must define TypeOK');
  assert.match(content, /fileExists\s+\\in\s+BOOLEAN/,
    'fileExists domain must be BOOLEAN');
  assert.match(content, /active\s+\\in\s+BOOLEAN/,
    'active domain must be BOOLEAN');
  assert.match(content, /fileSet\s+\\in\s+SUBSET\s*\(0\.\.3\)/,
    'fileSet domain must be bounded SUBSET (0..3)');
  assert.match(content, /commitWindow\s+\\in\s+0\.\.5/,
    'commitWindow domain must be bounded 0..5');
});

test('STATE-02: readState returns parsed state or null on error', () => {
  const content = fs.readFileSync(CB_SOURCE, 'utf8');

  // readState must handle missing file and parse errors gracefully
  assert.match(content, /function\s+readState/,
    'readState function must exist');
  assert.match(content, /JSON\.parse/,
    'readState must parse JSON');
  assert.match(content, /return\s+null/,
    'readState must return null on error');
});
