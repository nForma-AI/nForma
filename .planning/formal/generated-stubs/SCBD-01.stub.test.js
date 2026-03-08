#!/usr/bin/env node
// @requirement SCBD-01
// Structural: scoreboard tracks performance by slot name as the stable key

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// SCBD-01: Scoreboard tracks performance by slot name (claude-1, copilot-1).
// Structural strategy: verify update-scoreboard.cjs uses slot as the primary key.

test('SCBD-01: update-scoreboard.cjs accepts --slot argument', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/update-scoreboard.cjs'), 'utf8');
  assert.match(content, /--slot/, 'must accept --slot CLI argument');
});

test('SCBD-01: update-scoreboard.cjs has slot-keyed data structure', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/update-scoreboard.cjs'), 'utf8');
  assert.match(content, /slots\s*:\s*\{\}|slots\s*=\s*\{\}/,
    'must have a slots map in the scoreboard data structure');
});

test('SCBD-01: update-scoreboard.cjs creates per-slot stats entries', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/update-scoreboard.cjs'), 'utf8');
  assert.match(content, /emptySlotStats|slotStats|slot.*stats/i,
    'must have a function or structure for per-slot statistics');
});

test('SCBD-01: update-scoreboard.cjs slot stats include slot name field', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/update-scoreboard.cjs'), 'utf8');
  // The emptySlotStats function should include slot as a field
  assert.match(content, /slot.*model|{\s*slot/,
    'slot stats must include the slot name as a field');
});
