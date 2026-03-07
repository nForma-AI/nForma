#!/usr/bin/env node
'use strict';
// bin/run-prism.cjs
// Invokes PRISM model checker against .planning/formal/prism/quorum.pm.
// Requirements: PRM-01
//
// Usage:
//   node bin/run-prism.cjs                         # default: P=? [ F s=1 ]
//   node bin/run-prism.cjs -pf "P=? [ F s=1 ]"    # explicit property
//   node bin/run-prism.cjs -const tp_rate=0.9274 -const unavail=0.0215
//
// Prerequisites:
//   - PRISM 4.x installed; set PRISM_BIN to path of the prism shell script
//     e.g. export PRISM_BIN="$HOME/prism/bin/prism"
//   - Java >=17 (same JRE used by TLA+/Alloy CI step)
//
// CI: PRISM_BIN is set by the formal-verify workflow step that extracts the
//     Linux binary tarball.

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');
const { readPolicy } = require('./read-policy.cjs');
const { getRequirementIds } = require('./requirement-map.cjs');

// ── Check ID mapping for multi-model support ─────────────────────────────────
const CHECK_ID_MAP = {
  'quorum':           'prism:quorum',
  'mcp-availability': 'prism:mcp-availability',
};
const PROPERTY_MAP = {
  'quorum':           'Quorum consensus probability under agent availability rates',
  'mcp-availability': 'MCP server availability under nondeterministic failure modes',
};

// ── Locate PRISM binary ──────────────────────────────────────────────────────
const { resolvePrismBin } = require('./resolve-prism-bin.cjs');
const prismBin = resolvePrismBin();

if (!prismBin) {
  process.stderr.write(
    '[run-prism] PRISM binary not found at: ' + prismBin + '\n' +
    '[run-prism] Install PRISM and set PRISM_BIN env var:\n' +
    '[run-prism]   export PRISM_BIN="$HOME/prism/bin/prism"\n' +
    '[run-prism] Download: https://www.prismmodelchecker.org/download.php\n'
  );
  try {
    writeCheckResult({
      tool: 'run-prism', formalism: 'prism', result: 'fail',
      check_id: 'prism:quorum', surface: 'prism', property: 'Quorum consensus probability under agent availability rates',
      runtime_ms: 0, summary: 'fail: prism:quorum (binary not found)', triage_tags: [],
      requirement_ids: getRequirementIds('prism:quorum'),
      observation_window: { window_start: new Date().toISOString(), window_end: new Date().toISOString(), n_traces: 0, n_events: 0, window_days: 0 },
      metadata: {}
    });
  } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── Locate model file ────────────────────────────────────────────────────────
const modelPath = path.join(__dirname, '..', '.planning', 'formal', 'prism', 'quorum.pm');
if (!fs.existsSync(modelPath)) {
  process.stderr.write(
    '[run-prism] Model file not found: ' + modelPath + '\n'
  );
  try {
    writeCheckResult({
      tool: 'run-prism', formalism: 'prism', result: 'fail',
      check_id: 'prism:quorum', surface: 'prism', property: 'Quorum consensus probability under agent availability rates',
      runtime_ms: 0, summary: 'fail: prism:quorum (model not found)', triage_tags: [],
      requirement_ids: getRequirementIds('prism:quorum'),
      observation_window: { window_start: new Date().toISOString(), window_end: new Date().toISOString(), n_traces: 0, n_events: 0, window_days: 0 },
      metadata: {}
    });
  } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── readMCPAvailabilityRates (MCPENV-04) ─────────────────────────────────────
// Reads quorum-scoreboard.json and computes per-slot availability rates.
// Returns { 'slot-name': availabilityRate, ... } or null if no data.
// Rate = 1.0 - (unavail_count / total_count) per slot, excluding 'claude' (self).
// Exported for tests.
function readMCPAvailabilityRates(sbPath) {
  let p = sbPath;
  if (!p) {
    try {
      const pp = require('./planning-paths.cjs');
      p = pp.resolveWithFallback(process.cwd(), 'quorum-scoreboard');
    } catch (_) {
      p = path.join(process.cwd(), '.planning', 'quorum-scoreboard.json');
    }
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const sb = JSON.parse(raw);
    const rounds = Array.isArray(sb.rounds) ? sb.rounds : [];
    if (rounds.length === 0) return null;

    const slotStats = {};
    for (const round of rounds) {
      const votes = round.votes || {};
      for (const [slot, code] of Object.entries(votes)) {
        if (slot === 'claude') continue; // exclude self
        // FILTER FIRST — inside readMCPAvailabilityRates, before building the rates object.
        // Composite keys (e.g. 'claude-1:deepseek-ai/DeepSeek-V3.2') contain ':' or '/'
        // which are illegal PRISM identifier characters. Filter them out here so the returned
        // rates object contains only base keys — making the function directly testable with
        // realistic scoreboards that include composite keys.
        if (slot.includes(':') || slot.includes('/')) {
          process.stderr.write('[run-prism] Skipping composite key (invalid PRISM identifier): ' + slot + '\n');
          continue;
        }
        if (!slotStats[slot]) slotStats[slot] = { total: 0, unavail: 0 };
        slotStats[slot].total++;
        if (code === 'UNAVAIL') slotStats[slot].unavail++;
      }
    }

    const rates = {};
    for (const [slot, stats] of Object.entries(slotStats)) {
      if (stats.total === 0) continue;
      rates[slot] = Math.round((1.0 - stats.unavail / stats.total) * 1e6) / 1e6;
    }
    return Object.keys(rates).length > 0 ? rates : null;
  } catch (_) {
    return null; // missing or malformed scoreboard — caller uses priors
  }
}

// ── Read scoreboard for empirical tp_rate / unavail injection (PRISM-02) ────
// Uses process.cwd()/.planning/quorum-scoreboard.json so tests can point to
// a fixture by spawning with a custom cwd (same pattern as run-formal-verify).
let liveTPRate    = null;
let liveUnavail   = null;
let scoreboardPath;
try {
  const pp = require('./planning-paths.cjs');
  scoreboardPath = pp.resolveWithFallback(process.cwd(), 'quorum-scoreboard');
} catch (_) {
  scoreboardPath = path.join(process.cwd(), '.planning', 'quorum-scoreboard.json');
}

// ── Load calibration policy ───────────────────────────────────────────────
const policyPath = path.join(__dirname, '..', '.planning', 'formal', 'policy.yaml');
let policy;
try {
  policy = readPolicy(policyPath);
} catch (e) {
  process.stderr.write('[run-prism] Failed to load policy.yaml: ' + e.message + '\n');
  try {
    writeCheckResult({
      tool: 'run-prism', formalism: 'prism', result: 'fail',
      check_id: 'prism:quorum', surface: 'prism', property: 'Quorum consensus probability under agent availability rates',
      runtime_ms: 0, summary: 'fail: prism:quorum (policy load failed)', triage_tags: [],
      requirement_ids: getRequirementIds('prism:quorum'),
      observation_window: { window_start: new Date().toISOString(), window_end: new Date().toISOString(), n_traces: 0, n_events: 0, window_days: 0 },
      metadata: {}
    });
  } catch (_) {}
  process.exit(1);
}

// ── LOOP-01: export-prism-constants pre-step ─────────────────────────────────
// Ensures rates.const is always current from the scoreboard before PRISM runs.
// Fail-open: if export fails, run-prism continues with whatever rates.const exists.
{
  const exportConstantsPath = path.join(__dirname, 'export-prism-constants.cjs');
  const exportResult = spawnSync(process.execPath, [exportConstantsPath], {
    encoding: 'utf8',
    cwd: process.cwd(),
    timeout: 10000,
  });
  if (exportResult.status !== 0 || exportResult.error) {
    process.stderr.write(
      '[run-prism] Warning: export-prism-constants pre-step failed — rates.const may be stale.\n' +
      (exportResult.stderr || '') + '\n'
    );
  } else {
    process.stdout.write('[run-prism] Pre-step: rates.const updated from scoreboard.\n');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

if (fs.existsSync(scoreboardPath)) {
  try {
    const sb = JSON.parse(fs.readFileSync(scoreboardPath, 'utf8'));
    const rounds = Array.isArray(sb.rounds) ? sb.rounds : [];
    // Aggregate TP and UNAVAIL counts across all slots (excluding 'claude')
    let totalVotes = 0;
    let tpCount    = 0;
    let unavailCount = 0;
    for (const round of rounds) {
      const votes = round.votes || {};
      for (const [slot, code] of Object.entries(votes)) {
        if (slot === 'claude') continue;  // exclude self
        totalVotes++;
        if (code === 'TP' || code === 'TP+' || code === 'TN' || code === 'TN+') tpCount++;
        if (code === 'UNAVAIL') unavailCount++;
      }
    }
    if (totalVotes > 0) {
      liveTPRate  = Math.round((tpCount    / totalVotes) * 1e6) / 1e6;
      liveUnavail = Math.round((unavailCount / totalVotes) * 1e6) / 1e6;
      process.stdout.write(
        '[run-prism] Injected from scoreboard: tp_rate=' + liveTPRate +
        ' unavail=' + liveUnavail + ' (' + rounds.length + ' rounds)\n'
      );
    }
  } catch (_) { /* malformed scoreboard — fall through to priors */ }
}
if (liveTPRate === null) {
  liveTPRate    = policy.conservative_priors.tp_rate;
  liveUnavail   = policy.conservative_priors.unavail;
  process.stderr.write(
    '[run-prism] No scoreboard found — using conservative priors: ' +
    'tp_rate=' + policy.conservative_priors.tp_rate + ' unavail=' + policy.conservative_priors.unavail + '\n'
  );
}

// ── Cold-start state detection (CALIB-02, CALIB-03) ─────────────────────
function computeColdStartState(pol, sbPath, crPath) {
  let ciRunCount = 0;
  let quorumRoundCount = 0;
  let firstRunTimestamp = null;

  // Count CI runs: number of lines in check-results.ndjson
  if (fs.existsSync(crPath)) {
    const lines = fs.readFileSync(crPath, 'utf8')
      .trim().split('\n').filter(l => l.length > 0);
    ciRunCount = lines.length;
  }

  // Read quorum rounds from scoreboard
  if (fs.existsSync(sbPath)) {
    try {
      const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
      const rounds = Array.isArray(sb.rounds) ? sb.rounds : [];
      quorumRoundCount = rounds.length;
      if (rounds.length > 0) {
        const firstRound = rounds[0];
        // Support timestamp (ISO) or date (MM-DD) field
        const raw = firstRound.timestamp || firstRound.date;
        if (raw) {
          const parsed = Date.parse(raw);
          if (!isNaN(parsed)) firstRunTimestamp = parsed;
        }
      }
    } catch (e) {
      process.stderr.write('[run-prism] Warning: failed to parse scoreboard for cold-start: ' + e.message + '\n');
    }
  }

  // Compute days since first run (0 if no history)
  const daysSinceFirst = firstRunTimestamp
    ? (Date.now() - firstRunTimestamp) / (1000 * 60 * 60 * 24)
    : 0;

  // Cold-start is true if ANY threshold is unmet
  const allThresholdsMet =
    ciRunCount       >= pol.cold_start.min_ci_runs &&
    quorumRoundCount >= pol.cold_start.min_quorum_rounds &&
    daysSinceFirst   >= pol.cold_start.min_days;
  const inColdStart = !allThresholdsMet;

  return { inColdStart, ciRunCount, quorumRoundCount, daysSinceFirst, firstRunTimestamp };
}

const checkResultsPath = path.join(process.cwd(), '.planning', 'formal', 'check-results.ndjson');
const coldStartState = computeColdStartState(policy, scoreboardPath, checkResultsPath);
if (coldStartState.inColdStart) {
  process.stderr.write(
    '[run-prism] Cold-start mode active (thresholds not yet met):\n' +
    '[run-prism]   CI runs: '        + coldStartState.ciRunCount       + ' / ' + policy.cold_start.min_ci_runs       + '\n' +
    '[run-prism]   Quorum rounds: '  + coldStartState.quorumRoundCount + ' / ' + policy.cold_start.min_quorum_rounds + '\n' +
    '[run-prism]   Days: '           + coldStartState.daysSinceFirst.toFixed(2) + ' / ' + policy.cold_start.min_days       + '\n'
  );
}

// ── Build argument list ──────────────────────────────────────────────────────
// Extra args passed to this script are forwarded to PRISM after the model path.
// If .planning/formal/prism/quorum.props exists, pass it as the properties file (runs all 4 properties).
// Otherwise fall back to: -pf "P=? [ F s=1 ]"
const extraArgs = process.argv.slice(2);

// ── MCPENV-04: --model mcp-availability flag ─────────────────────────────────
// When --model mcp-availability is passed, run mcp-availability.pm instead of quorum.pm.
// Injects per-slot availability rates from scoreboard as -const flags.
const modelArgIdx = extraArgs.indexOf('--model');
const modelArgValue = modelArgIdx >= 0 ? extraArgs[modelArgIdx + 1] : null;
const useMCPAvailabilityModel = modelArgValue === 'mcp-availability';

// Strip --model <value> and --project-root= from extraArgs before forwarding to PRISM
const filteredExtraArgs = extraArgs
  .filter((a, i) => {
    if (useMCPAvailabilityModel && (i === modelArgIdx || i === modelArgIdx + 1)) return false;
    if (a.startsWith('--project-root')) return false;
    return true;
  });

let activeModelPath = modelPath; // default: quorum.pm
let activeMcpRates = null;       // per-slot rates if mcp-availability model

if (useMCPAvailabilityModel) {
  const mcpModelPath = path.join(__dirname, '..', '.planning', 'formal', 'prism', 'mcp-availability.pm');
  if (!fs.existsSync(mcpModelPath)) {
    process.stderr.write('[run-prism] mcp-availability.pm not found at: ' + mcpModelPath + '\n');
    process.exit(1);
  }
  activeModelPath = mcpModelPath;
  activeMcpRates = readMCPAvailabilityRates();
  if (activeMcpRates) {
    process.stdout.write('[run-prism] MCP rates from scoreboard: ' + JSON.stringify(activeMcpRates) + '\n');
  } else {
    process.stderr.write('[run-prism] No scoreboard rates for mcp-availability — using priors (0.85 per slot)\n');
  }
  process.stdout.write('[run-prism] Model: mcp-availability\n');
}

const hasPf    = filteredExtraArgs.some(a => a === '-pf' || a === '-prop');
const propsFile = path.join(__dirname, '..', '.planning', 'formal', 'prism', useMCPAvailabilityModel ? 'mcp-availability.props' : 'quorum.props');
const hasProps  = !hasPf && fs.existsSync(propsFile);

// Determine if caller already overrides tp_rate or unavail
const callerOverridesTP     = filteredExtraArgs.some((a, i) => a === '-const' && (filteredExtraArgs[i + 1] || '').startsWith('tp_rate='));
const callerOverridesUnavail = filteredExtraArgs.some((a, i) => a === '-const' && (filteredExtraArgs[i + 1] || '').startsWith('unavail='));

const prismArgs = [activeModelPath];
if (hasProps) {
  prismArgs.push(propsFile);
} else if (!hasPf) {
  prismArgs.push('-pf', 'P=? [ F s=1 ]');
}

if (useMCPAvailabilityModel) {
  // Inject per-slot rates as -const flags (slot name: 'codex-1' → 'codex_1_avail')
  if (activeMcpRates) {
    for (const [slot, rate] of Object.entries(activeMcpRates)) {
      const constName = slot.replace(/-/g, '_') + '_avail';
      prismArgs.push('-const', constName + '=' + rate);
    }
  }
  // No tp_rate/unavail injection for mcp-availability model
} else {
  // Inject empirical/prior rates unless caller overrides (quorum.pm path)
  if (!callerOverridesTP) {
    prismArgs.push('-const', 'tp_rate=' + liveTPRate);
  }
  if (!callerOverridesUnavail) {
    prismArgs.push('-const', 'unavail=' + liveUnavail);
  }
}
prismArgs.push(...filteredExtraArgs);

process.stdout.write('[run-prism] Binary: ' + prismBin + '\n');
process.stdout.write('[run-prism] Model:  ' + activeModelPath + '\n');
process.stdout.write('[run-prism] Args:   ' + prismArgs.slice(1).join(' ') + '\n');

// ── Invoke PRISM ─────────────────────────────────────────────────────────────
const _startMs = Date.now();

const result = spawnSync(prismBin, prismArgs, {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write('[run-prism] Failed to launch PRISM: ' + result.error.message + '\n');
  const _runtimeMs = Date.now() - _startMs;
  const modelName = useMCPAvailabilityModel ? 'mcp-availability' : 'quorum';
  const check_id = CHECK_ID_MAP[modelName];
  try {
    writeCheckResult({
      tool: 'run-prism', formalism: 'prism', result: 'fail',
      check_id: check_id, surface: 'prism', property: PROPERTY_MAP[modelName],
      runtime_ms: _runtimeMs, summary: 'fail: ' + check_id + ' in ' + _runtimeMs + 'ms', triage_tags: [],
      requirement_ids: getRequirementIds(check_id),
      observation_window: { window_start: new Date().toISOString(), window_end: new Date().toISOString(), n_traces: 0, n_events: 0, window_days: 0 },
      metadata: {}
    });
  } catch (e) { process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

const passed = (result.status || 0) === 0;

// Apply cold-start override: never emit result=fail during cold-start (CALIB-02)
let finalResult = passed ? 'pass' : 'fail';
if (!passed && coldStartState.inColdStart) {
  finalResult = 'warn';
  process.stderr.write('[run-prism] Cold-start mode: suppressing fail → emitting warn\n');
}

// Build observation_window as top-level field for v2.1 (CALIB-03)
const _runtimeMs = Date.now() - _startMs;
const modelName = useMCPAvailabilityModel ? 'mcp-availability' : 'quorum';
const check_id = CHECK_ID_MAP[modelName];
const property = PROPERTY_MAP[modelName];

const observationWindow = {
  window_start: coldStartState.firstRunTimestamp
    ? new Date(coldStartState.firstRunTimestamp).toISOString()
    : new Date().toISOString(),
  window_end:  new Date().toISOString(),
  n_traces:    coldStartState.quorumRoundCount,
  n_events:    coldStartState.ciRunCount,
  window_days: coldStartState.firstRunTimestamp ? (Date.now() - coldStartState.firstRunTimestamp) / (1000 * 60 * 60 * 24) : 0,
};

// Build triage_tags based on PRISM thresholds
const tags = [];
if (_runtimeMs > 300000) tags.push('timeout-risk');
else if (_runtimeMs > 120000) tags.push('slow-verify');
if (observationWindow.window_days < 7 || observationWindow.n_traces < 30) tags.push('low-confidence');

// Prepare metadata for non-observation_window fields
const metadata = {};
if (useMCPAvailabilityModel) {
  metadata.model = 'mcp-availability';
  metadata.per_slot_rates = activeMcpRates || 'priors';
}
metadata.tp_rate = liveTPRate;
metadata.unavail = liveUnavail;

try {
  writeCheckResult({
    tool:               'run-prism',
    formalism:          'prism',
    result:             finalResult,
    check_id:           check_id,
    surface:            'prism',
    property:           property,
    runtime_ms:         _runtimeMs,
    summary:            finalResult + ': ' + modelName + ' in ' + _runtimeMs + 'ms',
    triage_tags:        tags,
    requirement_ids:    getRequirementIds(check_id),
    observation_window: observationWindow,
    metadata:           metadata,
  });
} catch (e) {
  process.stderr.write('[run-prism] Warning: failed to write check result: ' + e.message + '\n');
}

if (require.main === module) {
  process.exit(passed ? 0 : (finalResult === 'warn' ? 0 : 1));
}

module.exports = { readMCPAvailabilityRates };
