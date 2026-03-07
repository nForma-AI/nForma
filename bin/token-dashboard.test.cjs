'use strict';
// bin/token-dashboard.test.cjs
// Tests for token dashboard aggregation and cost estimation.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseTokenUsage, aggregateBySlot, aggregateBySession, estimateCost, formatDashboard } = require('./token-dashboard.cjs');

const TMP_DIR = path.join(__dirname, '..', '.test-tmp-dashboard');

function tmpFile(name) {
  return path.join(TMP_DIR, name);
}

describe('token-dashboard', () => {
  before(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  after(() => {
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (_) {}
  });

  describe('parseTokenUsage', () => {
    it('returns [] for missing file', () => {
      const result = parseTokenUsage('/nonexistent/path/file.jsonl');
      assert.deepStrictEqual(result, []);
    });

    it('returns [] for empty file', () => {
      const p = tmpFile('empty.jsonl');
      fs.writeFileSync(p, '', 'utf8');
      const result = parseTokenUsage(p);
      assert.deepStrictEqual(result, []);
    });

    it('skips malformed lines and returns valid records', () => {
      const p = tmpFile('mixed.jsonl');
      fs.writeFileSync(p, [
        '{"slot":"codex-1","input_tokens":100,"output_tokens":50}',
        'this is not json',
        '',
        '{"slot":"gemini-1","input_tokens":200,"output_tokens":75}',
        '{bad json',
      ].join('\n'), 'utf8');
      const result = parseTokenUsage(p);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].slot, 'codex-1');
      assert.strictEqual(result[1].slot, 'gemini-1');
    });

    it('returns correct record count for valid JSONL', () => {
      const p = tmpFile('valid.jsonl');
      fs.writeFileSync(p, [
        '{"slot":"codex-1","input_tokens":100,"output_tokens":50}',
        '{"slot":"codex-2","input_tokens":200,"output_tokens":75}',
        '{"slot":"gemini-1","input_tokens":300,"output_tokens":100}',
      ].join('\n'), 'utf8');
      const result = parseTokenUsage(p);
      assert.strictEqual(result.length, 3);
    });
  });

  describe('aggregateBySlot', () => {
    it('groups codex-1 and codex-2 under codex', () => {
      const records = [
        { slot: 'codex-1', input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10 },
        { slot: 'codex-2', input_tokens: 200, output_tokens: 75, cache_read_input_tokens: 20 },
        { slot: 'gemini-1', input_tokens: 300, output_tokens: 100, cache_read_input_tokens: 30 },
      ];
      const result = aggregateBySlot(records);
      assert.strictEqual(result.get('codex').input, 300);
      assert.strictEqual(result.get('codex').output, 125);
      assert.strictEqual(result.get('codex').cacheHit, 30);
      assert.strictEqual(result.get('codex').recordCount, 2);
      assert.strictEqual(result.get('gemini').input, 300);
      assert.strictEqual(result.get('gemini').recordCount, 1);
    });
  });

  describe('aggregateBySession', () => {
    it('groups by session_id correctly', () => {
      const records = [
        { session_id: 's1', input_tokens: 100, output_tokens: 50, ts: '2026-01-01T00:00:00Z' },
        { session_id: 's1', input_tokens: 200, output_tokens: 75, ts: '2026-01-01T01:00:00Z' },
        { session_id: 's2', input_tokens: 300, output_tokens: 100, ts: '2026-01-02T00:00:00Z' },
      ];
      const result = aggregateBySession(records);
      assert.strictEqual(result.get('s1').input, 300);
      assert.strictEqual(result.get('s1').output, 125);
      assert.strictEqual(result.get('s1').ts, '2026-01-01T00:00:00Z'); // earliest
      assert.strictEqual(result.get('s1').recordCount, 2);
      assert.strictEqual(result.get('s2').recordCount, 1);
    });
  });

  describe('estimateCost', () => {
    it('returns expected dollar amount for codex', () => {
      // codex: input $2.50/M, output $10.00/M
      // 1M input = $2.50, 500K output = $5.00 → total $7.50
      const result = estimateCost('codex', 1000000, 500000);
      assert.strictEqual(result.cost, 7.50);
      assert.strictEqual(result.isSubscription, undefined);
    });

    it('returns subscription for copilot', () => {
      const result = estimateCost('copilot', 1000000, 500000);
      assert.strictEqual(result.cost, 0);
      assert.strictEqual(result.isSubscription, true);
    });

    it('uses default rates for unknown slot', () => {
      // default: input $3.00/M, output $15.00/M
      // 1M input = $3.00, 500K output = $7.50 → total $10.50
      const result = estimateCost('unknown-slot', 1000000, 500000);
      assert.strictEqual(result.cost, 10.50);
    });

    it('charges cache read at 10% of input rate', () => {
      // codex: input $2.50/M
      // 1M cache read at 10% → $0.25
      const result = estimateCost('codex', 0, 0, 1000000);
      assert.strictEqual(result.cost, 0.25);
    });
  });

  describe('formatDashboard', () => {
    it('returns "No token usage data found." for empty records', () => {
      assert.strictEqual(formatDashboard([]), 'No token usage data found.');
      assert.strictEqual(formatDashboard(null), 'No token usage data found.');
    });

    it('contains expected column headers', () => {
      const records = [
        { slot: 'codex-1', input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, session_id: 's1', ts: '2026-01-01T00:00:00Z' },
      ];
      const output = formatDashboard(records);
      assert.ok(output.includes('Slot'));
      assert.ok(output.includes('Input'));
      assert.ok(output.includes('Output'));
      assert.ok(output.includes('Cache Hit%'));
      assert.ok(output.includes('Est. Cost'));
    });

    it('shows "subscription" not "$0.00" for copilot', () => {
      const records = [
        { slot: 'copilot-1', input_tokens: 12400, output_tokens: 5200, cache_read_input_tokens: 0, session_id: 's1', ts: '2026-01-01T00:00:00Z' },
      ];
      const output = formatDashboard(records);
      assert.ok(output.includes('subscription'), `Expected "subscription" in output, got:\n${output}`);
      // The copilot row itself must show "subscription", not "$0.00"
      const copilotLine = output.split('\n').find(l => l.includes('copilot'));
      assert.ok(copilotLine, 'Expected a copilot line in output');
      assert.ok(!copilotLine.includes('$0.00'), `Copilot row should show "subscription" not "$0.00", got: ${copilotLine}`);
    });

    it('includes total line with asterisk when subscription slots present', () => {
      const records = [
        { slot: 'codex-1', input_tokens: 100000, output_tokens: 50000, cache_read_input_tokens: 0, session_id: 's1', ts: '2026-01-01T00:00:00Z' },
        { slot: 'copilot-1', input_tokens: 12400, output_tokens: 5200, cache_read_input_tokens: 0, session_id: 's1', ts: '2026-01-01T00:00:00Z' },
      ];
      const output = formatDashboard(records);
      assert.ok(output.includes('TOTAL'));
      assert.ok(output.includes('*'));
      assert.ok(output.includes('excludes subscription'));
    });
  });
});
