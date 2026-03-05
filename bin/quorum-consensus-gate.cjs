#!/usr/bin/env node
'use strict';
// bin/quorum-consensus-gate.cjs
// PRISM consensus probability gate for quorum rounds.
// Requirements: SIG-04
//
// Usage:
//   node bin/quorum-consensus-gate.cjs [--min-quorum=2]
//
// Computes P(consensus_reached) from current scoreboard availability rates
// using the Poisson binomial distribution (closed-form, no PRISM dependency).
// Gates quorum rounds when probability is below threshold.
//
// Exit 0 = proceed, Exit 1 = defer.

const fs   = require('fs');
const path = require('path');

/**
 * poissonBinomialCDF(probabilities, k) — computes P(X >= k) for heterogeneous trials.
 *
 * Uses recursive DP approach for the Poisson binomial distribution:
 *   dp[0] = 1 (base case: 0 successes with 0 trials)
 *   For each probability p_i: dp[j] = dp[j] * (1-p_i) + dp[j-1] * p_i for j from n down to 1
 *   Returns P(X >= k) = sum of dp[k..n]
 *
 * Equivalent to the PRISM mcp-availability.pm model but computed in O(n^2) without Java.
 *
 * @param {number[]} probabilities - per-slot availability rates
 * @param {number} k - minimum number of successes needed
 * @returns {number} P(X >= k)
 */
function poissonBinomialCDF(probabilities, k) {
  const n = probabilities.length;
  if (k > n) return 0;
  if (k <= 0) return 1.0;

  // dp[j] = probability of exactly j successes after processing i trials
  const dp = new Array(n + 1).fill(0);
  dp[0] = 1; // base: P(0 successes with 0 trials) = 1

  for (let i = 0; i < n; i++) {
    const p = probabilities[i];
    // Process backwards to avoid overwriting dp[j-1] before it's used
    for (let j = i + 1; j >= 1; j--) {
      dp[j] = dp[j] * (1 - p) + dp[j - 1] * p;
    }
    dp[0] = dp[0] * (1 - p);
  }

  // P(X >= k) = sum of dp[k..n]
  let result = 0;
  for (let j = k; j <= n; j++) {
    result += dp[j];
  }

  return result;
}

/**
 * computeConsensusProbability(slotRates, minQuorum) — computes P(consensus_reached).
 * @param {Object} slotRates - { slot_name: availability_rate }
 * @param {number} minQuorum - minimum number of slots needed for consensus
 * @returns {{ probability: number, slotCount: number, minQuorum: number, rates: Object }}
 */
function computeConsensusProbability(slotRates, minQuorum) {
  const probabilities = Object.values(slotRates);
  const probability = poissonBinomialCDF(probabilities, minQuorum);

  return {
    probability: Math.round(probability * 1e6) / 1e6,
    slotCount: probabilities.length,
    minQuorum,
    rates: slotRates,
  };
}

/**
 * checkConsensusGate(options) — reads scoreboard, computes probability, returns gate decision.
 * @param {{ scoreboardPath?: string, configPath?: string, minQuorum?: number }} options
 * @returns {{ action: string, probability: number, threshold: number, message: string }}
 */
function checkConsensusGate(options = {}) {
  const pp = require('./planning-paths.cjs');
  const scoreboardPath = options.scoreboardPath || pp.resolveWithFallback(process.cwd(), 'quorum-scoreboard');
  const configPath     = options.configPath || path.join(process.cwd(), '.planning', 'config.json');
  const minQuorum      = options.minQuorum || 2;

  // Read scoreboard availability rates
  let slotRates = null;
  try {
    const { readMCPAvailabilityRates } = require('./run-prism.cjs');
    slotRates = readMCPAvailabilityRates(scoreboardPath);
  } catch (_) {
    // run-prism.cjs not available — fall through to priors
  }

  // If no rates (empty/missing scoreboard): use conservative prior rates
  if (!slotRates || Object.keys(slotRates).length === 0) {
    slotRates = {
      'slot-1': 0.85,
      'slot-2': 0.85,
      'slot-3': 0.85,
      'slot-4': 0.85,
    };
  }

  // Read threshold from config.json
  let threshold = 0.70;
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.workflow && typeof config.workflow.consensus_probability_threshold === 'number') {
        threshold = config.workflow.consensus_probability_threshold;
      }
    }
  } catch (_) {
    // Use default threshold
  }

  // Compute P(consensus_reached)
  const result = computeConsensusProbability(slotRates, minQuorum);
  const probability = result.probability;

  if (probability >= threshold) {
    return {
      action: 'proceed',
      probability,
      threshold,
      message: 'Consensus probability ' + probability.toFixed(4) + ' >= threshold ' + threshold.toFixed(2) + ' -- proceeding',
    };
  } else {
    return {
      action: 'defer',
      probability,
      threshold,
      message: 'WARNING: Consensus probability ' + probability.toFixed(4) + ' < threshold ' + threshold.toFixed(2) + ' -- deferring quorum round. Slot availability too low for reliable consensus.',
    };
  }
}

/**
 * readEarlyEscalationThreshold(configPaths) — reads workflow.early_escalation_threshold from config.
 *
 * Tries each config path in order. Returns 0.10 (default) if:
 * - No paths provided or none exist
 * - JSON parse fails (fail-open)
 * - Value is missing, non-numeric, or outside [0, 1.0] range
 *
 * @param {string[]} configPaths - ordered list of config file paths to try
 * @returns {number} threshold (0.0 to 1.0), or 0.10 default
 */
function readEarlyEscalationThreshold(configPaths) {
  const DEFAULT = 0.10;
  const paths = configPaths || [
    path.join(process.cwd(), '.planning', 'config.json'),
    path.join(process.cwd(), '.planning', 'qgsd.json'),
  ];
  for (const cfgPath of paths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        const val = config.workflow?.early_escalation_threshold;
        if (typeof val === 'number' && val > 0 && val <= 1.0) return val;
      }
    } catch (_) {
      // Fail-open: JSON parse error, continue to next path
    }
  }
  return DEFAULT;
}

/**
 * computeEarlyEscalation(slotRates, minQuorum, remainingRounds, threshold)
 *
 * Computes P(consensus within remainingRounds) and checks early escalation:
 * - P(at least minQuorum succeed in 1 round) using poissonBinomialCDF
 * - P(consensus within k rounds) = 1 - (1 - pPerRound)^k
 * - If P(consensus | remaining) < threshold, shouldEscalate = true
 *
 * @param {Object} slotRates - { slot_name: availability_rate }
 * @param {number} minQuorum - minimum successful slots needed
 * @param {number} remainingRounds - rounds left in deliberation loop
 * @param {number} threshold - escalation threshold (optional, defaults to 0.10)
 * @returns {{ shouldEscalate: boolean, probability: number, threshold: number, remainingRounds: number, pPerRound: number }}
 */
function computeEarlyEscalation(slotRates, minQuorum, remainingRounds, threshold) {
  if (typeof threshold !== 'number') threshold = readEarlyEscalationThreshold();
  if (remainingRounds <= 0) {
    return { shouldEscalate: true, probability: 0, threshold, remainingRounds, pPerRound: 0 };
  }
  const rates = Object.values(slotRates);
  const pPerRound = poissonBinomialCDF(rates, minQuorum);
  const probability = 1 - Math.pow(1 - pPerRound, remainingRounds);
  const rounded = Math.round(probability * 1e6) / 1e6;
  return {
    shouldEscalate: rounded < threshold,
    probability: rounded,
    threshold,
    remainingRounds,
    pPerRound: Math.round(pPerRound * 1e6) / 1e6,
  };
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const minQuorumArg = args.find(a => a.startsWith('--min-quorum='));
  const minQuorum = minQuorumArg ? parseInt(minQuorumArg.split('=')[1], 10) : undefined;

  const remainingRoundsArg = args.find(a => a.startsWith('--remaining-rounds='));

  if (remainingRoundsArg) {
    // HEAL-01: Early escalation mode -- compute P(consensus | remaining rounds)
    const remainingRounds = parseInt(remainingRoundsArg.split('=')[1], 10);
    const pp2 = require('./planning-paths.cjs');
    const scoreboardPath = pp2.resolveWithFallback(process.cwd(), 'quorum-scoreboard');
    let slotRates = null;
    try {
      const { readMCPAvailabilityRates } = require('./run-prism.cjs');
      slotRates = readMCPAvailabilityRates(scoreboardPath);
    } catch (_) {}
    if (!slotRates || Object.keys(slotRates).length === 0) {
      slotRates = { 'slot-1': 0.85, 'slot-2': 0.85, 'slot-3': 0.85, 'slot-4': 0.85 };
    }
    const result = computeEarlyEscalation(slotRates, minQuorum || 2, remainingRounds);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    // Exit 1 = should escalate (stop deliberating), Exit 0 = continue deliberating
    process.exit(result.shouldEscalate ? 1 : 0);
  } else {
    // Original behavior: unconditional consensus gate check
    const result = checkConsensusGate({ minQuorum });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.action === 'proceed' ? 0 : 1);
  }
}

module.exports = { checkConsensusGate, computeConsensusProbability, poissonBinomialCDF, computeEarlyEscalation, readEarlyEscalationThreshold };
