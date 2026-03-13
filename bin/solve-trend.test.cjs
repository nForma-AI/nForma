#!/usr/bin/env node
'use strict';

/**
 * solve-trend.test.cjs — Tests for JSONL trend append and scope-growth detection.
 * Requirements: TRACK-01, TRACK-04
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { appendTrendEntry, readGateSummary, readLastTrendEntry, LAYER_KEYS } = require('./solve-trend-helpers.cjs');

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), 'solve-trend-test-' + crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanUp(dir) {
  try { fs.rmSync(dir, { recursive: true }); } catch (_) { /* ignore */ }
}

/** Build a minimal mock residual with all 19 layer keys */
function mockResidual(overrides = {}) {
  const residual = { total: 42 };
  for (const key of LAYER_KEYS) {
    residual[key] = { residual: overrides[key] !== undefined ? overrides[key] : 1, detail: {} };
  }
  if (overrides.total !== undefined) residual.total = overrides.total;
  return residual;
}

/** Setup a fake project root with gates and requirements */
function setupFakeRoot(dir) {
  const formal = path.join(dir, '.planning', 'formal');
  const gates = path.join(formal, 'gates');
  fs.mkdirSync(gates, { recursive: true });

  // Gate files — use new field names (schema v2)
  fs.writeFileSync(path.join(gates, 'gate-a-grounding.json'), JSON.stringify({
    schema_version: '2', wiring_evidence_score: 0.85, target_met: true
  }));
  fs.writeFileSync(path.join(gates, 'gate-b-abstraction.json'), JSON.stringify({
    schema_version: '2', wiring_purpose_score: 0.5, target_met: false
  }));
  fs.writeFileSync(path.join(gates, 'gate-c-validation.json'), JSON.stringify({
    schema_version: '2', wiring_coverage_score: 0.9, target_met: true
  }));

  // Requirements file
  fs.writeFileSync(path.join(formal, 'requirements.json'), JSON.stringify({
    requirements: new Array(100).fill({ id: 'REQ' })
  }));

  return { formal, gates };
}

describe('solve-trend-helpers', () => {

  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanUp(tmpDir); });

  describe('readGateSummary', () => {
    it('reads all three gate scores', () => {
      setupFakeRoot(tmpDir);
      const result = readGateSummary(tmpDir);
      assert.deepStrictEqual(result.a, { score: 0.85, target_met: true });
      assert.deepStrictEqual(result.b, { score: 0.5, target_met: false });
      assert.deepStrictEqual(result.c, { score: 0.9, target_met: true });
    });

    it('returns null for missing gate files', () => {
      const result = readGateSummary(tmpDir);
      assert.strictEqual(result.a, null);
      assert.strictEqual(result.b, null);
      assert.strictEqual(result.c, null);
    });

    it('backward compat: reads legacy field names (schema v1)', () => {
      const formal = path.join(tmpDir, '.planning', 'formal');
      const gates = path.join(formal, 'gates');
      fs.mkdirSync(gates, { recursive: true });
      // Write old-format gate files with legacy field names
      fs.writeFileSync(path.join(gates, 'gate-a-grounding.json'), JSON.stringify({
        schema_version: '1', grounding_score: 0.75, target_met: false
      }));
      fs.writeFileSync(path.join(gates, 'gate-b-abstraction.json'), JSON.stringify({
        schema_version: '1', gate_b_score: 0.6, target_met: false
      }));
      fs.writeFileSync(path.join(gates, 'gate-c-validation.json'), JSON.stringify({
        schema_version: '1', gate_c_score: 0.7, target_met: false
      }));
      const result = readGateSummary(tmpDir);
      assert.deepStrictEqual(result.a, { score: 0.75, target_met: false });
      assert.deepStrictEqual(result.b, { score: 0.6, target_met: false });
      assert.deepStrictEqual(result.c, { score: 0.7, target_met: false });
    });
  });

  describe('appendTrendEntry', () => {

    it('entry schema validation — all required fields present', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const residual = mockResidual();

      appendTrendEntry(residual, true, 3, {
        root: tmpDir,
        trendPath,
        requirementsPath: path.join(formal, 'requirements.json'),
        gatesRoot: tmpDir,
      });

      const line = fs.readFileSync(trendPath, 'utf8').trim();
      const entry = JSON.parse(line);

      // Required fields
      assert.ok(entry.timestamp, 'has timestamp');
      assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/, 'timestamp is ISO 8601');
      assert.strictEqual(typeof entry.iteration_count, 'number');
      assert.strictEqual(typeof entry.converged, 'boolean');
      assert.strictEqual(typeof entry.total_residual, 'number');
      assert.strictEqual(typeof entry.per_layer, 'object');
      assert.strictEqual(typeof entry.gate_summary, 'object');
      assert.strictEqual(typeof entry.requirement_count, 'number');
      assert.strictEqual(typeof entry.fast_mode, 'boolean');
      assert.ok('scope_change' in entry, 'has scope_change field');
    });

    it('creates file on first run', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');

      assert.ok(!fs.existsSync(trendPath), 'file should not exist yet');

      appendTrendEntry(mockResidual(), false, 1, {
        root: tmpDir, trendPath,
        requirementsPath: path.join(formal, 'requirements.json'),
        gatesRoot: tmpDir,
      });

      assert.ok(fs.existsSync(trendPath), 'file should exist after first append');
      const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
      assert.strictEqual(lines.length, 1, 'exactly 1 line');
    });

    it('appends on subsequent runs', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const opts = {
        root: tmpDir, trendPath,
        requirementsPath: path.join(formal, 'requirements.json'),
        gatesRoot: tmpDir,
      };

      appendTrendEntry(mockResidual(), false, 1, opts);
      appendTrendEntry(mockResidual(), true, 2, opts);

      const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
      assert.strictEqual(lines.length, 2, 'should have 2 lines');
      // Both valid JSON
      assert.doesNotThrow(() => JSON.parse(lines[0]));
      assert.doesNotThrow(() => JSON.parse(lines[1]));
    });

    it('all 19 per_layer keys present', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');

      appendTrendEntry(mockResidual(), true, 1, {
        root: tmpDir, trendPath,
        requirementsPath: path.join(formal, 'requirements.json'),
        gatesRoot: tmpDir,
      });

      const entry = JSON.parse(fs.readFileSync(trendPath, 'utf8').trim());
      const keys = Object.keys(entry.per_layer);
      assert.strictEqual(keys.length, 19, 'should have exactly 19 per_layer keys');
      for (const k of LAYER_KEYS) {
        assert.ok(k in entry.per_layer, 'missing key: ' + k);
      }
    });

    it('fast-mode -1 preservation for missing layer', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const residual = mockResidual();
      // Simulate fast mode: remove t_to_c data
      delete residual.t_to_c;

      appendTrendEntry(residual, true, 1, {
        root: tmpDir, trendPath,
        requirementsPath: path.join(formal, 'requirements.json'),
        gatesRoot: tmpDir,
        fastMode: true,
      });

      const entry = JSON.parse(fs.readFileSync(trendPath, 'utf8').trim());
      assert.strictEqual(entry.per_layer.t_to_c, -1, 'missing layer should be -1');
      assert.strictEqual(entry.fast_mode, true);
    });

    it('scope_change=null on first entry', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');

      appendTrendEntry(mockResidual(), true, 1, {
        root: tmpDir, trendPath,
        requirementsPath: path.join(formal, 'requirements.json'),
        gatesRoot: tmpDir,
      });

      const entry = JSON.parse(fs.readFileSync(trendPath, 'utf8').trim());
      assert.strictEqual(entry.scope_change, null);
    });

    it('scope_change=SCOPE_GROWTH when requirement count increases', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const reqPath = path.join(formal, 'requirements.json');

      // First entry with 100 reqs
      appendTrendEntry(mockResidual(), true, 1, {
        root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
      });

      // Update to 110 reqs
      fs.writeFileSync(reqPath, JSON.stringify({
        requirements: new Array(110).fill({ id: 'REQ' })
      }));

      appendTrendEntry(mockResidual(), true, 2, {
        root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
      });

      const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
      const second = JSON.parse(lines[1]);
      assert.strictEqual(second.scope_change, 'SCOPE_GROWTH');
    });

    it('scope_change=STABLE when requirement count unchanged', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const reqPath = path.join(formal, 'requirements.json');

      appendTrendEntry(mockResidual(), true, 1, {
        root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
      });
      appendTrendEntry(mockResidual(), true, 2, {
        root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
      });

      const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
      const second = JSON.parse(lines[1]);
      assert.strictEqual(second.scope_change, 'STABLE');
    });

    it('scope_change=SCOPE_REDUCTION when requirement count decreases', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const reqPath = path.join(formal, 'requirements.json');

      // First with 100
      appendTrendEntry(mockResidual(), true, 1, {
        root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
      });

      // Reduce to 80
      fs.writeFileSync(reqPath, JSON.stringify({
        requirements: new Array(80).fill({ id: 'REQ' })
      }));

      appendTrendEntry(mockResidual(), true, 2, {
        root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
      });

      const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
      const second = JSON.parse(lines[1]);
      assert.strictEqual(second.scope_change, 'SCOPE_REDUCTION');
    });

    it('malformed line skipped — does not crash', () => {
      const { formal } = setupFakeRoot(tmpDir);
      const trendPath = path.join(formal, 'solve-trend.jsonl');
      const reqPath = path.join(formal, 'requirements.json');

      // Write a corrupted line first
      fs.mkdirSync(path.dirname(trendPath), { recursive: true });
      fs.writeFileSync(trendPath, 'this is not valid json\n');

      // Should not throw
      assert.doesNotThrow(() => {
        appendTrendEntry(mockResidual(), true, 1, {
          root: tmpDir, trendPath, requirementsPath: reqPath, gatesRoot: tmpDir,
        });
      });

      const lines = fs.readFileSync(trendPath, 'utf8').trim().split('\n');
      assert.strictEqual(lines.length, 2, 'corrupted line + new entry');
      const entry = JSON.parse(lines[1]);
      // No previous valid entry found, so scope_change should be null
      assert.strictEqual(entry.scope_change, null);
    });
  });

  describe('readLastTrendEntry', () => {
    it('returns null for non-existent file', () => {
      const result = readLastTrendEntry('/tmp/nonexistent-' + crypto.randomUUID() + '.jsonl');
      assert.strictEqual(result, null);
    });

    it('returns null for empty file', () => {
      const p = path.join(tmpDir, 'empty.jsonl');
      fs.writeFileSync(p, '');
      assert.strictEqual(readLastTrendEntry(p), null);
    });

    it('returns last valid entry skipping malformed', () => {
      const p = path.join(tmpDir, 'mixed.jsonl');
      fs.writeFileSync(p, '{"a":1}\ngarbage\n{"b":2}\n');
      const result = readLastTrendEntry(p);
      assert.deepStrictEqual(result, { b: 2 });
    });
  });
});
