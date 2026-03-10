#!/usr/bin/env node
'use strict';

/**
 * predictive-power.cjs — Bug-to-property linking, per-model recall scoring,
 * convergence velocity estimation.
 *
 * Requirements: PRED-01, PRED-02
 */

const fs = require('fs');
const path = require('path');

// ── Bug-to-Property Linking (PRED-01) ────────────────────────────────────────

/**
 * Links observed bugs (from debt.json) to formal properties (from model-registry.json)
 * that could have caught them, using requirement ID overlap as the JOIN key.
 *
 * @param {string} debtPath - Path to debt.json
 * @param {string} registryPath - Path to model-registry.json
 * @returns {Object} Mapping object with schema_version, total_bugs, total_linked, mappings
 */
function linkBugsToProperties(debtPath, registryPath) {
  let debt;
  try {
    debt = JSON.parse(fs.readFileSync(debtPath, 'utf8'));
  } catch (e) {
    process.stderr.write('[predictive-power] WARNING: cannot read debt.json: ' + e.message + '\n');
    return { schema_version: '1', total_bugs: 0, total_linked: 0, mappings: [] };
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    process.stderr.write('[predictive-power] WARNING: cannot read model-registry.json: ' + e.message + '\n');
    return { schema_version: '1', total_bugs: 0, total_linked: 0, mappings: [] };
  }

  const models = registry.models || registry;
  const entries = debt.debt_entries || [];
  const mappings = [];
  let totalLinked = 0;

  for (const entry of entries) {
    const refs = entry.formal_refs || [];

    if (refs.length === 0) {
      // Unlinked bug — no formal_refs
      mappings.push({
        bug_id: entry.id,
        bug_fingerprint: entry.fingerprint,
        bug_title: (entry.title || '').slice(0, 120),
        source_type: entry.source_entries?.[0]?.source_type || 'unknown',
        formal_refs: [],
        matching_models: [],
        predicted: false,
      });
      continue;
    }

    const matching = [];
    for (const [modelPath, model] of Object.entries(models)) {
      // Filter to only model paths starting with '.'
      if (!modelPath.startsWith('.')) continue;
      const overlap = (model.requirements || []).filter(r => refs.includes(r));
      if (overlap.length > 0) {
        matching.push({
          model_path: modelPath,
          requirements_overlap: overlap,
          gate_maturity: model.gate_maturity || 'ADVISORY',
          layer_maturity: model.layer_maturity || 0,
        });
      }
    }

    mappings.push({
      bug_id: entry.id,
      bug_fingerprint: entry.fingerprint,
      bug_title: (entry.title || '').slice(0, 120),
      source_type: entry.source_entries?.[0]?.source_type || 'unknown',
      formal_refs: refs,
      matching_models: matching,
      predicted: matching.length > 0,
    });

    if (matching.length > 0) totalLinked++;
  }

  return {
    schema_version: '1',
    total_bugs: mappings.length,
    total_linked: totalLinked,
    mappings,
  };
}

/**
 * Convenience writer — writes mapping object to outputPath as formatted JSON.
 *
 * @param {Object} mappingObj - Mapping object from linkBugsToProperties
 * @param {string} outputPath - Path to write bug-to-property.json
 */
function writeBugToProperty(mappingObj, outputPath) {
  const output = Object.assign({}, mappingObj, {
    generated: new Date().toISOString(),
  });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
}

// ── Per-Model Recall (PRED-02) ───────────────────────────────────────────────

/**
 * Computes per-model recall: bugs_predicted / total_relevant_bugs.
 *
 * A bug is "predicted" if the model passes gate_a (grounding) in per-model-gates.json.
 * Recall is INFORMATIONAL ONLY — not used as a gate input (PRED-03 deferred).
 *
 * @param {Array} mappings - mappings array from linkBugsToProperties result
 * @param {string} perModelGatesPath - Path to per-model-gates.json
 * @returns {Object} Map of model_path -> { relevant, predicted, recall }
 */
function computePerModelRecall(mappings, perModelGatesPath) {
  // Fail-open on missing per-model-gates.json
  let perModelGates = {};
  try {
    perModelGates = JSON.parse(fs.readFileSync(perModelGatesPath, 'utf8'));
  } catch (e) {
    process.stderr.write('[predictive-power] WARNING: cannot read per-model-gates.json: ' + e.message + '\n');
    return {};
  }

  const recall = {};

  for (const mapping of mappings) {
    for (const match of mapping.matching_models) {
      if (!recall[match.model_path]) {
        recall[match.model_path] = { relevant: 0, predicted: 0 };
      }
      recall[match.model_path].relevant++;

      // A bug is "predicted" if the model passes gate_a
      const gates = perModelGates[match.model_path];
      if (gates && gates.gate_a && gates.gate_a.pass) {
        recall[match.model_path].predicted++;
      }
    }
  }

  // Compute recall scores
  for (const [model, counts] of Object.entries(recall)) {
    counts.recall = counts.relevant > 0
      ? +(counts.predicted / counts.relevant).toFixed(4)
      : 0;
  }

  return recall;
}

// ── Recall Summary ───────────────────────────────────────────────────────────

/**
 * Formats a human-readable recall summary (top-5 models, aggregate stats).
 * Kept under 15 lines for solve report integration.
 *
 * @param {Object} recallScores - Map from computePerModelRecall
 * @returns {string} Formatted summary
 */
function formatRecallSummary(recallScores) {
  if (!recallScores || Object.keys(recallScores).length === 0) {
    return '--- Recall ---\nNo recall data available.\n';
  }

  const entries = Object.entries(recallScores);
  const total = entries.length;
  const avgRecall = entries.reduce((sum, [, v]) => sum + v.recall, 0) / total;

  // Top 5 by recall
  const sorted = entries
    .sort(([, a], [, b]) => b.recall - a.recall)
    .slice(0, 5);

  const lines = [
    '--- Recall ---',
    `Models scored: ${total} | Avg recall: ${avgRecall.toFixed(4)}`,
    'Top models by recall:',
  ];

  for (const [model, counts] of sorted) {
    const shortName = path.basename(model);
    lines.push(`  ${shortName}: ${counts.recall} (${counts.predicted}/${counts.relevant})`);
  }

  return lines.join('\n') + '\n';
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  linkBugsToProperties,
  writeBugToProperty,
  computePerModelRecall,
  formatRecallSummary,
};
