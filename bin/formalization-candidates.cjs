#!/usr/bin/env node
'use strict';

/**
 * formalization-candidates.cjs — Ranks uncovered files by formalization priority.
 *
 * Inputs (all fail-open — missing file means empty data):
 *   - .planning/formal/evidence/git-heatmap.json (churn signals)
 *   - .planning/formal/evidence/trace-corpus-stats.json (trace density — currently neutral)
 *   - .planning/formal/model-registry.json (existing coverage)
 *
 * Algorithm: score = churn * trace_density / (1 + existing_model_coverage)
 *   where uncovered files have existing_model_coverage = 0.
 *
 * Requirements: GATE-01, GATE-02, GATE-03, GATE-04
 *
 * Usage:
 *   node bin/formalization-candidates.cjs              # human-readable top 10
 *   node bin/formalization-candidates.cjs --json       # machine-readable JSON
 *   node bin/formalization-candidates.cjs --top=20     # custom top N
 */

const fs   = require('fs');
const path = require('path');

const ROOT = (() => {
  const idx = process.argv.findIndex(a => a.startsWith('--project-root='));
  return idx >= 0 ? process.argv[idx].split('=')[1] : (process.env.PROJECT_ROOT || path.join(__dirname, '..'));
})();

const FORMAL = path.join(ROOT, '.planning', 'formal');
const HEATMAP_PATH = path.join(FORMAL, 'evidence', 'git-heatmap.json');
const TRACE_STATS_PATH = path.join(FORMAL, 'evidence', 'trace-corpus-stats.json');
const REGISTRY_PATH = path.join(FORMAL, 'model-registry.json');

const JSON_FLAG = process.argv.includes('--json');

const TOP_N = (() => {
  const arg = process.argv.find(a => a.startsWith('--top='));
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10);
    if (!isNaN(val) && val >= 1) return val;
  }
  return 10;
})();

// ── Data loaders (fail-open) ─────────────────────────────────────────────────

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. Build churn map from git-heatmap.json
  const churnMap = new Map();
  const heatmap = loadJSON(HEATMAP_PATH);
  if (heatmap && heatmap.signals) {
    // Primary source: numerical_adjustments (file + touch_count)
    const adjustments = heatmap.signals.numerical_adjustments || [];
    for (const entry of adjustments) {
      if (entry.file && typeof entry.touch_count === 'number') {
        const prev = churnMap.get(entry.file) || 0;
        churnMap.set(entry.file, prev + entry.touch_count);
      }
    }

    // Bugfix hotspots get 2x weight
    const hotspots = heatmap.signals.bugfix_hotspots || [];
    if (Array.isArray(hotspots)) {
      for (const entry of hotspots) {
        if (entry.file && typeof entry.fix_count === 'number') {
          const prev = churnMap.get(entry.file) || 0;
          churnMap.set(entry.file, prev + (entry.fix_count * 2));
        }
      }
    }
  }

  // 2. Trace density — trace-corpus-stats.json lacks per-file data.
  // TODO: Per-file trace data would need to come from a future instrumentation source.
  // For now, trace_density = 1.0 for all files (neutral multiplier, degrades to churn-only ranking).
  const _traceStats = loadJSON(TRACE_STATS_PATH); // loaded but unused — structure has no per-file refs
  const TRACE_DENSITY_DEFAULT = 1.0;

  // 3. Build covered files set from model-registry.json
  const coveredFiles = new Set();
  const registry = loadJSON(REGISTRY_PATH);
  if (registry) {
    const models = registry.models || registry;
    for (const [modelPath, model] of Object.entries(models)) {
      if (!modelPath.startsWith('.')) continue;
      // Covered = non-ADVISORY gate maturity or layer_maturity >= 1
      if ((model.gate_maturity && model.gate_maturity !== 'ADVISORY') || (model.layer_maturity >= 1)) {
        coveredFiles.add(modelPath);
      }
    }
  }

  // 4. Score uncovered files
  const candidates = [];
  for (const [file, churn] of churnMap.entries()) {
    if (coveredFiles.has(file)) continue;
    const traceDensity = TRACE_DENSITY_DEFAULT;
    const score = churn * traceDensity; // existing_model_coverage = 0 for uncovered
    candidates.push({
      file,
      score: +score.toFixed(1),
      churn,
      trace_density: traceDensity,
      reason: 'uncovered, churn=' + churn,
    });
  }

  // 5. Sort descending by score
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, TOP_N);

  // Output
  const output = {
    generated: new Date().toISOString(),
    candidates: topCandidates,
  };

  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify(output));
  } else {
    console.log('Formalization Candidates (top ' + TOP_N + ')');
    for (let i = 0; i < topCandidates.length; i++) {
      const c = topCandidates[i];
      const label = c.file.length > 45 ? '...' + c.file.slice(-42) : c.file;
      console.log('  ' + String(i + 1).padStart(2) + '. ' + label.padEnd(47) + 'score: ' + c.score.toFixed(1).padStart(6) + '  churn: ' + String(c.churn).padStart(4) + '  traces: ' + c.trace_density.toFixed(2));
    }
    if (candidates.length > TOP_N) {
      console.log('  ... and ' + (candidates.length - TOP_N) + ' more uncovered files');
    }
  }
}

main();
