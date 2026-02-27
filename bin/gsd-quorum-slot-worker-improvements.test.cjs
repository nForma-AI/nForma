'use strict';
// bin/gsd-quorum-slot-worker-improvements.test.cjs
// Unit tests for improvements parsing in qgsd-quorum-slot-worker
// Requirements: IMPR-01
//
// Tests validate the parsing spec described in agents/qgsd-quorum-slot-worker.md lines 251-260.
// parseImprovements is defined inline here as a pure function implementing the spec.
// Pattern: parseImprovements|Improvements:

const { test } = require('node:test');
const assert = require('node:assert');

// ── Inline implementation of parseImprovements (from spec: qgsd-quorum-slot-worker.md lines 251-260) ──
//
// Scans rawOutput for an 'Improvements:' section, parses each `- suggestion: ... rationale: ...`
// entry into { suggestion, rationale } objects. Returns array; omit field entirely when empty/absent.
// Never throws on parse errors — improvements are additive, not required.
//
// MAINTAINABILITY NOTE: If the spec in qgsd-quorum-slot-worker.md changes,
// update this implementation and its tests together.
function parseImprovements(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];

  const lines = rawOutput.split('\n');
  let inSection = false;
  const results = [];
  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section start
    if (!inSection && line.trimStart().startsWith('Improvements:')) {
      inSection = true;
      continue;
    }

    if (!inSection) continue;

    // Detect section end: non-indented non-empty line that isn't a list item
    const trimmed = line.trim();
    if (trimmed === '') continue; // blank lines: skip, stay in section

    // Check if this is a new top-level key (non-indented, non-list-item) — section ends
    if (!line.startsWith(' ') && !line.startsWith('\t') && !trimmed.startsWith('-') && trimmed !== '') {
      // End of improvements section
      if (currentEntry && currentEntry.suggestion && currentEntry.rationale) {
        results.push({ suggestion: currentEntry.suggestion, rationale: currentEntry.rationale });
      }
      currentEntry = null;
      inSection = false;
      continue;
    }

    // Match `- suggestion:` line — starts a new entry
    const suggestionMatch = trimmed.match(/^-\s+suggestion:\s*(.*)$/);
    if (suggestionMatch) {
      // Save previous entry if complete
      if (currentEntry && currentEntry.suggestion && currentEntry.rationale) {
        results.push({ suggestion: currentEntry.suggestion, rationale: currentEntry.rationale });
      }
      const val = stripQuotes(suggestionMatch[1].trim());
      currentEntry = { suggestion: val, rationale: null };
      continue;
    }

    // Match `rationale:` line (indented continuation)
    const rationaleMatch = trimmed.match(/^rationale:\s*(.*)$/);
    if (rationaleMatch && currentEntry) {
      const val = stripQuotes(rationaleMatch[1].trim());
      currentEntry.rationale = val;
      continue;
    }
  }

  // Flush last entry
  if (currentEntry && currentEntry.suggestion && currentEntry.rationale) {
    results.push({ suggestion: currentEntry.suggestion, rationale: currentEntry.rationale });
  }

  return results;
}

function stripQuotes(s) {
  if (!s) return s;
  // Strip surrounding single or double quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ── Test cases ────────────────────────────────────────────────────────────────

test('parseImprovements: returns two entries from output with two suggestions', () => {
  const output = `
verdict: APPROVE
reasoning: Looks good overall.

Improvements:
- suggestion: Use constants for magic numbers
  rationale: Improves readability and maintainability
- suggestion: Add JSDoc comments to public functions
  rationale: Enables IDE intellisense and documentation generation
`;
  const result = parseImprovements(output);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].suggestion, 'Use constants for magic numbers');
  assert.strictEqual(result[0].rationale, 'Improves readability and maintainability');
  assert.strictEqual(result[1].suggestion, 'Add JSDoc comments to public functions');
  assert.strictEqual(result[1].rationale, 'Enables IDE intellisense and documentation generation');
});

test('parseImprovements: returns empty array when no Improvements section present', () => {
  const output = `
verdict: APPROVE
reasoning: Looks good overall.
citations: |
  bin/foo.cjs line 42
`;
  const result = parseImprovements(output);
  assert.deepStrictEqual(result, []);
});

test('parseImprovements: skips entry missing suggestion field', () => {
  const output = `
Improvements:
- suggestion:
  rationale: This has no suggestion text
`;
  // suggestion is empty string — entry should be skipped (empty suggestion = falsy after trim)
  const result = parseImprovements(output);
  assert.deepStrictEqual(result, []);
});

test('parseImprovements: skips entry missing rationale field', () => {
  const output = `
Improvements:
- suggestion: Good suggestion here
`;
  // No rationale line — entry incomplete, should be skipped
  const result = parseImprovements(output);
  assert.deepStrictEqual(result, []);
});

test('parseImprovements: returns empty array for empty Improvements section', () => {
  const output = `
verdict: APPROVE

Improvements:

reasoning: other stuff here
`;
  const result = parseImprovements(output);
  assert.deepStrictEqual(result, []);
});

test('parseImprovements: returns empty array for malformed YAML (no list items)', () => {
  const output = `
Improvements:
  not-a-list: just some text
  another: line here
`;
  const result = parseImprovements(output);
  assert.deepStrictEqual(result, []);
});

test('parseImprovements: handles suggestion with quoted string value', () => {
  const output = `
Improvements:
- suggestion: "Extract shared utilities into a helper module"
  rationale: "Reduces duplication across three files"
`;
  const result = parseImprovements(output);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestion, 'Extract shared utilities into a helper module');
  assert.strictEqual(result[0].rationale, 'Reduces duplication across three files');
});

test('parseImprovements: result array is empty when no improvements — field correctly absent', () => {
  const output = 'verdict: APPROVE\nreasoning: No issues found.\n';
  const result = parseImprovements(output);
  assert.deepStrictEqual(result, []);
  // Simulate the result block omission: improvements field not set when array is empty
  const resultBlock = {};
  if (result.length > 0) {
    resultBlock.improvements = result;
  }
  assert.strictEqual('improvements' in resultBlock, false, 'improvements field should be omitted when array is empty');
});

test('parseImprovements: handles null/undefined input without throwing', () => {
  assert.doesNotThrow(() => parseImprovements(null));
  assert.doesNotThrow(() => parseImprovements(undefined));
  assert.doesNotThrow(() => parseImprovements(''));
  assert.deepStrictEqual(parseImprovements(null), []);
  assert.deepStrictEqual(parseImprovements(undefined), []);
  assert.deepStrictEqual(parseImprovements(''), []);
});

test('parseImprovements: handles single valid suggestion correctly', () => {
  const output = `
Improvements:
- suggestion: Validate input schema before processing
  rationale: Prevents downstream errors from malformed data
`;
  const result = parseImprovements(output);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestion, 'Validate input schema before processing');
  assert.strictEqual(result[0].rationale, 'Prevents downstream errors from malformed data');
});

test('parseImprovements: section ends at next top-level YAML key', () => {
  const output = `
reasoning: Initial reasoning.

Improvements:
- suggestion: Add retry logic for transient failures
  rationale: Improves reliability in flaky network environments

citations: |
  bin/bar.cjs line 99
`;
  const result = parseImprovements(output);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestion, 'Add retry logic for transient failures');
});

test('parseImprovements: handles output with only Improvements section and no surrounding content', () => {
  const output = `Improvements:
- suggestion: Use async/await consistently
  rationale: Avoids promise chain callback hell`;
  const result = parseImprovements(output);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestion, 'Use async/await consistently');
  assert.strictEqual(result[0].rationale, 'Avoids promise chain callback hell');
});

test('parseImprovements: partial entry (suggestion only, then next entry starts) — first entry skipped', () => {
  const output = `
Improvements:
- suggestion: First suggestion no rationale
- suggestion: Second suggestion with rationale
  rationale: This one is complete
`;
  const result = parseImprovements(output);
  // First entry lacks rationale so it's skipped; second is complete
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestion, 'Second suggestion with rationale');
});
