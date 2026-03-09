#!/usr/bin/env node
'use strict';

/**
 * promote-gate-maturity.cjs — Gate maturity level promotion CLI.
 *
 * Manages per-model gate enforcement levels: ADVISORY -> SOFT_GATE -> HARD_GATE.
 *
 * Requirements: GATE-04
 *
 * Usage:
 *   node bin/promote-gate-maturity.cjs --model "alloy/quorum-votes.als" --level SOFT_GATE
 *   node bin/promote-gate-maturity.cjs --check              # validate all models
 *   node bin/promote-gate-maturity.cjs --check --fix         # demote violating models
 *   node bin/promote-gate-maturity.cjs --json               # JSON output mode
 */

const fs   = require('fs');
const path = require('path');

const ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
const FORMAL = path.join(ROOT, '.planning', 'formal');
const REGISTRY_PATH = path.join(FORMAL, 'model-registry.json');
const CHECK_RESULTS_PATH = path.join(FORMAL, 'check-results.ndjson');

const JSON_FLAG = process.argv.includes('--json');
const CHECK_FLAG = process.argv.includes('--check');
const FIX_FLAG = process.argv.includes('--fix');

const LEVELS = ['ADVISORY', 'SOFT_GATE', 'HARD_GATE'];
const LEVEL_RANK = { ADVISORY: 0, SOFT_GATE: 1, HARD_GATE: 2 };

// ── Helpers ─────────────────────────────────────────────────────────────────

function getModelKeys(registry) {
  return Object.keys(registry).filter(k => k.startsWith('.'));
}

function getModelLevel(model) {
  return model.gate_maturity || 'ADVISORY';
}

/**
 * Infer source_layer from the model path.
 */
function inferSourceLayer(modelPath) {
  if (modelPath.includes('evidence/') || modelPath.includes('L1') || modelPath.includes('conformance')) return 'L1';
  if (modelPath.includes('semantics/') || modelPath.includes('L2')) return 'L2';
  if (modelPath.includes('reasoning/') || modelPath.includes('L3')) return 'L3';
  // TLA+ and Alloy models are L2 by default (formal specs of the operational model)
  if (modelPath.endsWith('.tla') || modelPath.endsWith('.als') || modelPath.endsWith('.props')) return 'L2';
  return null;
}

// ── Validation criteria ─────────────────────────────────────────────────────

/**
 * Validate that a model meets its current (or target) gate_maturity criteria.
 * Returns { valid: boolean, reason: string }
 */
function validateCriteria(modelPath, model, targetLevel, checkResults, evidenceReadiness) {
  const level = targetLevel || getModelLevel(model);

  if (level === 'ADVISORY') {
    return { valid: true, reason: 'ADVISORY: no criteria required' };
  }

  // SOFT_GATE: requires source_layer
  const sourceLayer = model.source_layer || inferSourceLayer(modelPath);
  if (level === 'SOFT_GATE' || level === 'HARD_GATE') {
    if (!sourceLayer) {
      return { valid: false, reason: 'SOFT_GATE requires source_layer assignment' };
    }
  }

  // Evidence readiness check (when provided and not skipped)
  if (evidenceReadiness && !evidenceReadiness.skipped) {
    if (level === 'SOFT_GATE' && evidenceReadiness.score < 1) {
      return { valid: false, reason: 'SOFT_GATE requires evidence_readiness score >= 1 (got ' + evidenceReadiness.score + ')' };
    }
    if (level === 'HARD_GATE' && evidenceReadiness.score < 3) {
      return { valid: false, reason: 'HARD_GATE requires evidence_readiness score >= 3 (got ' + evidenceReadiness.score + ')' };
    }
  }

  // HARD_GATE: requires SOFT_GATE + passing check-result
  if (level === 'HARD_GATE') {
    const modelLower = modelPath.toLowerCase();
    const hasPassingCheck = checkResults.some(cr => {
      if (cr.result !== 'pass') return false;
      const toolMatch = cr.tool && modelLower.includes(cr.tool.toLowerCase());
      const checkIdPart = cr.check_id ? (cr.check_id.split(':')[1] || '') : '';
      const checkIdMatch = checkIdPart && modelLower.includes(checkIdPart.toLowerCase());
      return toolMatch || checkIdMatch;
    });
    if (!hasPassingCheck) {
      return { valid: false, reason: 'HARD_GATE requires at least one passing check-result' };
    }
  }

  return { valid: true, reason: `${level}: all criteria met` };
}

// ── Promote a single model ──────────────────────────────────────────────────

function promoteModel(registry, modelPath, targetLevel, checkResults) {
  const model = registry[modelPath];
  if (!model) {
    return { success: false, error: `Model not found: ${modelPath}` };
  }

  const currentLevel = getModelLevel(model);
  const currentRank = LEVEL_RANK[currentLevel] ?? 0;
  const targetRank = LEVEL_RANK[targetLevel];

  if (targetRank === undefined) {
    return { success: false, error: `Invalid level: ${targetLevel}. Must be one of: ${LEVELS.join(', ')}` };
  }

  if (targetRank <= currentRank) {
    return { success: false, error: `Cannot promote: ${currentLevel} -> ${targetLevel} is not a promotion` };
  }

  // Validate target level criteria
  const validation = validateCriteria(modelPath, model, targetLevel, checkResults);
  if (!validation.valid) {
    return { success: false, error: `Criteria not met for ${targetLevel}: ${validation.reason}` };
  }

  // Apply promotion
  model.gate_maturity = targetLevel;
  model.last_updated = new Date().toISOString();
  if (!model.source_layer) {
    model.source_layer = inferSourceLayer(modelPath);
  }

  return { success: true, from: currentLevel, to: targetLevel };
}

// ── Check all models ────────────────────────────────────────────────────────

function checkAllModels(registry, checkResults, fix) {
  const modelKeys = getModelKeys(registry);
  const violations = [];
  const demotions = [];

  for (const modelPath of modelKeys) {
    const model = registry[modelPath];
    const level = getModelLevel(model);

    if (level === 'ADVISORY') continue; // Always valid

    const validation = validateCriteria(modelPath, model, level, checkResults);
    if (!validation.valid) {
      violations.push({
        model: modelPath,
        level,
        reason: validation.reason,
      });

      if (fix) {
        // Demote to highest valid level
        if (level === 'HARD_GATE') {
          const softCheck = validateCriteria(modelPath, model, 'SOFT_GATE', checkResults);
          if (softCheck.valid) {
            model.gate_maturity = 'SOFT_GATE';
            model.last_updated = new Date().toISOString();
            demotions.push({ model: modelPath, from: level, to: 'SOFT_GATE' });
          } else {
            model.gate_maturity = 'ADVISORY';
            model.last_updated = new Date().toISOString();
            demotions.push({ model: modelPath, from: level, to: 'ADVISORY' });
          }
        } else {
          model.gate_maturity = 'ADVISORY';
          model.last_updated = new Date().toISOString();
          demotions.push({ model: modelPath, from: level, to: 'ADVISORY' });
        }
      }
    }
  }

  return {
    total: modelKeys.length,
    checked: modelKeys.filter(k => getModelLevel(registry[k]) !== 'ADVISORY').length,
    violations,
    demotions,
    by_level: {
      ADVISORY: modelKeys.filter(k => getModelLevel(registry[k]) === 'ADVISORY').length,
      SOFT_GATE: modelKeys.filter(k => getModelLevel(registry[k]) === 'SOFT_GATE').length,
      HARD_GATE: modelKeys.filter(k => getModelLevel(registry[k]) === 'HARD_GATE').length,
    },
  };
}

// ── Load check results ──────────────────────────────────────────────────────

function loadCheckResults() {
  if (!fs.existsSync(CHECK_RESULTS_PATH)) return [];
  return fs.readFileSync(CHECK_RESULTS_PATH, 'utf8')
    .trim().split('\n').filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ── Entry point ─────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('ERROR: model-registry.json not found at', REGISTRY_PATH);
    process.exit(1);
  }

  const registryFile = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const registry = registryFile.models || registryFile;
  const checkResults = loadCheckResults();

  if (CHECK_FLAG) {
    const result = checkAllModels(registry, checkResults, FIX_FLAG);

    if (FIX_FLAG && result.demotions.length > 0) {
      fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registryFile, null, 2) + '\n');
    }

    if (JSON_FLAG) {
      process.stdout.write(JSON.stringify(result));
    } else {
      console.log(`Gate Maturity Check`);
      console.log(`  Total models: ${result.total}`);
      console.log(`  By level: ${JSON.stringify(result.by_level)}`);
      console.log(`  Violations: ${result.violations.length}`);
      if (result.violations.length > 0) {
        for (const v of result.violations) {
          console.log(`    - ${v.model}: ${v.reason}`);
        }
      }
      if (result.demotions.length > 0) {
        console.log(`  Demotions applied:`);
        for (const d of result.demotions) {
          console.log(`    - ${d.model}: ${d.from} -> ${d.to}`);
        }
      }
    }

    process.exit(result.violations.length > 0 && !FIX_FLAG ? 1 : 0);
  }

  // Promotion mode
  const modelIdx = process.argv.indexOf('--model');
  const levelIdx = process.argv.indexOf('--level');

  if (modelIdx === -1 || levelIdx === -1) {
    console.error('Usage: --model <path> --level <ADVISORY|SOFT_GATE|HARD_GATE>');
    console.error('  or:  --check [--fix] [--json]');
    process.exit(1);
  }

  const modelPath = process.argv[modelIdx + 1];
  const targetLevel = process.argv[levelIdx + 1];

  const result = promoteModel(registry, modelPath, targetLevel, checkResults);

  if (result.success) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registryFile, null, 2) + '\n');

    if (JSON_FLAG) {
      process.stdout.write(JSON.stringify(result));
    } else {
      console.log(`Promoted: ${modelPath}`);
      console.log(`  ${result.from} -> ${result.to}`);
    }
    process.exit(0);
  } else {
    if (JSON_FLAG) {
      process.stdout.write(JSON.stringify(result));
    } else {
      console.error(`Promotion failed: ${result.error}`);
    }
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { promoteModel, validateCriteria, checkAllModels, getModelKeys, inferSourceLayer, loadCheckResults };
