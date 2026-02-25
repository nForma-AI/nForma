#!/usr/bin/env node
'use strict';
// bin/verify-quorum-health.cjs
// Verifies that the XState machine's maxDeliberation is calibrated for the
// actual empirical reliability of the quorum agents.
//
// The formal PRISM model uses conservative priors (tp=0.85, unavail=0.15).
// This tool substitutes real scoreboard rates and recomputes:
//   - P(majority per round)  — joint probability across all agents
//   - Expected rounds         — average rounds to decide
//   - P(within MaxDeliberation rounds) — actual confidence for the current setting
//   - Recommended MaxDeliberation for target confidence
//
// Exits 1 if actual P(within MaxDeliberation) < TARGET_CONFIDENCE.
// This makes it a CI gate: if agents degrade, the build breaks and flags it.
//
// Usage:
//   node bin/verify-quorum-health.cjs              # target: 95%
//   node bin/verify-quorum-health.cjs --target=0.99

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_TARGET = 0.95;
const targetArg = process.argv.find(a => a.startsWith('--target='));
const TARGET_CONFIDENCE = targetArg ? parseFloat(targetArg.split('=')[1]) : DEFAULT_TARGET;

// ── Load XState machine (source of truth for MaxDeliberation) ─────────────────
const machineSrc = fs.readFileSync(
  path.join(ROOT, 'src', 'machines', 'qgsd-workflow.machine.ts'), 'utf8'
);
const maxDelibMatch = machineSrc.match(/maxDeliberation:\s*(\d+)/);
const maxDelib = maxDelibMatch ? parseInt(maxDelibMatch[1], 10) : null;
if (!maxDelib) {
  process.stderr.write('[verify-quorum-health] Cannot read maxDeliberation from XState machine.\n');
  process.exit(1);
}

// ── Load scoreboard ────────────────────────────────────────────────────────────
const scoreboardPath = path.join(ROOT, '.planning', 'quorum-scoreboard.json');
if (!fs.existsSync(scoreboardPath)) {
  process.stderr.write('[verify-quorum-health] No scoreboard found — cannot compute empirical rates.\n');
  process.stderr.write('[verify-quorum-health] Run some quorum rounds first.\n');
  process.exit(1);
}
const scoreboard = JSON.parse(fs.readFileSync(scoreboardPath, 'utf8'));
const rounds = scoreboard.rounds || [];

// ── Compute per-agent rates ───────────────────────────────────────────────────
// Same logic as export-prism-constants.cjs
const SLOTS       = ['gemini', 'opencode', 'copilot', 'codex'];
const MIN_ROUNDS  = 30;
const TP_PRIOR    = 0.85;
const UNAVAIL_PRIOR = 0.15;

function computeRates(slot) {
  const relevant = rounds.filter(r => r.votes && r.votes[slot] !== undefined);
  const n = relevant.length;
  if (n < MIN_ROUNDS) {
    return { n, tpRate: TP_PRIOR, unavailRate: UNAVAIL_PRIOR, usedPrior: true };
  }
  const approvals = relevant.filter(r => r.votes[slot] === 'TP' || r.votes[slot] === 'TP+').length;
  const unavails  = relevant.filter(r => r.votes[slot] === 'UNAVAIL').length;
  return {
    n,
    tpRate:      approvals / n,
    unavailRate: unavails  / n,
    usedPrior:   false,
  };
}

const agentRates = {};
for (const slot of SLOTS) {
  const r = computeRates(slot);
  agentRates[slot] = {
    ...r,
    pApprove: r.tpRate * (1 - r.unavailRate),  // P(agent votes APPROVE in one round)
  };
}

// ── Compute joint majority probability ────────────────────────────────────────
// QGSD: Claude always approves (structural). Majority = 3/5 agents.
// So we need at least 2 of the 4 external agents to approve.
// Uses full inclusion-exclusion over all 16 subsets.

function pMajorityExternal(agents) {
  // P(at least 2 of the external agents approve)
  const names = Object.keys(agents);
  const n = names.length;
  let pAtLeast2 = 0;

  for (let mask = 0; mask < (1 << n); mask++) {
    const selected = names.filter((_, i) => mask & (1 << i));
    if (selected.length < 2) continue;
    const prob = names.reduce((acc, name, i) =>
      acc * ((mask & (1 << i)) ? agents[name].pApprove : (1 - agents[name].pApprove))
    , 1);
    pAtLeast2 += prob;
  }
  return pAtLeast2;
}

const pPerRound  = pMajorityExternal(agentRates);
const expected   = 1 / pPerRound;
const pWithinK   = k => 1 - Math.pow(1 - pPerRound, k);
const kForTarget = Math.ceil(Math.log(1 - TARGET_CONFIDENCE) / Math.log(1 - pPerRound));
const pActual    = pWithinK(maxDelib);

// ── Conservative-prior comparison ────────────────────────────────────────────
const P_PRIOR_PER_ROUND = 0.85 * (1 - 0.15);  // 0.7225 — what quorum.props assumed
const pPriorWithinK = k => 1 - Math.pow(1 - P_PRIOR_PER_ROUND, k);

// ── Report ────────────────────────────────────────────────────────────────────
process.stdout.write('\n[verify-quorum-health] QGSD Quorum Reliability Report\n');
process.stdout.write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

process.stdout.write('Per-agent effective approval probability (tp_rate × availability):\n');
for (const [slot, r] of Object.entries(agentRates)) {
  const flag = r.usedPrior ? ' [prior]' : ' [empirical, n=' + r.n + ']';
  process.stdout.write(
    '  ' + slot.padEnd(10) + 'tp=' + r.tpRate.toFixed(4) +
    '  unavail=' + r.unavailRate.toFixed(4) +
    '  p_approve=' + r.pApprove.toFixed(4) + flag + '\n'
  );
}

process.stdout.write('\nJoint majority probability (P(≥2 of 4 external approve | Claude always approves)):\n');
process.stdout.write('  Conservative priors: p_round = ' + P_PRIOR_PER_ROUND.toFixed(4) + '\n');
process.stdout.write('  Empirical rates:     p_round = ' + pPerRound.toFixed(4) + '\n');

process.stdout.write('\nConvergence analysis with maxDeliberation=' + maxDelib + ' (from XState machine):\n');
process.stdout.write('  Expected rounds (empirical): ' + expected.toFixed(2) + '\n');
process.stdout.write('  P(decide within ' + maxDelib + ' rounds):\n');
process.stdout.write('    Prior assumption:    ' + (pPriorWithinK(maxDelib) * 100).toFixed(1) + '% (spec was designed for this)\n');
process.stdout.write('    Empirical reality:   ' + (pActual * 100).toFixed(1) + '%  ← actual system\n');

const gap = pPriorWithinK(maxDelib) - pActual;
if (gap > 0.01) {
  process.stdout.write('    Gap: -' + (gap * 100).toFixed(1) + ' percentage points from designed confidence\n');
}

process.stdout.write('\nRecommended maxDeliberation for target confidence levels:\n');
for (const [label, t] of [['90%', 0.90], ['95%', 0.95], ['99%', 0.99]]) {
  const k = Math.ceil(Math.log(1 - t) / Math.log(1 - pPerRound));
  const mark = t === TARGET_CONFIDENCE ? ' ← target' : '';
  process.stdout.write('  ' + label + ' confidence: maxDeliberation = ' + k + mark + '\n');
}

process.stdout.write('\n');

// ── Gate ──────────────────────────────────────────────────────────────────────
const pass = pActual >= TARGET_CONFIDENCE;

if (pass) {
  process.stdout.write('✓ PASS  P(within ' + maxDelib + ' rounds) = ' + (pActual * 100).toFixed(1) + '% ≥ ' + (TARGET_CONFIDENCE * 100).toFixed(0) + '% target\n\n');
} else {
  process.stderr.write(
    '✗ FAIL  P(within ' + maxDelib + ' rounds) = ' + (pActual * 100).toFixed(1) + '% < ' + (TARGET_CONFIDENCE * 100).toFixed(0) + '% target\n' +
    '        Action: update maxDeliberation to ' + kForTarget + ' in src/machines/qgsd-workflow.machine.ts\n' +
    '        Then re-run: node bin/generate-formal-specs.cjs && node bin/run-tlc.cjs MCsafety\n\n'
  );
  process.exit(1);
}
