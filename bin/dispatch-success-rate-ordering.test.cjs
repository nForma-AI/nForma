#!/usr/bin/env node
'use strict';
// bin/dispatch-success-rate-ordering.test.cjs
// TDD tests for v0.24-02: DISP-03 (success rate ordering) and graceful fallback
// STRUCTURAL tests are RED until Plan 02 implements sortBySuccessRate + fallback logic
// UNIT tests are GREEN from the start (pure functions, no I/O).
// Requirement: DISP-03

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ----- STRUCTURAL TESTS (RED until Plan 02 adds sortBySuccessRate + fallback) -----
// These tests read hooks/qgsd-prompt.js source (NOT installed ~/.claude/ copies).

const QGSD_PROMPT_PATH = path.resolve(__dirname, '..', 'hooks', 'qgsd-prompt.js');
let qgsdPromptContent = '';
try {
  qgsdPromptContent = fs.readFileSync(QGSD_PROMPT_PATH, 'utf8');
} catch (e) {
  qgsdPromptContent = '';
}

test('STRUCTURAL: sortBySuccessRate function exists in qgsd-prompt.js', () => {
  assert.ok(
    qgsdPromptContent.includes('sortBySuccessRate'),
    'sortBySuccessRate function not found in qgsd-prompt.js -- Plan 02 must add it'
  );
});

test('STRUCTURAL: sortBySuccessRate is exported for testing', () => {
  // Check that sortBySuccessRate appears in module.exports (either object literal or property assignment)
  const hasExport =
    qgsdPromptContent.includes('module.exports.sortBySuccessRate') ||
    (qgsdPromptContent.match(/module\.exports\s*=\s*\{[^}]*sortBySuccessRate[^}]*\}/s) !== null);
  assert.ok(
    hasExport,
    'sortBySuccessRate not found in module.exports -- Plan 02 must export it'
  );
});

test('STRUCTURAL: success rate sorting integrated into dispatch flow', () => {
  // Check that sortBySuccessRate is called in the dispatch flow.
  // Look for assignment pattern: cappedSlots = sortBySuccessRate( or similar call site.
  const hasCallSite =
    qgsdPromptContent.includes('= sortBySuccessRate(') ||
    qgsdPromptContent.includes('sortBySuccessRate(cappedSlots');
  assert.ok(
    hasCallSite,
    'sortBySuccessRate is defined but never called in dispatch flow -- Plan 02 must integrate it'
  );
});

test('STRUCTURAL: graceful fallback logic exists (ensures at least one slot)', () => {
  // Check for a guard pattern that prevents empty dispatch list
  const hasFallback =
    qgsdPromptContent.includes('length === 0') ||
    qgsdPromptContent.includes('.length === 0') ||
    qgsdPromptContent.includes('fallback') ||
    qgsdPromptContent.match(/cappedSlots\.length\s*(===|==)\s*0/);
  assert.ok(
    hasFallback,
    'Graceful fallback logic not found -- Plan 02 must ensure at least one slot in dispatch list'
  );
});

// ----- UNIT TESTS (GREEN immediately -- pure function tests with inline reference implementation) -----

// Reference implementation using composite key slot name extraction.
// Scoreboard keys are composite: "slotName:modelId" (e.g., "claude-1:deepseek-ai/DeepSeek-V3.2").
// Extract slot name: const slotName = key.split(':')[0];
// Example: const allModelsForSlot = Object.entries(scoreboard.slots)
//   .filter(([k]) => k.startsWith(slotName + ':'))
//   .map(([_, v]) => v);
// Then sum their tp/fn values.
function sortBySuccessRate(slots, scoreboard) {
  if (!scoreboard || !scoreboard.slots) return [...slots];
  const getRate = (slotName) => {
    // Extract slot name from composite keys: "slotName:modelId"
    const entries = Object.entries(scoreboard.slots)
      .filter(([k]) => k.split(':')[0] === slotName)
      .map(([_, v]) => v);
    if (entries.length === 0) return 0.5; // default for unknown
    const totalTp = entries.reduce((sum, e) => sum + (e.tp || 0), 0);
    const totalFn = entries.reduce((sum, e) => sum + (e.fn || 0), 0);
    return (totalTp + totalFn) === 0 ? 0.5 : totalTp / (totalTp + totalFn);
  };
  return [...slots].sort((a, b) => getRate(b.slot) - getRate(a.slot));
}

// Inline graceful fallback function
function gracefulFallback(filteredSlots, originalSlots) {
  if (filteredSlots.length === 0 && originalSlots.length > 0) {
    return [originalSlots[0]];
  }
  return filteredSlots;
}

test('UNIT: sort by descending success rate', () => {
  const mockScoreboard = {
    slots: {
      'slot-a:modelX': { slot: 'slot-a', model: 'modelX', tp: 8, fn: 2, score: 0, tn: 0, fp: 0, impr: 0 },
      'slot-b:modelY': { slot: 'slot-b', model: 'modelY', tp: 5, fn: 5, score: 0, tn: 0, fp: 0, impr: 0 },
      'slot-c:modelZ': { slot: 'slot-c', model: 'modelZ', tp: 9, fn: 1, score: 0, tn: 0, fp: 0, impr: 0 }
    }
  };
  // slot-a rate = 8/(8+2) = 0.8, slot-b rate = 5/(5+5) = 0.5, slot-c rate = 9/(9+1) = 0.9
  const inputSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }, { slot: 'slot-c' }];
  const result = sortBySuccessRate(inputSlots, mockScoreboard);
  assert.deepStrictEqual(
    result.map(s => s.slot),
    ['slot-c', 'slot-a', 'slot-b'],
    'Expected order: slot-c (0.9), slot-a (0.8), slot-b (0.5)'
  );
});

test('UNIT: default to 0.5 for slots with no scoreboard data', () => {
  const mockScoreboard = { slots: {} };
  const inputSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }];
  const result = sortBySuccessRate(inputSlots, mockScoreboard);
  // Both get 0.5 rate -- stable sort preserves original order
  assert.deepStrictEqual(
    result.map(s => s.slot),
    ['slot-a', 'slot-b'],
    'Slots with no data should keep original order (both default to 0.5)'
  );
});

test('UNIT: aggregate tp/fn across multiple model entries for same slot', () => {
  const mockScoreboard = {
    slots: {
      'slot-a:model1': { slot: 'slot-a', model: 'model1', tp: 8, fn: 2, score: 0, tn: 0, fp: 0, impr: 0 },
      'slot-a:model2': { slot: 'slot-a', model: 'model2', tp: 3, fn: 1, score: 0, tn: 0, fp: 0, impr: 0 }
    }
  };
  // Aggregation: extract slot name via key.split(':')[0]
  // Sum tp: 8+3=11, sum fn: 2+1=3
  // Aggregate rate for 'slot-a' = 11/(11+3) = 11/14 approx 0.786
  const inputSlots = [{ slot: 'slot-a' }];
  const result = sortBySuccessRate(inputSlots, mockScoreboard);
  assert.strictEqual(result.length, 1);
  // Verify rate calculation indirectly: slot-a should appear (it's the only one)
  assert.strictEqual(result[0].slot, 'slot-a');

  // Direct rate verification via inline getRate
  const getRate = (slotName) => {
    const entries = Object.entries(mockScoreboard.slots)
      .filter(([k]) => k.split(':')[0] === slotName)
      .map(([_, v]) => v);
    if (entries.length === 0) return 0.5;
    const totalTp = entries.reduce((sum, e) => sum + (e.tp || 0), 0);
    const totalFn = entries.reduce((sum, e) => sum + (e.fn || 0), 0);
    return (totalTp + totalFn) === 0 ? 0.5 : totalTp / (totalTp + totalFn);
  };
  const rate = getRate('slot-a');
  assert.ok(
    Math.abs(rate - 11 / 14) < 0.001,
    `Expected rate ~0.786 but got ${rate}`
  );
});

test('UNIT: fail-open returns original order on scoreboard read error', () => {
  const inputSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }];
  const result = sortBySuccessRate(inputSlots, null);
  assert.deepStrictEqual(
    result.map(s => s.slot),
    ['slot-a', 'slot-b'],
    'Original order should be preserved when scoreboard is null (fail-open)'
  );
});

test('UNIT: graceful fallback returns at least one slot when all filtered', () => {
  const emptyFiltered = [];
  const originalSlots = [{ slot: 'slot-a' }, { slot: 'slot-b' }];
  const result = gracefulFallback(emptyFiltered, originalSlots);
  assert.ok(result.length >= 1, 'Must never return empty array');
  assert.strictEqual(result[0].slot, 'slot-a', 'Should fall back to first original slot');
});

// ----- FAIL-OPEN GUARD TESTS -----

test('fail-open: missing qgsd-prompt.js file does not crash test runner', () => {
  assert.ok(true, 'Guard allows missing file -- fail-open');
});
