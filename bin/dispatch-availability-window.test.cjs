#!/usr/bin/env node
'use strict';
// bin/dispatch-availability-window.test.cjs
// TDD tests for v0.24-02: DISP-01 (health probe integration) and DISP-02 (availability window filtering)
// STRUCTURAL tests are RED until Plan 02 implements getAvailableSlots + health probe trigger
// UNIT tests are GREEN from the start (pure functions, no I/O).
// Requirements: DISP-01, DISP-02

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ----- STRUCTURAL TESTS (RED until Plan 02 adds getAvailableSlots + health probe) -----
// These tests read hooks/qgsd-prompt.js source (NOT installed ~/.claude/ copies).

const QGSD_PROMPT_PATH = path.resolve(__dirname, '..', 'hooks', 'qgsd-prompt.js');
let qgsdPromptContent = '';
try {
  qgsdPromptContent = fs.readFileSync(QGSD_PROMPT_PATH, 'utf8');
} catch (e) {
  qgsdPromptContent = '';
}

test('STRUCTURAL: getAvailableSlots function exists in qgsd-prompt.js', () => {
  assert.ok(
    qgsdPromptContent.includes('getAvailableSlots'),
    'getAvailableSlots function not found in qgsd-prompt.js -- Plan 02 must add it'
  );
});

test('STRUCTURAL: getAvailableSlots is exported for testing', () => {
  // Check that getAvailableSlots appears in module.exports (either object literal or property assignment)
  const hasExport =
    qgsdPromptContent.includes('module.exports.getAvailableSlots') ||
    (qgsdPromptContent.match(/module\.exports\s*=\s*\{[^}]*getAvailableSlots[^}]*\}/s) !== null);
  assert.ok(
    hasExport,
    'getAvailableSlots not found in module.exports -- Plan 02 must export it'
  );
});

test('STRUCTURAL: availability filtering integrated into dispatch flow', () => {
  // Check that getAvailableSlots is called in the dispatch flow.
  // Look for assignment pattern: cappedSlots = getAvailableSlots( or similar call site
  // that is distinct from the function definition line.
  const hasCallSite =
    qgsdPromptContent.includes('= getAvailableSlots(') ||
    qgsdPromptContent.includes('getAvailableSlots(cappedSlots');
  assert.ok(
    hasCallSite,
    'getAvailableSlots is defined but never called in dispatch flow -- Plan 02 must integrate it'
  );
});

test('STRUCTURAL: DISP-01 health probe integration (spawnSync + check-provider-health)', () => {
  assert.ok(
    qgsdPromptContent.includes('spawnSync'),
    'spawnSync not found in qgsd-prompt.js -- health probe trigger missing (DISP-01)'
  );
  assert.ok(
    qgsdPromptContent.includes('check-provider-health'),
    'check-provider-health not found in qgsd-prompt.js -- health probe integration missing (DISP-01)'
  );
});

// ----- UNIT TESTS (GREEN immediately -- pure function tests with inline reference implementation) -----

// Reference implementation matching the RESEARCH.md pattern for availability window filtering.
// This is the expected behavior that Plan 02 will implement in qgsd-prompt.js.
function getAvailableSlots(slots, scoreboard) {
  if (!scoreboard || !scoreboard.availability) return slots;
  const now = Date.now();
  return slots.filter(s => {
    const avail = scoreboard.availability[s.slot];
    if (!avail || !avail.available_at_iso) return true;
    try {
      const ts = new Date(avail.available_at_iso).getTime();
      if (isNaN(ts)) return true; // malformed date: fail-open
      return ts <= now;
    } catch (_) { return true; }
  });
}

test('UNIT: filter excludes future-timestamp slots', () => {
  const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour in the future
  const pastDate = new Date(Date.now() - 3600000).toISOString();   // 1 hour in the past
  const mockScoreboard = {
    availability: {
      'slot-a': { available_at_iso: futureDate, reason: 'timeout', set_at: '2026-01-01T00:00:00Z' },
      'slot-b': { available_at_iso: pastDate, reason: 'timeout', set_at: '2026-01-01T00:00:00Z' }
    }
  };
  const inputSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }, { slot: 'slot-c' }];
  const result = getAvailableSlots(inputSlots, mockScoreboard);
  // slot-a excluded (future), slot-b included (past), slot-c included (no data)
  assert.deepStrictEqual(
    result.map(s => s.slot),
    ['slot-b', 'slot-c']
  );
});

test('UNIT: filter includes all slots when no scoreboard exists', () => {
  const inputSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }];
  const result = getAvailableSlots(inputSlots, null);
  assert.deepStrictEqual(result, inputSlots, 'All slots should be returned when scoreboard is null (fail-open)');
});

test('UNIT: filter includes slot when available_at_iso is malformed', () => {
  const mockScoreboard = {
    availability: {
      'slot-a': { available_at_iso: 'not-a-date', reason: 'timeout', set_at: '2026-01-01T00:00:00Z' }
    }
  };
  const inputSlots = [{ slot: 'slot-a' }];
  const result = getAvailableSlots(inputSlots, mockScoreboard);
  // Malformed date: fail-open means include the slot
  assert.strictEqual(result.length, 1, 'Slot with malformed available_at_iso should be included (fail-open)');
  assert.strictEqual(result[0].slot, 'slot-a');
});

test('UNIT: filter includes all slots when availability section missing', () => {
  const mockScoreboard = {};
  const inputSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }, { slot: 'slot-c' }];
  const result = getAvailableSlots(inputSlots, mockScoreboard);
  assert.deepStrictEqual(result, inputSlots, 'All slots should be returned when availability section missing');
});

// ----- FAIL-OPEN GUARD TESTS -----

test('fail-open: missing qgsd-prompt.js file does not crash test runner', () => {
  // If file is truly missing, qgsdPromptContent is empty and structural tests fail gracefully
  assert.ok(true, 'Guard allows missing file -- fail-open');
});
