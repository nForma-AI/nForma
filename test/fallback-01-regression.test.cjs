#!/usr/bin/env node
'use strict';
/** @requirement DISP-03 — regression test for FALLBACK-01 dispatch sequence ordering */

/**
 * Regression tests for FALLBACK-01 quorum dispatch sequence.
 *
 * Root cause (2026-03-11): Missing auth_type in nf.json caused T1 pool to be
 * permanently empty. The failoverRule builder only emitted the full FALLBACK-01
 * dispatch sequence when T1 had items, so with T1 empty the instruction degraded
 * to a generic "skip it" message — causing Claude to give up instead of trying
 * the remaining 8+ T2 slots.
 */

const assert = require('assert');

// The hook registers a stdin handler on require() — it's harmless (never fires
// since we don't pipe data), but we need the export. Just require it directly.
const { buildFalloverRule } = require('../hooks/nf-prompt.js');

const origLog = console.log;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    origLog(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    origLog(`  FAIL: ${name}`);
    origLog(`    ${e.message}`);
    failed++;
  }
}

origLog('FALLBACK-01 regression tests');
origLog('─'.repeat(50));

// ── REGRESSION CASE: The exact bug that was reported ─────────────────────

test('T1 empty + T2 has slots → must emit FALLBACK-01 (not "skip it")', () => {
  // This was the regression: no auth_type=sub slots, so T1 was empty.
  // T2 had 6 claude-* slots but the old code emitted "skip it" instead.
  const capped = [
    { slot: 'codex-1', authType: 'api' },
    { slot: 'gemini-1', authType: 'api' },
  ];
  const t1 = []; // empty — the regression trigger
  const t2 = ['claude-1', 'claude-2', 'claude-3', 'claude-4', 'claude-5', 'claude-6'];

  const rule = buildFalloverRule(capped, t1, t2, 3);

  assert.ok(rule.includes('FALLBACK-01'),
    'Must contain FALLBACK-01 keyword when T2 slots exist');
  assert.ok(rule.includes('claude-1'),
    'Must list T2 slot names in the instruction');
  assert.ok(rule.includes('CRITICAL'),
    'Must include CRITICAL directive to prevent premature fail-open');
  assert.ok(!rule.includes('skip it'),
    'Must NOT contain the weak "skip it" message');
});

// ── NORMAL CASE: Both T1 and T2 have slots ──────────────────────────────

test('T1 has slots + T2 has slots → full 3-step FALLBACK-01', () => {
  const capped = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'gemini-1', authType: 'sub' },
  ];
  const t1 = ['opencode-1', 'copilot-1'];
  const t2 = ['claude-1', 'claude-2', 'claude-3'];

  const rule = buildFalloverRule(capped, t1, t2, 3);

  assert.ok(rule.includes('FALLBACK-01'), 'Must contain FALLBACK-01');
  assert.ok(rule.includes('Step 1 PRIMARY'), 'Must have Step 1');
  assert.ok(rule.includes('Step 2 T1 sub-CLI'), 'Must have Step 2 T1');
  assert.ok(rule.includes('Step 3 T2 ccr'), 'Must have Step 3 T2');
  assert.ok(rule.includes('opencode-1'), 'T1 must list opencode-1');
  assert.ok(rule.includes('copilot-1'), 'T1 must list copilot-1');
  assert.ok(rule.includes('claude-1'), 'T2 must list claude-1');
});

// ── EDGE CASE: T1 has slots, T2 is empty ────────────────────────────────

test('T1 has slots + T2 empty → FALLBACK-01 with T2=none', () => {
  const capped = [
    { slot: 'codex-1', authType: 'sub' },
  ];
  const t1 = ['gemini-1', 'opencode-1'];
  const t2 = [];

  const rule = buildFalloverRule(capped, t1, t2, 3);

  assert.ok(rule.includes('FALLBACK-01'), 'Must contain FALLBACK-01');
  assert.ok(rule.includes('T2 ccr'), 'Must have T2 step');
  assert.ok(rule.includes('none'), 'T2 should show "none"');
});

// ── EDGE CASE: No fallback slots at all ─────────────────────────────────

test('T1 empty + T2 empty → generic skip rule (no fallback possible)', () => {
  const capped = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'gemini-1', authType: 'sub' },
  ];
  const t1 = [];
  const t2 = [];

  const rule = buildFalloverRule(capped, t1, t2, 3);

  assert.ok(!rule.includes('FALLBACK-01'),
    'Should NOT contain FALLBACK-01 when no fallback slots exist');
  assert.ok(rule.includes('Failover rule'),
    'Should contain generic failover message');
});

// ── EDGE CASE: Single primary, many fallbacks ───────────────────────────

test('Single primary + large T2 pool → all T2 slots listed', () => {
  const capped = [{ slot: 'codex-1', authType: 'sub' }];
  const t1 = [];
  const t2 = ['claude-1', 'claude-2', 'claude-3', 'claude-4', 'claude-5', 'claude-6'];

  const rule = buildFalloverRule(capped, t1, t2, 3);

  // Every T2 slot name must appear in the instruction
  for (const slot of t2) {
    assert.ok(rule.includes(slot), `T2 must list ${slot}`);
  }
  assert.ok(rule.includes('Step 2 T2 fallback'), 'Must have T2 fallback step');
});

// ── STRUCTURAL: Primary slot names always appear ────────────────────────

test('Primary slot names always appear in Step 1', () => {
  const capped = [
    { slot: 'copilot-1', authType: 'sub' },
    { slot: 'opencode-1', authType: 'sub' },
  ];
  const t1 = ['gemini-1'];
  const t2 = ['claude-1'];

  const rule = buildFalloverRule(capped, t1, t2, 3);

  assert.ok(rule.includes('copilot-1'), 'Primary copilot-1 must appear');
  assert.ok(rule.includes('opencode-1'), 'Primary opencode-1 must appear');
  assert.ok(rule.includes('Step 1 PRIMARY'), 'Step 1 header must exist');
});

// ── STRUCTURAL: maxSize value appears in instruction ────────────────────

test('maxSize value appears in quorum vote count', () => {
  const capped = [{ slot: 'codex-1', authType: 'sub' }];
  const t1 = ['gemini-1'];
  const t2 = [];

  const rule5 = buildFalloverRule(capped, t1, t2, 5);
  assert.ok(rule5.includes('5'), 'maxSize=5 must appear in instruction');

  const ruleNone = buildFalloverRule(capped, [], [], 7);
  assert.ok(ruleNone.includes('7'), 'maxSize=7 must appear in generic fallback');
});

origLog('─'.repeat(50));
origLog(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
