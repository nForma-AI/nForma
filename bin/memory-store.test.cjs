'use strict';
// bin/memory-store.test.cjs
// Tests for JSONL-based memory store (MEMP-01/03/04).

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getMemoryPath,
  appendEntry,
  readLastN,
  queryByField,
  isDuplicate,
  countEntries,
  generateSessionReminder,
  formatMemoryInjection,
  pruneOlderThan,
  MEMORY_DIR,
  FILES,
} = require('./memory-store.cjs');

let tmpDir;

function freshTmp() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-store-'));
  return tmpDir;
}

function cleanTmp() {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// Helper: write a raw JSONL line with a specific timestamp
function writeRawEntry(cwd, category, entry) {
  const dir = path.join(cwd, MEMORY_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, FILES[category]);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

describe('memory-store', () => {

  describe('constants', () => {
    it('exports expected file mappings', () => {
      assert.equal(FILES.decisions, 'decisions.jsonl');
      assert.equal(FILES.errors, 'errors.jsonl');
      assert.equal(FILES.quorum, 'quorum-decisions.jsonl');
      assert.equal(MEMORY_DIR, '.planning/memory');
    });
  });

  describe('getMemoryPath', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('returns correct path for each category', () => {
      assert.ok(getMemoryPath(tmpDir, 'decisions').endsWith('decisions.jsonl'));
      assert.ok(getMemoryPath(tmpDir, 'errors').endsWith('errors.jsonl'));
      assert.ok(getMemoryPath(tmpDir, 'quorum').endsWith('quorum-decisions.jsonl'));
    });

    it('creates .planning/memory/ directory if missing', () => {
      const dir = path.join(tmpDir, MEMORY_DIR);
      assert.ok(!fs.existsSync(dir));
      getMemoryPath(tmpDir, 'decisions');
      assert.ok(fs.existsSync(dir));
    });
  });

  describe('appendEntry', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('creates JSONL file and appends valid JSON line with ts field', () => {
      const result = appendEntry(tmpDir, 'decisions', { summary: 'Test', source: 'user' });
      assert.ok(result.ts, 'should have ts field');
      assert.equal(result.summary, 'Test');

      const filePath = getMemoryPath(tmpDir, 'decisions');
      const content = fs.readFileSync(filePath, 'utf8').trim();
      const parsed = JSON.parse(content);
      assert.equal(parsed.summary, 'Test');
      assert.ok(parsed.ts);
    });

    it('creates .planning/memory/ directory if missing', () => {
      const dir = path.join(tmpDir, MEMORY_DIR);
      assert.ok(!fs.existsSync(dir));
      appendEntry(tmpDir, 'decisions', { summary: 'Test' });
      assert.ok(fs.existsSync(dir));
    });

    it('appends multiple entries as separate lines', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'First' });
      appendEntry(tmpDir, 'decisions', { summary: 'Second' });
      const filePath = getMemoryPath(tmpDir, 'decisions');
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      assert.equal(lines.length, 2);
      assert.equal(JSON.parse(lines[0]).summary, 'First');
      assert.equal(JSON.parse(lines[1]).summary, 'Second');
    });
  });

  describe('readLastN', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('returns empty array when file missing', () => {
      const result = readLastN(tmpDir, 'decisions', 5);
      assert.deepStrictEqual(result, []);
    });

    it('returns last N entries in correct order (newest last)', () => {
      for (let i = 1; i <= 5; i++) {
        appendEntry(tmpDir, 'decisions', { summary: `Decision ${i}` });
      }
      const result = readLastN(tmpDir, 'decisions', 3);
      assert.equal(result.length, 3);
      assert.equal(result[0].summary, 'Decision 3');
      assert.equal(result[1].summary, 'Decision 4');
      assert.equal(result[2].summary, 'Decision 5');
    });

    it('skips malformed JSON lines gracefully', () => {
      const filePath = getMemoryPath(tmpDir, 'decisions');
      fs.appendFileSync(filePath, '{"summary":"Good"}\n', 'utf8');
      fs.appendFileSync(filePath, 'not-json\n', 'utf8');
      fs.appendFileSync(filePath, '{"summary":"AlsoGood"}\n', 'utf8');
      const result = readLastN(tmpDir, 'decisions', 5);
      assert.equal(result.length, 2);
      assert.equal(result[0].summary, 'Good');
      assert.equal(result[1].summary, 'AlsoGood');
    });

    it('returns all entries when N exceeds file size', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Only one' });
      const result = readLastN(tmpDir, 'decisions', 100);
      assert.equal(result.length, 1);
      assert.equal(result[0].summary, 'Only one');
    });
  });

  describe('queryByField', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('matches substring case-insensitively on specified field', () => {
      appendEntry(tmpDir, 'errors', { symptom: 'EACCES permission denied', fix: 'chmod' });
      appendEntry(tmpDir, 'errors', { symptom: 'ENOENT file not found', fix: 'create' });
      const result = queryByField(tmpDir, 'errors', 'symptom', 'eacces');
      assert.equal(result.length, 1);
      assert.ok(result[0].symptom.includes('EACCES'));
    });

    it('also matches on tags array values', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Some decision', tags: ['install', 'hooks'] });
      appendEntry(tmpDir, 'decisions', { summary: 'Other decision', tags: ['config'] });
      const result = queryByField(tmpDir, 'decisions', 'summary', 'hooks');
      assert.equal(result.length, 1);
      assert.equal(result[0].summary, 'Some decision');
    });

    it('returns results newest-first, respects limit', () => {
      for (let i = 1; i <= 10; i++) {
        appendEntry(tmpDir, 'errors', { symptom: `Error ${i} EACCES`, fix: `Fix ${i}` });
      }
      const result = queryByField(tmpDir, 'errors', 'symptom', 'eacces', 3);
      assert.equal(result.length, 3);
      assert.equal(result[0].symptom, 'Error 10 EACCES');
      assert.equal(result[1].symptom, 'Error 9 EACCES');
      assert.equal(result[2].symptom, 'Error 8 EACCES');
    });

    it('returns empty array when file missing', () => {
      const result = queryByField(tmpDir, 'errors', 'symptom', 'anything');
      assert.deepStrictEqual(result, []);
    });

    it('returns empty array when no matches found', () => {
      appendEntry(tmpDir, 'errors', { symptom: 'Some error', fix: 'Some fix' });
      const result = queryByField(tmpDir, 'errors', 'symptom', 'nonexistent');
      assert.deepStrictEqual(result, []);
    });
  });

  describe('isDuplicate', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('detects matching entries in recent history', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Use JSONL for storage' });
      assert.equal(isDuplicate(tmpDir, 'decisions', 'summary', 'Use JSONL for storage'), true);
    });

    it('returns false when no match exists', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Use JSONL for storage' });
      assert.equal(isDuplicate(tmpDir, 'decisions', 'summary', 'Something completely different'), false);
    });

    it('handles bidirectional substring matching', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Use JSONL' });
      // Needle contains hay
      assert.equal(isDuplicate(tmpDir, 'decisions', 'summary', 'Use JSONL for memory stores'), true);
      // Hay contains needle
      assert.equal(isDuplicate(tmpDir, 'decisions', 'summary', 'JSONL'), true);
    });

    it('is case-insensitive', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Use JSONL' });
      assert.equal(isDuplicate(tmpDir, 'decisions', 'summary', 'use jsonl'), true);
    });

    it('returns false for empty file', () => {
      assert.equal(isDuplicate(tmpDir, 'decisions', 'summary', 'anything'), false);
    });
  });

  describe('countEntries', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('returns 0 for missing file', () => {
      assert.equal(countEntries(tmpDir, 'decisions'), 0);
    });

    it('returns correct count for populated file', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'One' });
      appendEntry(tmpDir, 'decisions', { summary: 'Two' });
      appendEntry(tmpDir, 'decisions', { summary: 'Three' });
      assert.equal(countEntries(tmpDir, 'decisions'), 3);
    });

    it('returns 0 for empty file', () => {
      const filePath = getMemoryPath(tmpDir, 'decisions');
      fs.writeFileSync(filePath, '', 'utf8');
      assert.equal(countEntries(tmpDir, 'decisions'), 0);
    });
  });

  describe('generateSessionReminder', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('returns null when no memory entries exist', () => {
      assert.equal(generateSessionReminder(tmpDir), null);
    });

    it('includes last 3 decisions with phase and source', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Dec 1', phase: 'v0.30-01', source: 'quorum' });
      appendEntry(tmpDir, 'decisions', { summary: 'Dec 2', phase: 'v0.30-02', source: 'research' });
      appendEntry(tmpDir, 'decisions', { summary: 'Dec 3', phase: 'v0.30-03', source: 'user' });
      const result = generateSessionReminder(tmpDir);
      assert.ok(result.includes('SESSION MEMORY REMINDER:'));
      assert.ok(result.includes('[v0.30-01] Dec 1 (quorum)'));
      assert.ok(result.includes('[v0.30-02] Dec 2 (research)'));
      assert.ok(result.includes('[v0.30-03] Dec 3 (user)'));
    });

    it('includes error count and quorum count', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Dec 1', phase: 'test', source: 'user' });
      appendEntry(tmpDir, 'errors', { symptom: 'Err 1', fix: 'Fix 1' });
      appendEntry(tmpDir, 'errors', { symptom: 'Err 2', fix: 'Fix 2' });
      appendEntry(tmpDir, 'quorum', { question: 'Q1', chosen: 'A' });
      const result = generateSessionReminder(tmpDir);
      assert.ok(result.includes('Error patterns: 2 entries'));
      assert.ok(result.includes('Quorum decisions: 1 entries'));
    });

    it('respects 800 character cap', () => {
      // Add many long entries to exceed 800 chars
      for (let i = 0; i < 50; i++) {
        appendEntry(tmpDir, 'decisions', {
          summary: `Very long decision summary number ${i} with lots of extra text to pad the output beyond the character limit`,
          phase: 'v0.30-03',
          source: 'quorum',
        });
      }
      for (let i = 0; i < 50; i++) {
        appendEntry(tmpDir, 'errors', { symptom: `Error ${i}`, fix: `Fix ${i}` });
      }
      for (let i = 0; i < 50; i++) {
        appendEntry(tmpDir, 'quorum', { question: `Q${i}`, chosen: `A${i}` });
      }
      const result = generateSessionReminder(tmpDir);
      assert.ok(result.length <= 800, `Expected <= 800 chars, got ${result.length}`);
    });
  });

  describe('formatMemoryInjection', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('returns null when no memory entries exist', () => {
      assert.equal(formatMemoryInjection(tmpDir), null);
    });

    it('includes last 3 decisions and last 2 errors', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Dec A', phase: 'v0.30-01' });
      appendEntry(tmpDir, 'decisions', { summary: 'Dec B', phase: 'v0.30-02' });
      appendEntry(tmpDir, 'decisions', { summary: 'Dec C', phase: 'v0.30-03' });
      appendEntry(tmpDir, 'errors', { symptom: 'Err X', fix: 'Fix X' });
      appendEntry(tmpDir, 'errors', { symptom: 'Err Y', fix: 'Fix Y' });
      const result = formatMemoryInjection(tmpDir);
      assert.ok(result.includes('## Memory Snapshot'));
      assert.ok(result.includes('Dec A'));
      assert.ok(result.includes('Dec B'));
      assert.ok(result.includes('Dec C'));
      assert.ok(result.includes('Err X'));
      assert.ok(result.includes('Err Y'));
    });

    it('respects 1200 character cap', () => {
      for (let i = 0; i < 50; i++) {
        appendEntry(tmpDir, 'decisions', {
          summary: `Very long decision summary number ${i} with lots of extra text to pad output significantly`,
          phase: 'v0.30-03',
        });
      }
      for (let i = 0; i < 50; i++) {
        appendEntry(tmpDir, 'errors', {
          symptom: `Very long error symptom description number ${i} with lots of extra words`,
          fix: `Very long fix description number ${i} with lots of implementation detail text`,
        });
      }
      const result = formatMemoryInjection(tmpDir);
      assert.ok(result.length <= 1200, `Expected <= 1200 chars, got ${result.length}`);
    });

    it('includes query hint line', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Dec 1', phase: 'test' });
      const result = formatMemoryInjection(tmpDir);
      assert.ok(result.includes('Query more: node bin/memory-store.cjs query-decisions --last 10'));
    });
  });

  describe('pruneOlderThan', () => {
    beforeEach(() => freshTmp());
    afterEach(() => cleanTmp());

    it('removes entries older than N days', () => {
      const oldTs = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      writeRawEntry(tmpDir, 'decisions', { summary: 'Old entry', ts: oldTs });
      appendEntry(tmpDir, 'decisions', { summary: 'Recent entry' });

      const result = pruneOlderThan(tmpDir, 'decisions', 90);
      assert.equal(result.removed, 1);
      assert.equal(result.remaining, 1);

      const remaining = readLastN(tmpDir, 'decisions', 10);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].summary, 'Recent entry');
    });

    it('preserves entries within retention window', () => {
      appendEntry(tmpDir, 'decisions', { summary: 'Recent 1' });
      appendEntry(tmpDir, 'decisions', { summary: 'Recent 2' });
      const result = pruneOlderThan(tmpDir, 'decisions', 90);
      assert.equal(result.removed, 0);
      assert.equal(result.remaining, 2);
    });

    it('handles missing file gracefully', () => {
      const result = pruneOlderThan(tmpDir, 'decisions', 90);
      assert.deepStrictEqual(result, { removed: 0, remaining: 0 });
    });

    it('handles empty file gracefully', () => {
      const filePath = getMemoryPath(tmpDir, 'decisions');
      fs.writeFileSync(filePath, '', 'utf8');
      const result = pruneOlderThan(tmpDir, 'decisions', 90);
      assert.deepStrictEqual(result, { removed: 0, remaining: 0 });
    });
  });
});
