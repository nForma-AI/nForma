#!/usr/bin/env node
'use strict';

/**
 * compute-per-model-gates.cjs — Per-model gate maturity scoring.
 *
 * Computes which gates (A/B/C) each formal model passes, updates layer_maturity
 * scores (0-3), auto-promotes eligible models, and optionally writes back to
 * model-registry.json.
 *
 * Requirements: GATE-01, GATE-02, GATE-03, GATE-04
 *
 * Usage:
 *   node bin/compute-per-model-gates.cjs              # human-readable summary
 *   node bin/compute-per-model-gates.cjs --json        # machine-readable JSON
 *   node bin/compute-per-model-gates.cjs --dry-run     # compute but don't write
 *   node bin/compute-per-model-gates.cjs --json --dry-run
 */

const fs   = require('fs');
const path = require('path');

const ROOT = (() => {
  const idx = process.argv.findIndex(a => a.startsWith('--project-root='));
  return idx >= 0 ? process.argv[idx].split('=')[1] : (process.env.PROJECT_ROOT || path.join(__dirname, '..'));
})();

const FORMAL = path.join(ROOT, '.planning', 'formal');
const REGISTRY_PATH      = path.join(FORMAL, 'model-registry.json');
const LAYER_MANIFEST_PATH = path.join(FORMAL, 'layer-manifest.json');
const TRACE_MATRIX_PATH   = path.join(FORMAL, 'traceability-matrix.json');
const HAZARD_MODEL_PATH   = path.join(FORMAL, 'reasoning', 'hazard-model.json');
const FAILURE_CATALOG_PATH = path.join(FORMAL, 'reasoning', 'failure-mode-catalog.json');
const TEST_RECIPES_PATH   = path.join(FORMAL, 'test-recipes', 'test-recipes.json');

const JSON_FLAG       = process.argv.includes('--json');
const DRY_RUN_FLAG    = process.argv.includes('--dry-run');
const SKIP_EVIDENCE   = process.argv.includes('--skip-evidence');

const TAG = '[compute-per-model-gates]';

const EVIDENCE_DIR = path.join(FORMAL, 'evidence');

// ── Import from promote-gate-maturity.cjs ────────────────────────────────────

const {
  validateCriteria,
  inferSourceLayer,
  loadCheckResults,
  getModelKeys,
} = require('./promote-gate-maturity.cjs');

// ── Data loaders (fail-open) ─────────────────────────────────────────────────

function loadJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    process.stderr.write(TAG + ' WARNING: ' + label + ' not found at ' + filePath + '\n');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    process.stderr.write(TAG + ' WARNING: failed to parse ' + label + ': ' + e.message + '\n');
    return null;
  }
}

// ── Gate A: Grounding (L1 → L2) ─────────────────────────────────────────────

function evaluateGateA(modelPath, model, layerManifest, traceMatrix, checkResults) {
  // Path 1: layer-manifest shows has_semantic_declarations
  if (layerManifest) {
    for (const layer of Object.values(layerManifest.layers || {})) {
      for (const entry of (Array.isArray(layer) ? layer : [])) {
        if (entry.path === modelPath && entry.grounding_status === 'has_semantic_declarations') {
          return true;
        }
      }
    }
  }

  // Path 2: model has source_layer + requirements with passing trace checks
  const sourceLayer = model.source_layer || inferSourceLayer(modelPath);
  if (!sourceLayer) return false;

  const reqs = model.requirements || [];
  if (reqs.length === 0) return false;

  if (!traceMatrix || !traceMatrix.requirements) return false;

  for (const reqId of reqs) {
    const reqEntry = traceMatrix.requirements[reqId];
    if (!reqEntry || !reqEntry.properties) continue;
    for (const prop of reqEntry.properties) {
      if (prop.latest_result === 'pass') return true;
      // Also check check-results.ndjson for this requirement
      if (checkResults.some(cr => cr.result === 'pass' && cr.requirement_ids && cr.requirement_ids.includes(reqId))) {
        return true;
      }
    }
  }

  return false;
}

// ── Gate B: Abstraction (L2 → L3) ───────────────────────────────────────────

function evaluateGateB(modelPath, model, hazardModel) {
  const sourceLayer = model.source_layer || inferSourceLayer(modelPath);
  if (!sourceLayer) return false;

  // Path 1: model referenced in hazard-model derived_from artifacts
  if (hazardModel && hazardModel.hazards) {
    for (const hazard of hazardModel.hazards) {
      for (const df of (hazard.derived_from || [])) {
        if (df.artifact && modelPath.includes(df.artifact)) return true;
      }
    }
  }

  // Path 2: model is L3 and has non-empty requirements
  if (sourceLayer === 'L3' && (model.requirements || []).length > 0) {
    return true;
  }

  return false;
}

// ── Gate C: Validation (L3 → TC) ────────────────────────────────────────────

function evaluateGateC(modelPath, model, failureCatalog, testRecipes, checkResults) {
  const reqs = model.requirements || [];

  // Path 1: requirements map to failure modes that have test recipes
  if (failureCatalog && testRecipes && reqs.length > 0) {
    const recipeFailureModeIds = new Set(
      (testRecipes.recipes || []).map(r => r.failure_mode_id)
    );
    for (const fm of (failureCatalog.failure_modes || [])) {
      // Check if this failure mode's derived_from references overlap with model requirements
      const fmReqOverlap = (fm.derived_from || []).some(df =>
        df.ref && reqs.some(r => df.ref.includes(r))
      );
      if (fmReqOverlap && recipeFailureModeIds.has(fm.id)) return true;
    }
  }

  // Path 2: passing check-result matching the model path
  const modelLower = modelPath.toLowerCase();
  if (checkResults.some(cr => {
    if (cr.result !== 'pass') return false;
    const toolMatch = cr.tool && modelLower.includes(cr.tool.toLowerCase());
    const checkIdPart = cr.check_id ? (cr.check_id.split(':')[1] || '') : '';
    const checkIdMatch = checkIdPart && modelLower.includes(checkIdPart.toLowerCase());
    return toolMatch || checkIdMatch;
  })) {
    return true;
  }

  return false;
}

// ── Evidence readiness ────────────────────────────────────────────────────────

/**
 * Loads evidence files and scores readiness (0-5).
 * Fail-open: missing or malformed files contribute 0.
 */
function computeEvidenceReadiness() {
  if (SKIP_EVIDENCE) {
    process.stderr.write(TAG + ' Evidence loading skipped (--skip-evidence)\n');
    return { score: 0, total: 5, skipped: true, details: {} };
  }

  const checks = {
    'instrumentation-map': (d) => Array.isArray(d.actions) && d.actions.length > 0,
    'state-candidates': (d) => Array.isArray(d.candidates) && d.candidates.length > 0,
    'failure-taxonomy': (d) =>
      (Array.isArray(d.classifications) && d.classifications.length > 0) ||
      (Array.isArray(d.categories) && d.categories.length > 0),
    'trace-corpus-stats': (d) => Array.isArray(d.sessions) && d.sessions.length > 0,
    'proposed-metrics': (d) => Array.isArray(d.metrics) && d.metrics.length > 0,
  };

  const details = {};
  let score = 0;

  for (const [name, validator] of Object.entries(checks)) {
    const filePath = path.join(EVIDENCE_DIR, name + '.json');
    let ready = false;
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        ready = validator(data);
      }
    } catch (e) {
      // fail-open: malformed file contributes 0
    }
    details[name] = ready;
    if (ready) score++;
  }

  return { score, total: 5, skipped: false, details };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    process.stderr.write(TAG + ' ERROR: model-registry.json not found\n');
    process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const models = registry.models || registry;
  const modelKeys = Object.keys(models).filter(k => k.startsWith('.'));

  const layerManifest  = loadJSON(LAYER_MANIFEST_PATH, 'layer-manifest.json');
  const traceMatrix    = loadJSON(TRACE_MATRIX_PATH, 'traceability-matrix.json');
  const hazardModel    = loadJSON(HAZARD_MODEL_PATH, 'hazard-model.json');
  const failureCatalog = loadJSON(FAILURE_CATALOG_PATH, 'failure-mode-catalog.json');
  const testRecipes    = loadJSON(TEST_RECIPES_PATH, 'test-recipes.json');
  const checkResults   = loadCheckResults();

  // Evidence readiness scoring
  const evidenceReadiness = computeEvidenceReadiness();

  const perModel = {};
  const promotions = [];
  let gateACount = 0, gateBCount = 0, gateCCount = 0;
  let totalMaturity = 0;

  for (const modelPath of modelKeys) {
    const model = models[modelPath];

    const gateA = evaluateGateA(modelPath, model, layerManifest, traceMatrix, checkResults);
    const gateB = evaluateGateB(modelPath, model, hazardModel);
    const gateC = evaluateGateC(modelPath, model, failureCatalog, testRecipes, checkResults);

    const maturity = (gateA ? 1 : 0) + (gateB ? 1 : 0) + (gateC ? 1 : 0);

    if (gateA) gateACount++;
    if (gateB) gateBCount++;
    if (gateC) gateCCount++;
    totalMaturity += maturity;

    // Update layer_maturity in registry
    const prevMaturity = model.layer_maturity || 0;
    if (maturity > prevMaturity) {
      model.layer_maturity = maturity;
      model.last_updated = new Date().toISOString();
    }

    // Auto-promotion: ADVISORY → SOFT_GATE if maturity >= 1 and has source_layer
    const currentGate = model.gate_maturity || 'ADVISORY';
    let promoted = false;

    if (maturity >= 1 && currentGate === 'ADVISORY' && (evidenceReadiness.skipped || evidenceReadiness.score >= 1)) {
      const sourceLayer = model.source_layer || inferSourceLayer(modelPath);
      if (sourceLayer) {
        const v = validateCriteria(modelPath, model, 'SOFT_GATE', checkResults, evidenceReadiness);
        if (v.valid) {
          model.gate_maturity = 'SOFT_GATE';
          if (!model.source_layer) model.source_layer = sourceLayer;
          model.last_updated = new Date().toISOString();
          promotions.push({ model: modelPath, from: 'ADVISORY', to: 'SOFT_GATE' });
          promoted = true;
        }
      }
    }

    // Auto-promotion: SOFT_GATE → HARD_GATE if maturity >= 3 and has passing check
    if (maturity >= 3 && (model.gate_maturity === 'SOFT_GATE' || (promoted && model.gate_maturity === 'SOFT_GATE')) && (evidenceReadiness.skipped || evidenceReadiness.score >= 3)) {
      const v = validateCriteria(modelPath, model, 'HARD_GATE', checkResults, evidenceReadiness);
      if (v.valid) {
        model.gate_maturity = 'HARD_GATE';
        model.last_updated = new Date().toISOString();
        const existingPromo = promotions.find(p => p.model === modelPath);
        if (existingPromo) {
          existingPromo.to = 'HARD_GATE';
        } else {
          promotions.push({ model: modelPath, from: 'SOFT_GATE', to: 'HARD_GATE' });
        }
      }
    }

    perModel[modelPath] = {
      gate_a: gateA,
      gate_b: gateB,
      gate_c: gateC,
      layer_maturity: model.layer_maturity || maturity,
      gate_maturity: model.gate_maturity || 'ADVISORY',
      promoted,
      evidence_readiness: evidenceReadiness,
    };
  }

  // Write back unless dry-run
  if (!DRY_RUN_FLAG) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
  }

  const avgMaturity = modelKeys.length > 0 ? +(totalMaturity / modelKeys.length).toFixed(2) : 0;

  const output = {
    generated: new Date().toISOString(),
    total_models: modelKeys.length,
    scores: {
      gate_a_pass: gateACount,
      gate_b_pass: gateBCount,
      gate_c_pass: gateCCount,
      avg_layer_maturity: avgMaturity,
    },
    evidence_readiness: evidenceReadiness,
    promotions,
    per_model: perModel,
  };

  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify(output));
  } else {
    console.log('Per-Model Gate Maturity Scoring');
    console.log('  Total models: ' + modelKeys.length);
    console.log('  Gate A (grounding) pass: ' + gateACount);
    console.log('  Gate B (abstraction) pass: ' + gateBCount);
    console.log('  Gate C (validation) pass: ' + gateCCount);
    console.log('  Avg layer_maturity: ' + avgMaturity);
    if (promotions.length > 0) {
      console.log('  Promotions:');
      for (const p of promotions) {
        console.log('    ' + p.model + ': ' + p.from + ' -> ' + p.to);
      }
    }
    if (DRY_RUN_FLAG) {
      console.log('  (dry-run: no changes written)');
    }
  }
}

main();
