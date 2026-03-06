'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { computeBudgetStatus, triggerProfileDowngrade, DOWNGRADE_CHAIN, formatBudgetWarning } = require('./budget-tracker.cjs');

// Helper: create temp dir with .planning/config.json
function makeTempProject(configObj) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  if (configObj !== undefined) {
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(configObj), 'utf8');
  }
  return tmpDir;
}

function cleanTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// --- computeBudgetStatus ---

describe('computeBudgetStatus', () => {
  it('returns inactive when session_limit_tokens is null', () => {
    const result = computeBudgetStatus(50, { session_limit_tokens: null }, {});
    assert.equal(result.active, false);
  });

  it('returns inactive when session_limit_tokens is undefined', () => {
    const result = computeBudgetStatus(50, {}, {});
    assert.equal(result.active, false);
  });

  it('calculates correct budgetUsedPct', () => {
    // 50% context of 200K = 100000 tokens; limit 100000 => 100% budget used
    const result = computeBudgetStatus(50, { session_limit_tokens: 100000 }, {});
    assert.equal(result.active, true);
    assert.equal(result.estimatedTokens, 100000);
    assert.equal(result.budgetUsedPct, 100);
    assert.equal(result.shouldDowngrade, true);
  });

  it('shouldWarn at exactly 60% budget', () => {
    // Need budgetUsedPct = 60. With limit 200000 and 200K context: usedPct 60 => 120000 tokens => 60%
    const result = computeBudgetStatus(60, { session_limit_tokens: 200000, warn_pct: 60, downgrade_pct: 85 }, {});
    assert.equal(result.shouldWarn, true);
    assert.equal(result.shouldDowngrade, false);
  });

  it('shouldDowngrade at exactly 85% budget', () => {
    // usedPct 85 => 170000 tokens; limit 200000 => 85% budget
    const result = computeBudgetStatus(85, { session_limit_tokens: 200000, warn_pct: 60, downgrade_pct: 85 }, {});
    assert.equal(result.shouldWarn, true);
    assert.equal(result.shouldDowngrade, true);
  });

  it('below warn threshold', () => {
    // usedPct 20 => 40000 tokens; limit 200000 => 20% budget
    const result = computeBudgetStatus(20, { session_limit_tokens: 200000, warn_pct: 60, downgrade_pct: 85 }, {});
    assert.equal(result.shouldWarn, false);
    assert.equal(result.shouldDowngrade, false);
  });
});

// --- DOWNGRADE_CHAIN ---

describe('DOWNGRADE_CHAIN', () => {
  it('transitions quality->balanced->budget->null', () => {
    assert.equal(DOWNGRADE_CHAIN.quality, 'balanced');
    assert.equal(DOWNGRADE_CHAIN.balanced, 'budget');
    assert.equal(DOWNGRADE_CHAIN.budget, null);
  });
});

// --- triggerProfileDowngrade ---

describe('triggerProfileDowngrade', () => {
  let tmpDir;

  afterEach(() => { if (tmpDir) cleanTmp(tmpDir); });

  it('writes new profile', () => {
    tmpDir = makeTempProject({ model_profile: 'quality' });
    const result = triggerProfileDowngrade(tmpDir);
    assert.equal(result.downgraded, true);
    assert.equal(result.from, 'quality');
    assert.equal(result.to, 'balanced');
    const cfg = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf8'));
    assert.equal(cfg.model_profile, 'balanced');
  });

  it('at minimum returns downgraded:false', () => {
    tmpDir = makeTempProject({ model_profile: 'budget' });
    const result = triggerProfileDowngrade(tmpDir);
    assert.equal(result.downgraded, false);
  });

  it('with missing config file fails open', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-test-'));
    const result = triggerProfileDowngrade(path.join(tmpDir, 'nonexistent'));
    assert.equal(result.downgraded, false);
  });
});

// --- formatBudgetWarning ---

describe('formatBudgetWarning', () => {
  it('produces warn message', () => {
    const status = { active: true, estimatedTokens: 120000, budgetUsedPct: 60, shouldWarn: true, shouldDowngrade: false };
    const msg = formatBudgetWarning(status, null);
    assert.ok(msg.includes('BUDGET WARNING'));
    assert.ok(msg.includes('120000'));
  });

  it('produces downgrade message', () => {
    const status = { active: true, estimatedTokens: 170000, budgetUsedPct: 85, shouldWarn: true, shouldDowngrade: true };
    const downgrade = { downgraded: true, from: 'balanced', to: 'budget' };
    const msg = formatBudgetWarning(status, downgrade);
    assert.ok(msg.includes('BUDGET ALERT'));
    assert.ok(msg.includes('balanced'));
    assert.ok(msg.includes('budget'));
  });
});

// --- Config validation tests ---

describe('config validation - budget', () => {
  const { loadConfig, validateConfig, DEFAULT_CONFIG } = require('../hooks/config-loader.js');

  it('partial object fills defaults', () => {
    const config = { ...DEFAULT_CONFIG, budget: { session_limit_tokens: 50000 } };
    validateConfig(config);
    assert.equal(config.budget.warn_pct, 60);
    assert.equal(config.budget.downgrade_pct, 85);
  });

  it('invalid session_limit_tokens resets to null', () => {
    const config = { ...DEFAULT_CONFIG, budget: { session_limit_tokens: 'bad', warn_pct: 60, downgrade_pct: 85 } };
    validateConfig(config);
    assert.equal(config.budget.session_limit_tokens, null);
  });

  it('warn_pct >= downgrade_pct resets both', () => {
    const config = { ...DEFAULT_CONFIG, budget: { session_limit_tokens: null, warn_pct: 90, downgrade_pct: 80 } };
    validateConfig(config);
    assert.equal(config.budget.warn_pct, 60);
    assert.equal(config.budget.downgrade_pct, 85);
  });
});
