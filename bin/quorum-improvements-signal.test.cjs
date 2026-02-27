'use strict';
// bin/quorum-improvements-signal.test.cjs
// Unit tests for quorum improvements signal emission and de-duplication
// Requirements: IMPR-02
//
// Tests validate the signal format described in commands/qgsd/quorum.md lines 449-471.
// collectImprovements and formatSignal are defined inline as pure functions implementing the spec.
// Pattern: QUORUM_IMPROVEMENTS_START|QUORUM_IMPROVEMENTS_END

const { test } = require('node:test');
const assert = require('node:assert');

// ── Inline implementation of collectImprovements and formatSignal ──
//
// collectImprovements(workerBlocks):
//   - Filter blocks: verdict !== 'UNAVAIL', improvements field is array with length > 0
//   - Flatten improvements from passing blocks
//   - De-duplicate by suggestion text (keep first occurrence)
//   - Add model field from the worker block's slot name to each improvement entry
//
// formatSignal(improvements):
//   - If empty: return single-line empty signal
//   - Otherwise: return multi-line signal with JSON array
//
// Source: commands/qgsd/quorum.md lines 449-471

function collectImprovements(workerBlocks) {
  if (!Array.isArray(workerBlocks)) return [];

  const seen = new Set();
  const collected = [];

  for (const block of workerBlocks) {
    // Skip UNAVAIL blocks
    if (block.verdict === 'UNAVAIL') continue;
    // Skip blocks with no improvements or empty improvements
    if (!Array.isArray(block.improvements) || block.improvements.length === 0) continue;

    for (const improvement of block.improvements) {
      if (!improvement.suggestion) continue;
      // De-duplicate by suggestion text
      if (seen.has(improvement.suggestion)) continue;
      seen.add(improvement.suggestion);
      collected.push({
        model: block.slot,
        suggestion: improvement.suggestion,
        rationale: improvement.rationale || '',
      });
    }
  }

  return collected;
}

function formatSignal(improvements) {
  if (!Array.isArray(improvements) || improvements.length === 0) {
    return '<!-- QUORUM_IMPROVEMENTS_START [] QUORUM_IMPROVEMENTS_END -->';
  }
  return `<!-- QUORUM_IMPROVEMENTS_START\n${JSON.stringify(improvements)}\nQUORUM_IMPROVEMENTS_END -->`;
}

function parseSignal(signalStr) {
  // Extract content between START and END delimiters
  const startDelim = 'QUORUM_IMPROVEMENTS_START';
  const endDelim = 'QUORUM_IMPROVEMENTS_END';
  const startIdx = signalStr.indexOf(startDelim);
  const endIdx = signalStr.indexOf(endDelim);
  if (startIdx === -1 || endIdx === -1) return null;
  const content = signalStr.slice(startIdx + startDelim.length, endIdx).trim();
  return JSON.parse(content);
}

// ── Test cases ────────────────────────────────────────────────────────────────

test('collectImprovements: collects improvements from two blocks with different suggestions', () => {
  const blocks = [
    {
      slot: 'claude-1',
      verdict: 'APPROVE',
      improvements: [
        { suggestion: 'Use constants for magic numbers', rationale: 'Readability' },
      ],
    },
    {
      slot: 'gemini-1',
      verdict: 'APPROVE',
      improvements: [
        { suggestion: 'Add input validation', rationale: 'Safety' },
      ],
    },
  ];
  const result = collectImprovements(blocks);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].model, 'claude-1');
  assert.strictEqual(result[0].suggestion, 'Use constants for magic numbers');
  assert.strictEqual(result[1].model, 'gemini-1');
  assert.strictEqual(result[1].suggestion, 'Add input validation');
});

test('collectImprovements: de-duplicates when two blocks have same suggestion text', () => {
  const blocks = [
    {
      slot: 'claude-1',
      verdict: 'APPROVE',
      improvements: [
        { suggestion: 'Add JSDoc comments', rationale: 'Documentation' },
      ],
    },
    {
      slot: 'gemini-1',
      verdict: 'APPROVE',
      improvements: [
        { suggestion: 'Add JSDoc comments', rationale: 'IDE support' },
      ],
    },
  ];
  const result = collectImprovements(blocks);
  // Only first occurrence kept
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].model, 'claude-1');
  assert.strictEqual(result[0].suggestion, 'Add JSDoc comments');
  assert.strictEqual(result[0].rationale, 'Documentation');
});

test('collectImprovements: skips UNAVAIL blocks', () => {
  const blocks = [
    {
      slot: 'codex-1',
      verdict: 'UNAVAIL',
      improvements: [
        { suggestion: 'Should be skipped', rationale: 'From unavailable model' },
      ],
    },
    {
      slot: 'gemini-1',
      verdict: 'APPROVE',
      improvements: [
        { suggestion: 'Valid improvement', rationale: 'From available model' },
      ],
    },
  ];
  const result = collectImprovements(blocks);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].model, 'gemini-1');
  assert.strictEqual(result[0].suggestion, 'Valid improvement');
});

test('collectImprovements: returns empty array when no blocks provided', () => {
  const result = collectImprovements([]);
  assert.deepStrictEqual(result, []);
});

test('collectImprovements: returns empty array when all blocks are UNAVAIL', () => {
  const blocks = [
    { slot: 'codex-1', verdict: 'UNAVAIL', improvements: [{ suggestion: 'x', rationale: 'y' }] },
    { slot: 'gemini-1', verdict: 'UNAVAIL', improvements: [{ suggestion: 'a', rationale: 'b' }] },
  ];
  const result = collectImprovements(blocks);
  assert.deepStrictEqual(result, []);
});

test('collectImprovements: returns empty array when blocks have no improvements field', () => {
  const blocks = [
    { slot: 'claude-1', verdict: 'APPROVE' },
    { slot: 'gemini-1', verdict: 'APPROVE', improvements: [] },
  ];
  const result = collectImprovements(blocks);
  assert.deepStrictEqual(result, []);
});

test('formatSignal: formats single-improvement array as multi-line signal', () => {
  const improvements = [
    { model: 'claude-1', suggestion: 'Use constants', rationale: 'Readability' },
  ];
  const signal = formatSignal(improvements);
  assert.ok(signal.startsWith('<!-- QUORUM_IMPROVEMENTS_START'));
  assert.ok(signal.endsWith('QUORUM_IMPROVEMENTS_END -->'));
  assert.ok(signal.includes('"model":"claude-1"'));
  assert.ok(signal.includes('"suggestion":"Use constants"'));
});

test('formatSignal: formats empty array as single-line empty signal', () => {
  const signal = formatSignal([]);
  assert.strictEqual(signal, '<!-- QUORUM_IMPROVEMENTS_START [] QUORUM_IMPROVEMENTS_END -->');
});

test('formatSignal: signal roundtrip — emit and parse back to same array', () => {
  const improvements = [
    { model: 'claude-1', suggestion: 'Validate inputs', rationale: 'Prevents errors' },
    { model: 'gemini-1', suggestion: 'Add retry logic', rationale: 'Reliability' },
  ];
  const signal = formatSignal(improvements);
  const parsed = parseSignal(signal);
  assert.deepStrictEqual(parsed, improvements);
});

test('formatSignal: empty array roundtrip — parse returns empty array', () => {
  const signal = formatSignal([]);
  const parsed = parseSignal(signal);
  assert.deepStrictEqual(parsed, []);
});

test('collectImprovements: handles null/undefined input without throwing', () => {
  assert.doesNotThrow(() => collectImprovements(null));
  assert.doesNotThrow(() => collectImprovements(undefined));
  assert.deepStrictEqual(collectImprovements(null), []);
  assert.deepStrictEqual(collectImprovements(undefined), []);
});

test('collectImprovements: multiple improvements from same block all collected', () => {
  const blocks = [
    {
      slot: 'claude-1',
      verdict: 'APPROVE',
      improvements: [
        { suggestion: 'First suggestion', rationale: 'Reason A' },
        { suggestion: 'Second suggestion', rationale: 'Reason B' },
      ],
    },
  ];
  const result = collectImprovements(blocks);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].suggestion, 'First suggestion');
  assert.strictEqual(result[1].suggestion, 'Second suggestion');
  // Both entries get the same model slot
  assert.strictEqual(result[0].model, 'claude-1');
  assert.strictEqual(result[1].model, 'claude-1');
});

test('collectImprovements: mixed UNAVAIL and available blocks — only available collected', () => {
  const blocks = [
    { slot: 'codex-1', verdict: 'UNAVAIL', improvements: [{ suggestion: 'Skip me', rationale: 'x' }] },
    { slot: 'claude-1', verdict: 'APPROVE', improvements: [{ suggestion: 'Keep me', rationale: 'y' }] },
    { slot: 'gemini-1', verdict: 'UNAVAIL', improvements: [{ suggestion: 'Skip too', rationale: 'z' }] },
  ];
  const result = collectImprovements(blocks);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestion, 'Keep me');
  assert.strictEqual(result[0].model, 'claude-1');
});
