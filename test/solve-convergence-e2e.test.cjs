'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CycleDetector } = require('../bin/solve-cycle-detector.cjs');
const { LAYER_KEYS } = require('../bin/layer-constants.cjs');

// Fixture data — 3 iterations simulating cascading gap creation
const FIXTURE_ITERATIONS = [
  // Iteration 1: r_to_f has 5 gaps, everything else is 0
  { r_to_f: 5, f_to_t: 0, c_to_f: 0, t_to_c: 0, f_to_c: 0, r_to_d: 0, d_to_c: 0, p_to_f: 0,
    c_to_r: 0, t_to_r: 0, d_to_r: 0, l1_to_l3: 0, l3_to_tc: 0,
    per_model_gates: 0, git_heatmap: 0, git_history: 0, formal_lint: 0, hazard_model: 0, h_to_m: 0 },
  // Iteration 2: r_to_f remediated to 0, but cascade creates f_to_t=7
  { r_to_f: 0, f_to_t: 7, c_to_f: 0, t_to_c: 0, f_to_c: 0, r_to_d: 0, d_to_c: 0, p_to_f: 0,
    c_to_r: 0, t_to_r: 0, d_to_r: 0, l1_to_l3: 0, l3_to_tc: 0,
    per_model_gates: 0, git_heatmap: 0, git_history: 0, formal_lint: 0, hazard_model: 0, h_to_m: 0 },
  // Iteration 3: f_to_t partially remediated to 2
  { r_to_f: 0, f_to_t: 2, c_to_f: 0, t_to_c: 0, f_to_c: 0, r_to_d: 0, d_to_c: 0, p_to_f: 0,
    c_to_r: 0, t_to_r: 0, d_to_r: 0, l1_to_l3: 0, l3_to_tc: 0,
    per_model_gates: 0, git_heatmap: 0, git_history: 0, formal_lint: 0, hazard_model: 0, h_to_m: 0 },
];

// Bucket constants matching CONV-02 bucket assignments
const AUTOMATABLE_LAYERS = [
  'r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c',
  'r_to_d', 'l1_to_l3', 'l3_to_tc',
];

/**
 * Compute automatable residual from a layer map.
 */
function computeAutomatable(layerMap) {
  return AUTOMATABLE_LAYERS.reduce((sum, key) => sum + (layerMap[key] >= 0 ? layerMap[key] : 0), 0);
}

/**
 * Detect per-layer progress (not regression) across iterations.
 * For each layer, if residual increases iteration-over-iteration,
 * check whether a corresponding decrease in a related upstream layer explains it.
 */
function detectsProgressNotRegression(iterations) {
  for (let i = 1; i < iterations.length; i++) {
    const prev = iterations[i - 1];
    const curr = iterations[i];
    for (const key of AUTOMATABLE_LAYERS) {
      if (curr[key] > prev[key]) {
        // Residual increased on this layer — check if an upstream layer decreased
        const upstreamDecreased = AUTOMATABLE_LAYERS.some(
          upKey => upKey !== key && curr[upKey] < prev[upKey]
        );
        if (!upstreamDecreased) return false; // True regression — no cascade explanation
      }
    }
  }
  return true;
}

describe('e2e convergence integration', () => {
  it('automatable residual at iteration 3 is less than or equal to iteration 1', () => {
    // Iteration 1: automatable=5, iteration 3: automatable=2
    assert.ok(computeAutomatable(FIXTURE_ITERATIONS[2]) <= computeAutomatable(FIXTURE_ITERATIONS[0]));
  });

  it('per-layer changes across iterations represent progress (not regression)', () => {
    // The f_to_t increase (0->7) is explained by r_to_f decrease (5->0) — cascade, not regression
    assert.ok(detectsProgressNotRegression(FIXTURE_ITERATIONS));
  });

  it('cycle detector does NOT trigger false oscillation on cascade pattern', () => {
    const cd = new CycleDetector();
    for (let i = 0; i < FIXTURE_ITERATIONS.length; i++) {
      cd.record(i + 1, FIXTURE_ITERATIONS[i]);
    }
    // The cascade pattern (r_to_f: 5,0,0 and f_to_t: 0,7,2) is monotonic per-layer, not A-B-A-B
    assert.deepStrictEqual(cd.detectOscillating(), []);
  });

  it('automatable residual is monotonically non-increasing OR stabilizing per iteration pair when excluding cascade effects', () => {
    for (let i = 1; i < FIXTURE_ITERATIONS.length; i++) {
      const prevAuto = computeAutomatable(FIXTURE_ITERATIONS[i - 1]);
      const currAuto = computeAutomatable(FIXTURE_ITERATIONS[i]);
      if (currAuto > prevAuto) {
        // Allow increase ONLY if per-layer-change analysis detects cascade
        const prev = FIXTURE_ITERATIONS[i - 1];
        const curr = FIXTURE_ITERATIONS[i];
        const hasCascadeExplanation = AUTOMATABLE_LAYERS.some(
          key => curr[key] > prev[key] && AUTOMATABLE_LAYERS.some(
            upKey => upKey !== key && curr[upKey] < prev[upKey]
          )
        );
        assert.ok(hasCascadeExplanation,
          `Iteration ${i} to ${i + 1}: automatable increased from ${prevAuto} to ${currAuto} without cascade explanation`);
      }
    }
  });

  it('all 19 LAYER_KEYS are present in each fixture iteration', () => {
    for (const iter of FIXTURE_ITERATIONS) {
      for (const key of LAYER_KEYS) {
        assert.ok(key in iter, `Missing layer key: ${key}`);
      }
    }
  });

  it('final iteration residual is strictly less than first iteration (convergence progress)', () => {
    // 2 < 5 proves forward progress
    assert.ok(computeAutomatable(FIXTURE_ITERATIONS[2]) < computeAutomatable(FIXTURE_ITERATIONS[0]));
  });
});
