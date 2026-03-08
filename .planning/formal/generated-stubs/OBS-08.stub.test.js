#!/usr/bin/env node
// @requirement OBS-08
// Constant test: analyze-assumptions classifies assumptions into priority tiers (1, 2, 3),
// supports --actionable filtering to Tier 1 only, and generates Prometheus instrumentation

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modPath = path.resolve(__dirname, '../../../bin/analyze-assumptions.cjs');
const mod = require(modPath);
const modSrc = fs.readFileSync(modPath, 'utf8');

test('OBS-08: classifyTier is exported', () => {
  assert.equal(typeof mod.classifyTier, 'function');
});

test('OBS-08: Tier 1 = numeric constants (directly monitorable)', () => {
  const tier = mod.classifyTier({ type: 'constant', value: 5 });
  assert.equal(tier, 1);
});

test('OBS-08: Tier 1 = assume with numeric value', () => {
  const tier = mod.classifyTier({ type: 'assume', value: 3 });
  assert.equal(tier, 1);
});

test('OBS-08: Tier 2 = named invariants (checkable via probes)', () => {
  const tier = mod.classifyTier({ type: 'invariant', value: null });
  assert.equal(tier, 2);
});

test('OBS-08: Tier 3 = structural constraints not runtime-observable', () => {
  // Types not in tier 1 or tier 2 categories fall to tier 3
  const tier = mod.classifyTier({ type: 'sig', value: null });
  assert.equal(tier, 3);
});

test('OBS-08: CLI supports --actionable flag for Tier 1 filtering', () => {
  assert.match(modSrc, /--actionable/);
  // --actionable filters to classifyTier === 1
  assert.match(modSrc, /classifyTier\(a\)\s*===\s*1/);
});

test('OBS-08: gap report sorts by tier ascending (Tier 1 first)', () => {
  assert.match(modSrc, /sort.*tier/);
});

test('OBS-08: Tier 1 generates Prometheus gauge/histogram snippets', () => {
  // Tier 1 assumptions get Prometheus instrumentation snippets
  assert.match(modSrc, /gauge|histogram/i);
  assert.match(modSrc, /metric_type/);
});
