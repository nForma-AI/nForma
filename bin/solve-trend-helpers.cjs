#!/usr/bin/env node
'use strict';

/**
 * solve-trend-helpers.cjs — Trend entry append and gate summary helpers.
 *
 * Extracted from nf-solve.cjs for testability.
 * Requirements: TRACK-01, TRACK-04
 */

const fs = require('fs');
const path = require('path');
const { LAYER_KEYS } = require('./layer-constants.cjs');
const { resolveGateScore } = require('./gate-score-utils.cjs');

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Reads gate scores from the 3 gate JSON files in .planning/formal/gates/.
 * Fail-open: returns null for any gate that cannot be read.
 *
 * @param {string} root - Project root directory
 * @returns {{ a: {score: number, target_met: boolean}|null, b: {score: number, target_met: boolean}|null, c: {score: number, target_met: boolean}|null }}
 */
function readGateSummary(root) {
  const gatesDir = path.join(root, '.planning', 'formal', 'gates');
  const result = { a: null, b: null, c: null };

  // Gate A: prefers wiring_evidence_score (schema v2), falls back to grounding_score (schema v1)
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-a-grounding.json'), 'utf8'));
    result.a = { score: resolveGateScore(raw, 'a'), target_met: raw.target_met };
  } catch (_) { /* fail-open */ }

  // Gate B: prefers wiring_purpose_score (schema v2), falls back to gate_b_score (schema v1)
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-b-abstraction.json'), 'utf8'));
    result.b = { score: resolveGateScore(raw, 'b'), target_met: raw.target_met };
  } catch (_) { /* fail-open */ }

  // Gate C: prefers wiring_coverage_score (schema v2), falls back to gate_c_score (schema v1)
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gate-c-validation.json'), 'utf8'));
    result.c = { score: resolveGateScore(raw, 'c'), target_met: raw.target_met };
  } catch (_) { /* fail-open */ }

  return result;
}

/**
 * Reads the last valid JSONL entry from solve-trend.jsonl.
 * Skips malformed lines by parsing in reverse.
 *
 * @param {string} trendPath - Path to solve-trend.jsonl
 * @returns {Object|null} Last valid entry, or null if no valid entries
 */
function readLastTrendEntry(trendPath) {
  try {
    if (!fs.existsSync(trendPath)) return null;
    const content = fs.readFileSync(trendPath, 'utf8').trim();
    if (!content) return null;
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]);
      } catch (_) {
        // skip malformed line
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Appends a single JSON line to solve-trend.jsonl with scope-growth detection.
 *
 * @param {Object} finalResidual - The residual object from computeResidual()
 * @param {boolean} converged - Whether the solver converged
 * @param {number} iterations - Number of iterations run
 * @param {Object} options
 * @param {string} options.root - Project root directory
 * @param {boolean} [options.fastMode=false] - Whether fast mode was used
 * @param {string} [options.trendPath] - Override path to solve-trend.jsonl (for testing)
 * @param {string} [options.requirementsPath] - Override path to requirements.json (for testing)
 * @param {string} [options.gatesRoot] - Override root for readGateSummary (for testing)
 */
function appendTrendEntry(finalResidual, converged, iterations, options = {}) {
  try {
    const root = options.root || process.cwd();
    const trendPath = options.trendPath || path.join(root, '.planning', 'formal', 'solve-trend.jsonl');
    const reqPath = options.requirementsPath || path.join(root, '.planning', 'formal', 'requirements.json');
    const gatesRoot = options.gatesRoot || root;
    const isFast = options.fastMode || false;

    // Read requirement count (fail-open to 0)
    let requirementCount = 0;
    try {
      const reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
      if (Array.isArray(reqData.requirements)) {
        requirementCount = reqData.requirements.length;
      }
    } catch (_) { /* fail-open */ }

    // Read gate summary
    const gateSummary = readGateSummary(gatesRoot);

    // Build per_layer object with all 19 keys
    const perLayer = {};
    for (const key of LAYER_KEYS) {
      if (finalResidual[key] && typeof finalResidual[key].residual === 'number') {
        perLayer[key] = finalResidual[key].residual;
      } else {
        perLayer[key] = -1; // missing/skipped layer
      }
    }

    // Determine scope_change by comparing with last entry
    const lastEntry = readLastTrendEntry(trendPath);
    let scopeChange = null;
    if (lastEntry && typeof lastEntry.requirement_count === 'number') {
      if (requirementCount > lastEntry.requirement_count) {
        scopeChange = 'SCOPE_GROWTH';
      } else if (requirementCount === lastEntry.requirement_count) {
        scopeChange = 'STABLE';
      } else {
        scopeChange = 'SCOPE_REDUCTION';
      }
    }

    // Total residual
    const totalResidual = typeof finalResidual.total === 'number' ? finalResidual.total : 0;

    // CONV-02: Extract bucket breakdown from finalResidual
    const bucketAutomatable = typeof finalResidual.automatable === 'number' ? finalResidual.automatable : -1;
    const bucketManual = typeof finalResidual.manual === 'number' ? finalResidual.manual : -1;
    const bucketInformational = typeof finalResidual.informational === 'number' ? finalResidual.informational : -1;

    // Build entry
    const entry = {
      timestamp: new Date().toISOString(),
      iteration_count: iterations,
      converged: converged,
      total_residual: totalResidual,
      buckets: { automatable: bucketAutomatable, manual: bucketManual, informational: bucketInformational },
      per_layer: perLayer,
      gate_summary: gateSummary,
      requirement_count: requirementCount,
      scope_change: scopeChange,
      fast_mode: isFast,
    };

    // Ensure directory exists
    const dir = path.dirname(trendPath);
    fs.mkdirSync(dir, { recursive: true });

    // Append
    fs.appendFileSync(trendPath, JSON.stringify(entry) + '\n');
  } catch (e) {
    process.stderr.write('[nf-solve] WARNING: could not write trend entry: ' + e.message + '\n');
  }
}

module.exports = {
  appendTrendEntry,
  readGateSummary,
  readLastTrendEntry,
  LAYER_KEYS,
};
