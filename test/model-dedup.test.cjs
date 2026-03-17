#!/usr/bin/env node
'use strict';
/** @requirement FP-03 — validates model deduplication logic for quorum dispatch */

/**
 * Unit tests for model deduplication logic.
 *
 * Tests the deduplicateByModel function and its integration with buildFalloverRule
 * to ensure duplicate-model slots are properly demoted to fallback tier.
 */

const assert = require('assert');

// Import the exported functions
const { deduplicateByModel, buildFalloverRule } = require('../hooks/nf-prompt.js');

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

origLog('Model deduplication tests');
origLog('─'.repeat(50));

// ─── TEST CASES FOR deduplicateByModel ──────────────────────────────────────

// Mock agentCfg for testing
const mockCfg = {
  'codex-1': { model: 'gpt-5.4', auth_type: 'sub' },
  'codex-2': { model: 'gpt-5.4', auth_type: 'api' },
  'gemini-1': { model: 'gemini-3-pro-preview', auth_type: 'sub' },
  'gemini-2': { model: 'gemini-3-pro-preview', auth_type: 'api' },
  'opencode-1': { model: 'grok-code-fast-1', auth_type: 'sub' },
  'copilot-1': { model: 'gpt-4.1', auth_type: 'api' },
  'claude-1': { model: 'deepseek-ai/DeepSeek-V3.2', auth_type: 'api' },
};

// ── TEST 1: No duplicates — all unique models ──────────────────────────────

test('No duplicates: all unique models', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'gemini-1', authType: 'sub' },
    { slot: 'opencode-1', authType: 'sub' },
    { slot: 'copilot-1', authType: 'api' },
  ];

  const result = deduplicateByModel(slots, mockCfg);

  assert.strictEqual(result.unique.length, 4, 'All 4 slots should be unique');
  assert.strictEqual(result.duplicates.length, 0, 'No duplicates');
  assert.strictEqual(result.unique[0].slot, 'codex-1', 'First slot preserved');
});

// ── TEST 2: One pair of duplicates — codex-1/codex-2 ───────────────────────

test('One pair of duplicates: codex-1 + codex-2', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
    { slot: 'gemini-1', authType: 'sub' },
  ];

  const result = deduplicateByModel(slots, mockCfg);

  assert.strictEqual(result.unique.length, 2, 'Should keep codex-1 and gemini-1');
  assert.strictEqual(result.duplicates.length, 1, 'Should demote codex-2');
  assert.strictEqual(result.duplicates[0].slot, 'codex-2', 'codex-2 is the duplicate');
  assert.ok(result.unique.some(s => s.slot === 'codex-1'), 'codex-1 kept as primary');
  assert.ok(!result.unique.some(s => s.slot === 'codex-2'), 'codex-2 removed from primary');
});

// ── TEST 3: Two pairs of duplicates ──────────────────────────────────────

test('Two pairs of duplicates: codex-1/2 and gemini-1/2', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
    { slot: 'gemini-1', authType: 'sub' },
    { slot: 'gemini-2', authType: 'api' },
  ];

  const result = deduplicateByModel(slots, mockCfg);

  assert.strictEqual(result.unique.length, 2, 'Should keep codex-1 and gemini-1');
  assert.strictEqual(result.duplicates.length, 2, 'Should demote codex-2 and gemini-2');
  assert.ok(result.unique.every(s => ['codex-1', 'gemini-1'].includes(s.slot)), 'Correct unique slots');
  assert.ok(result.duplicates.every(s => ['codex-2', 'gemini-2'].includes(s.slot)), 'Correct duplicate slots');
});

// ── TEST 4: Auth-type sort order respected ──────────────────────────────────

test('Auth-type sort order: first slot in orderedSlots wins', () => {
  // When slots are already sorted by auth_type (sub first, api second),
  // the first sub agent wins, not the api agent.
  const slots = [
    { slot: 'codex-1', authType: 'sub' },   // Sub version of gpt-5.4
    { slot: 'codex-2', authType: 'api' },   // API version of gpt-5.4
  ];

  const result = deduplicateByModel(slots, mockCfg);

  assert.strictEqual(result.unique[0].slot, 'codex-1', 'Sub slot wins over API slot');
  assert.strictEqual(result.duplicates[0].slot, 'codex-2', 'API slot demoted');
});

// ── TEST 5: Unknown model (missing agentCfg entry) ───────────────────────

test('Unknown model: slots not in agentCfg all treated as unique (no dedup)', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'unknown-slot-1', authType: 'api' },
    { slot: 'unknown-slot-2', authType: 'api' },
  ];

  const result = deduplicateByModel(slots, mockCfg);

  // Unknown-model slots are never deduplicated — we can't assert they're duplicates
  assert.strictEqual(result.unique.length, 3, 'all three slots kept as unique');
  assert.strictEqual(result.duplicates.length, 0, 'no duplicates for unknown models');
});

// ─── TEST CASES FOR buildFalloverRule WITH modelDedupSlots ───────────────────

// ── TEST 6: Model-dedup tier rendered ────────────────────────────────────

test('Model-dedup tier rendered in FALLBACK-01', () => {
  const capped = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'gemini-1', authType: 'sub' },
  ];
  const t1 = ['opencode-1'];
  const t2 = ['claude-1'];
  const modelDedup = ['codex-2', 'gemini-2'];

  const rule = buildFalloverRule(capped, t1, t2, 3, modelDedup);

  assert.ok(rule.includes('MODEL-DEDUP'), 'Must contain MODEL-DEDUP label');
  assert.ok(rule.includes('codex-2'), 'Must list codex-2 in model-dedup tier');
  assert.ok(rule.includes('gemini-2'), 'Must list gemini-2 in model-dedup tier');
  assert.ok(rule.includes('Step 2 MODEL-DEDUP'), 'Model-dedup should be step 2');
  assert.ok(rule.includes('Step 3 T1 sub-CLI'), 'T1 should be step 3 (after model-dedup)');
  assert.ok(rule.includes('Step 4 T2'), 'T2 should be step 4 (after T1)');
});

// ── TEST 7: Empty model-dedup tier — no MODEL-DEDUP line ──────────────────

test('Empty model-dedup tier: no MODEL-DEDUP in output', () => {
  const capped = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'gemini-1', authType: 'sub' },
  ];
  const t1 = ['opencode-1'];
  const t2 = ['claude-1'];
  const modelDedup = [];

  const rule = buildFalloverRule(capped, t1, t2, 3, modelDedup);

  assert.ok(!rule.includes('MODEL-DEDUP'), 'Must NOT contain MODEL-DEDUP when empty');
  assert.ok(rule.includes('Step 2 T1 sub-CLI'), 'T1 should be step 2 (no model-dedup)');
  assert.ok(rule.includes('Step 3 T2'), 'T2 should be step 3 (after T1)');
});

// ── TEST 8: Step numbering correct with model-dedup ─────────────────────

test('Step numbering with model-dedup tier', () => {
  const capped = [{ slot: 'codex-1', authType: 'sub' }];
  const t1 = ['gemini-1'];
  const t2 = ['claude-1'];
  const modelDedup = ['codex-2'];

  const rule = buildFalloverRule(capped, t1, t2, 3, modelDedup);

  // Expected: Step 1 PRIMARY, Step 2 MODEL-DEDUP, Step 3 T1, Step 4 T2
  assert.ok(rule.includes('Step 1 PRIMARY'), 'Step 1 for primary');
  assert.ok(rule.includes('Step 2 MODEL-DEDUP'), 'Step 2 for model-dedup');
  assert.ok(rule.includes('Step 3 T1 sub-CLI'), 'Step 3 for T1');
  assert.ok(rule.includes('Step 4 T2'), 'Step 4 for T2');
  assert.ok(!rule.includes('Step 5'), 'Should not have Step 5');
});

// ── TEST 9: Model-dedup with no T1 (only T2 as fallback) ───────────────

test('Model-dedup + T2 only (no T1)', () => {
  const capped = [{ slot: 'codex-1', authType: 'api' }];
  const t1 = [];
  const t2 = ['claude-1', 'claude-2'];
  const modelDedup = ['codex-2'];

  const rule = buildFalloverRule(capped, t1, t2, 3, modelDedup);

  assert.ok(rule.includes('Step 2 MODEL-DEDUP'), 'Model-dedup is step 2');
  assert.ok(rule.includes('Step 3 T2 fallback'), 'T2 is step 3 (after model-dedup)');
  assert.ok(!rule.includes('Step 3 T1'), 'No T1 step when empty');
});

// ── TEST 10: Integration: dedup result → buildFalloverRule ──────────────

test('Full integration: deduplicateByModel + buildFalloverRule', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
    { slot: 'gemini-1', authType: 'sub' },
    { slot: 'opencode-1', authType: 'sub' },
  ];

  const dedup = deduplicateByModel(slots, mockCfg);
  const rule = buildFalloverRule(dedup.unique, [], ['claude-1'], 3, dedup.duplicates.map(s => s.slot));

  // Dedup should have: codex-1, gemini-1, opencode-1 as unique; codex-2 as duplicate
  assert.strictEqual(dedup.unique.length, 3, 'Three unique models');
  assert.strictEqual(dedup.duplicates.length, 1, 'One duplicate');

  // Rule should show model-dedup tier
  assert.ok(rule.includes('MODEL-DEDUP'), 'Should have MODEL-DEDUP tier');
  assert.ok(rule.includes('codex-2'), 'Should list codex-2 in fallback');
  assert.ok(rule.includes('Step 1 PRIMARY'), 'Should have primary step');
  assert.ok(rule.includes('Step 2 MODEL-DEDUP'), 'Model-dedup is step 2');
  assert.ok(rule.includes('Step 3 T2 fallback'), 'T2 is step 3');
});

// ─── TEST CASES FOR providers.json FALLBACK BEHAVIOR ──────────────────────────

// ── TEST 11: Empty agentCfg with providersList deduplicates same-model slots ──

test('Empty agentCfg: fallback to providersList deduplicates codex-1/2', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
    { slot: 'gemini-1', authType: 'sub' },
  ];
  const emptyAgentCfg = {};
  const providersList = [
    { name: 'codex-1', model: 'gpt-5.4' },
    { name: 'codex-2', model: 'gpt-5.4' },
    { name: 'gemini-1', model: 'gemini-3-pro-preview' },
  ];

  const result = deduplicateByModel(slots, emptyAgentCfg, providersList);

  assert.strictEqual(result.unique.length, 2, 'Should keep codex-1 and gemini-1');
  assert.strictEqual(result.duplicates.length, 1, 'Should demote codex-2');
  assert.ok(result.unique.some(s => s.slot === 'codex-1'), 'codex-1 kept');
  assert.ok(result.unique.some(s => s.slot === 'gemini-1'), 'gemini-1 kept');
  assert.strictEqual(result.duplicates[0].slot, 'codex-2', 'codex-2 is duplicate');
});

// ── TEST 12: agentCfg takes precedence over providersList ────────────────────

test('agentCfg precedence: custom model overrides providers.json', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
  ];
  const agentCfg = {
    'codex-1': { model: 'custom-model-x', auth_type: 'sub' },
  };
  const providersList = [
    { name: 'codex-1', model: 'gpt-5.4' },
    { name: 'codex-2', model: 'gpt-5.4' },
  ];

  const result = deduplicateByModel(slots, agentCfg, providersList);

  // codex-1 has custom-model-x (from agentCfg), codex-2 has gpt-5.4 (from providersList)
  // → different models, no dedup
  assert.strictEqual(result.unique.length, 2, 'Two unique models');
  assert.strictEqual(result.duplicates.length, 0, 'No duplicates (different models)');
  assert.ok(result.unique.some(s => s.slot === 'codex-1'), 'codex-1 kept');
  assert.ok(result.unique.some(s => s.slot === 'codex-2'), 'codex-2 kept');
});

// ── TEST 13: No providersList (undefined) — backward compatible ──────────────

test('No providersList: backward compatible with 2-arg calls', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
  ];
  const emptyAgentCfg = {};
  // providersList omitted (undefined)

  const result = deduplicateByModel(slots, emptyAgentCfg);

  // Both resolve to 'unknown', so both treated as unique (never dedup unknowns)
  assert.strictEqual(result.unique.length, 2, 'Both slots unique (both unknown)');
  assert.strictEqual(result.duplicates.length, 0, 'No duplicates for unknown models');
});

// ── TEST 14: Mixed — some slots in agentCfg, others fall back to providersList ──

test('Mixed agentCfg + providers fallback', () => {
  const slots = [
    { slot: 'codex-1', authType: 'sub' },
    { slot: 'codex-2', authType: 'api' },
    { slot: 'gemini-1', authType: 'sub' },
  ];
  const agentCfg = {
    'gemini-1': { model: 'gemini-3-pro-preview', auth_type: 'sub' },
    // codex-1 and codex-2 NOT in agentCfg — will use providersList
  };
  const providersList = [
    { name: 'codex-1', model: 'gpt-5.4' },
    { name: 'codex-2', model: 'gpt-5.4' },
    { name: 'gemini-1', model: 'gemini-3-pro-preview' },
  ];

  const result = deduplicateByModel(slots, agentCfg, providersList);

  // codex-1: gpt-5.4 (from providers)
  // codex-2: gpt-5.4 (from providers) — duplicate
  // gemini-1: gemini-3-pro-preview (from agentCfg)
  assert.strictEqual(result.unique.length, 2, 'Two unique models (codex-1, gemini-1)');
  assert.strictEqual(result.duplicates.length, 1, 'One duplicate (codex-2)');
  assert.ok(result.unique.some(s => s.slot === 'codex-1'), 'codex-1 kept');
  assert.ok(result.unique.some(s => s.slot === 'gemini-1'), 'gemini-1 kept');
  assert.strictEqual(result.duplicates[0].slot, 'codex-2', 'codex-2 is duplicate');
});

origLog('─'.repeat(50));
origLog(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
