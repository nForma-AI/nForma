#!/usr/bin/env node
'use strict';

/**
 * quorum-preflight-probe.test.cjs — Unit tests for the two-layer health probe
 * added to bin/quorum-preflight.cjs behind the --probe flag.
 *
 * Run: node --test test/quorum-preflight-probe.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SCRIPT = path.join(__dirname, '..', 'bin', 'quorum-preflight.cjs');
const EXEC_OPTS = { timeout: 15000, encoding: 'utf8' };

function runPreflight(args) {
  // Use execFileSync for safety — no shell injection risk
  return execFileSync('node', [SCRIPT, ...args], { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] });
}

describe('quorum-preflight --probe', () => {

  // ── Test 1: --no-probe skips health probes ──────────────────────────────
  it('--all --no-probe returns standard keys only', () => {
    const raw = runPreflight(['--all', '--no-probe']);
    const data = JSON.parse(raw);

    assert.ok(Array.isArray(data.quorum_active), 'quorum_active should be an array');
    assert.strictEqual(typeof data.max_quorum_size, 'number', 'max_quorum_size should be a number');
    assert.strictEqual(typeof data.team, 'object', 'team should be an object');

    // Probe-specific keys must be absent
    assert.strictEqual(data.health, undefined, 'health should be absent without --probe');
    assert.strictEqual(data.available_slots, undefined, 'available_slots should be absent without --probe');
    assert.strictEqual(data.unavailable_slots, undefined, 'unavailable_slots should be absent without --probe');
  });

  // ── Test 2: Probe output shape (default with --all) ─────────────────────
  it('--all returns health, available_slots, unavailable_slots by default', () => {
    const raw = runPreflight(['--all']);
    const data = JSON.parse(raw);

    // Standard keys still present
    assert.ok(Array.isArray(data.quorum_active), 'quorum_active present');
    assert.strictEqual(typeof data.max_quorum_size, 'number', 'max_quorum_size present');
    assert.strictEqual(typeof data.team, 'object', 'team present');

    // Probe keys
    assert.strictEqual(typeof data.health, 'object', 'health should be an object');
    assert.ok(Array.isArray(data.available_slots), 'available_slots should be an array');
    assert.ok(Array.isArray(data.unavailable_slots), 'unavailable_slots should be an array');

    // available + unavailable should cover all team keys
    const teamNames = Object.keys(data.team).sort();
    const allProbed = [
      ...data.available_slots,
      ...data.unavailable_slots.map(u => u.name),
    ].sort();
    assert.deepStrictEqual(allProbed, teamNames, 'available + unavailable should cover all team slots');
  });

  // ── Test 3: Health entry structure ──────────────────────────────────────
  it('each health entry has healthy, layer1, layer2 with ok + reason', () => {
    const raw = runPreflight(['--all', '--probe']);
    const data = JSON.parse(raw);

    for (const [name, entry] of Object.entries(data.health)) {
      assert.strictEqual(typeof entry.healthy, 'boolean', `${name}: healthy should be boolean`);
      assert.strictEqual(typeof entry.layer1, 'object', `${name}: layer1 should be object`);
      assert.strictEqual(typeof entry.layer1.ok, 'boolean', `${name}: layer1.ok should be boolean`);
      assert.strictEqual(typeof entry.layer1.reason, 'string', `${name}: layer1.reason should be string`);
      assert.strictEqual(typeof entry.layer2, 'object', `${name}: layer2 should be object`);
      assert.strictEqual(typeof entry.layer2.ok, 'boolean', `${name}: layer2.ok should be boolean`);
      assert.strictEqual(typeof entry.layer2.reason, 'string', `${name}: layer2.reason should be string`);
    }
  });

  // ── Test 4: Layer2 skipped for non-ccr slots ───────────────────────────
  it('non-ccr slots (codex, gemini, opencode, copilot) have layer2.skipped === true', () => {
    const raw = runPreflight(['--all', '--probe']);
    const data = JSON.parse(raw);

    const nonCcrPrefixes = ['codex-', 'gemini-', 'opencode-', 'copilot-'];

    for (const [name, entry] of Object.entries(data.health)) {
      const isNonCcr = nonCcrPrefixes.some(prefix => name.startsWith(prefix));
      if (isNonCcr) {
        assert.strictEqual(entry.layer2.skipped, true, `${name}: layer2.skipped should be true for non-ccr slot`);
        assert.strictEqual(entry.layer2.reason, 'no upstream API', `${name}: layer2.reason should be 'no upstream API'`);
      }
    }
  });

  // ── Test 5: Execution time under 8s ────────────────────────────────────
  it('--all --probe completes in under 8s', () => {
    const start = Date.now();
    runPreflight(['--all', '--probe']);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 8000, `Expected under 8000ms, got ${elapsed}ms`);
  });

  // ── Test 6: Missing/malformed ~/.claude.json ───────────────────────────
  it('handles missing ~/.claude.json gracefully (no crash, ccr slots layer2 skipped)', () => {
    const claudeJson = path.join(os.homedir(), '.claude.json');
    const backup = claudeJson + '.bak-probe-test';
    let hadFile = false;

    try {
      // Backup existing file if present
      if (fs.existsSync(claudeJson)) {
        hadFile = true;
        fs.copyFileSync(claudeJson, backup);
        // Write malformed JSON to simulate corruption
        fs.writeFileSync(claudeJson, '{ this is not valid json!!!', 'utf8');
      }

      const raw = runPreflight(['--all', '--probe']);
      const data = JSON.parse(raw);

      // Should not crash — we got valid JSON
      assert.strictEqual(typeof data.health, 'object', 'health should still be present');

      // All ccr slots (claude-*) should have layer2 skipped
      for (const [name, entry] of Object.entries(data.health)) {
        if (name.startsWith('claude-')) {
          assert.strictEqual(entry.layer2.skipped, true,
            `${name}: layer2 should be skipped when ~/.claude.json is malformed`);
        }
      }
    } finally {
      // Restore
      if (hadFile && fs.existsSync(backup)) {
        fs.copyFileSync(backup, claudeJson);
        fs.unlinkSync(backup);
      }
    }
  });

  // ── Test 7: cacheAge field present for non-skipped layer2 ──────────────
  it('layer2 entries (non-skipped) have cacheAge field as "fresh" or "cached"', () => {
    const raw = runPreflight(['--all', '--probe']);
    const data = JSON.parse(raw);

    for (const [name, entry] of Object.entries(data.health)) {
      if (!entry.layer2.skipped) {
        assert.ok(
          entry.layer2.cacheAge === 'fresh' || entry.layer2.cacheAge === 'cached',
          `${name}: layer2.cacheAge should be "fresh" or "cached", got "${entry.layer2.cacheAge}"`
        );
      }
    }
  });

});
