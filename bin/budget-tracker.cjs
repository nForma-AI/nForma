'use strict';
// bin/budget-tracker.cjs
// Token budget calculation, profile downgrade logic, and subscription slot exclusion.
// Uses only node:fs, node:path. No external dependencies.

const fs = require('fs');
const path = require('path');

// Profile downgrade sequence: quality -> balanced -> budget -> null (minimum)
const DOWNGRADE_CHAIN = { quality: 'balanced', balanced: 'budget', budget: null };

/**
 * Compute budget status from context window usage percentage.
 * @param {number} usedPct - Context window used percentage (0-100).
 * @param {object} budgetConfig - budget config section from nf.json.
 * @param {object} agentConfig - agent_config section from nf.json (unused for now, reserved for sub exclusion).
 * @returns {object} Budget status object.
 */
function computeBudgetStatus(usedPct, budgetConfig, agentConfig) {
  if (!budgetConfig || budgetConfig.session_limit_tokens == null) {
    return { active: false };
  }

  const estimatedTokens = Math.round((usedPct / 100) * 200000);
  const budgetUsedPct = Math.round((estimatedTokens / budgetConfig.session_limit_tokens) * 100);

  return {
    active: true,
    estimatedTokens,
    budgetUsedPct,
    shouldWarn: budgetUsedPct >= (budgetConfig.warn_pct || 60),
    shouldDowngrade: budgetUsedPct >= (budgetConfig.downgrade_pct || 85),
  };
}

/**
 * Trigger a model profile downgrade by writing to .planning/config.json.
 * @param {string} cwd - Project working directory.
 * @returns {object} Downgrade result.
 */
function triggerProfileDowngrade(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    const current = config.model_profile || 'balanced';
    const next = DOWNGRADE_CHAIN[current];
    if (next === undefined || next === null) {
      return { downgraded: false, current };
    }
    config.model_profile = next;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return { downgraded: true, from: current, to: next };
  } catch (e) {
    return { downgraded: false, error: e.message };
  }
}

/**
 * Format a budget warning message for additionalContext injection.
 * @param {object} status - Output from computeBudgetStatus.
 * @param {object|null} downgradeResult - Output from triggerProfileDowngrade (or null).
 * @returns {string} Warning message.
 */
function formatBudgetWarning(status, downgradeResult) {
  if (status.shouldDowngrade && downgradeResult && downgradeResult.downgraded) {
    return `BUDGET ALERT: Context at ${status.budgetUsedPct}% of token budget. Model profile downgraded from '${downgradeResult.from}' to '${downgradeResult.to}'. Consider running /compact.`;
  }
  if (status.shouldWarn) {
    return `BUDGET WARNING: Context at ${status.budgetUsedPct}% of token budget (${status.estimatedTokens} estimated tokens of ${status.active ? (status.budgetUsedPct > 0 ? Math.round(status.estimatedTokens * 100 / status.budgetUsedPct) : 0) : 0} limit). Monitor usage and consider /compact at next clean boundary.`;
  }
  return '';
}

module.exports = { DOWNGRADE_CHAIN, computeBudgetStatus, triggerProfileDowngrade, formatBudgetWarning };
