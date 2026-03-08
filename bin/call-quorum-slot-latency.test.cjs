'use strict';

/**
 * call-quorum-slot-latency.test.cjs — unit tests for latency_budget_ms computation (LTCY-01)
 *
 * Tests the effective timeout computation logic extracted from call-quorum-slot.cjs main().
 * The logic under test:
 *   1. latency_budget_ms > 0 => hard ceiling (wins over everything)
 *   2. latency_budget_ms null/0/negative => falls back to existing logic
 *   3. Existing logic: min(timeoutMs, providerCap) when both set, else first non-null
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Extract the effective timeout computation logic from call-quorum-slot.cjs
// This mirrors the logic in main() exactly.
function computeEffectiveTimeout(provider, timeoutMs) {
  const latencyBudget = provider.latency_budget_ms ?? null;
  const providerCap = provider.quorum_timeout_ms ?? null;

  if (latencyBudget !== null && latencyBudget > 0) {
    return latencyBudget;
  } else if (timeoutMs !== null && providerCap !== null) {
    return Math.min(timeoutMs, providerCap);
  } else {
    return timeoutMs ?? providerCap ?? provider.timeout_ms ?? 30000;
  }
}

describe('latency_budget_ms effective timeout computation', () => {

  it('latency_budget_ms wins over --timeout and quorum_timeout_ms', () => {
    const provider = {
      latency_budget_ms: 10000,
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = 15000; // --timeout arg
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 10000, 'latency_budget_ms should be the effective timeout');
  });

  it('latency_budget_ms null falls back to existing logic', () => {
    const provider = {
      latency_budget_ms: null,
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = 15000;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 15000, 'should use min(timeoutMs, providerCap)');
  });

  it('latency_budget_ms 0 is treated as not set', () => {
    const provider = {
      latency_budget_ms: 0,
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = 15000;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 15000, 'should fall back to existing logic when latency_budget_ms is 0');
  });

  it('negative latency_budget_ms is treated as not set', () => {
    const provider = {
      latency_budget_ms: -1,
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = 15000;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 15000, 'should fall back to existing logic when latency_budget_ms is negative');
  });

  it('latency_budget_ms absent (undefined) falls back to existing logic', () => {
    const provider = {
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = null;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 20000, 'should use providerCap when timeoutMs is null');
  });

  it('no timeouts set at all defaults to 30000', () => {
    const provider = {
      latency_budget_ms: null,
    };
    const timeoutMs = null;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 30000, 'should default to 30000ms');
  });

  it('latency_budget_ms wins even when smaller than quorum_timeout_ms', () => {
    const provider = {
      latency_budget_ms: 5000,
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = 25000;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 5000, 'latency_budget_ms=5000 should win');
  });

  it('latency_budget_ms wins even when larger than quorum_timeout_ms', () => {
    const provider = {
      latency_budget_ms: 50000,
      quorum_timeout_ms: 20000,
      timeout_ms: 300000,
    };
    const timeoutMs = 15000;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 50000, 'latency_budget_ms=50000 should win even when larger');
  });

  it('existing logic: providerCap caps --timeout', () => {
    const provider = {
      latency_budget_ms: null,
      quorum_timeout_ms: 10000,
      timeout_ms: 300000,
    };
    const timeoutMs = 25000;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 10000, 'providerCap should cap the --timeout arg');
  });

  it('existing logic: timeout_ms used as last fallback', () => {
    const provider = {
      latency_budget_ms: null,
      timeout_ms: 300000,
    };
    const timeoutMs = null;
    const result = computeEffectiveTimeout(provider, timeoutMs);
    assert.equal(result, 300000, 'timeout_ms should be the last fallback');
  });
});

describe('providers.json latency_budget_ms field presence', () => {
  const fs = require('fs');
  const path = require('path');
  const providersPath = path.join(__dirname, 'providers.json');

  it('all providers have latency_budget_ms field', () => {
    const data = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
    for (const p of data.providers) {
      assert.ok(
        'latency_budget_ms' in p,
        `Provider "${p.name}" is missing latency_budget_ms field`
      );
    }
  });

  it('claude-5 and claude-6 have non-null latency_budget_ms', () => {
    const data = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
    const claude5 = data.providers.find(p => p.name === 'claude-5');
    const claude6 = data.providers.find(p => p.name === 'claude-6');
    assert.equal(claude5.latency_budget_ms, 15000, 'claude-5 should have latency_budget_ms=15000');
    assert.equal(claude6.latency_budget_ms, 15000, 'claude-6 should have latency_budget_ms=15000');
  });

  it('non-example providers have null latency_budget_ms', () => {
    const data = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
    const nonExamples = data.providers.filter(p => !['claude-5', 'claude-6'].includes(p.name));
    for (const p of nonExamples) {
      assert.equal(
        p.latency_budget_ms, null,
        `Provider "${p.name}" should have latency_budget_ms=null`
      );
    }
  });
});
