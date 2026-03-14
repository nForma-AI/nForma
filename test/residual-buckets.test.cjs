'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// The LAYER_KEYS constant defines the canonical 19 layers
const { LAYER_KEYS } = require('../bin/layer-constants.cjs');

// Define the bucket assignments matching the CONV-02 design spec
const AUTOMATABLE_LAYERS = [
  'r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c',
  'r_to_d', 'l1_to_l3', 'l3_to_tc',
];

const MANUAL_LAYERS = [
  'd_to_c', 'c_to_r', 't_to_r', 'd_to_r',
];

const INFORMATIONAL_LAYERS = [
  'git_heatmap', 'git_history', 'formal_lint', 'hazard_model',
  'per_model_gates', 'p_to_f',
];

describe('residual buckets design spec', () => {
  it('automatable bucket has 8 layers', () => {
    assert.equal(AUTOMATABLE_LAYERS.length, 8);
  });

  it('manual bucket has 4 layers', () => {
    assert.equal(MANUAL_LAYERS.length, 4);
  });

  it('informational bucket has 6 layers', () => {
    assert.equal(INFORMATIONAL_LAYERS.length, 6);
  });

  it('all 18 layers are accounted for in the three buckets', () => {
    const allBucketLayers = [
      ...AUTOMATABLE_LAYERS,
      ...MANUAL_LAYERS,
      ...INFORMATIONAL_LAYERS,
    ].sort();
    assert.deepStrictEqual(allBucketLayers, [...LAYER_KEYS].sort());
  });

  it('no layer appears in multiple buckets', () => {
    const all = [...AUTOMATABLE_LAYERS, ...MANUAL_LAYERS, ...INFORMATIONAL_LAYERS];
    const unique = new Set(all);
    assert.equal(unique.size, all.length, 'Duplicate layer found across buckets');
  });
});

describe('computeResidual bucket fields', () => {
  // computeResidual() requires the full project environment.
  // We call it in report-only mode and verify the returned object structure.
  let residual;

  it('computeResidual() returns automatable, manual, informational fields', () => {
    // require nf-solve.cjs — this triggers module init (sets ROOT, etc.)
    const solve = require('../bin/nf-solve.cjs');
    residual = solve.computeResidual();

    assert.equal(typeof residual.automatable, 'number', 'automatable must be a number');
    assert.equal(typeof residual.manual, 'number', 'manual must be a number');
    assert.equal(typeof residual.informational, 'number', 'informational must be a number');
    assert.ok(residual.automatable >= 0, 'automatable must be >= 0');
    assert.ok(residual.manual >= 0, 'manual must be >= 0');
    assert.ok(residual.informational >= 0, 'informational must be >= 0');
  });

  it('bucket sums account for all 19 layers', () => {
    if (!residual) return; // skip if previous test failed

    // Sum each layer residual (clamped to 0 for -1/skipped)
    let layerSum = 0;
    for (const key of LAYER_KEYS) {
      if (residual[key] && typeof residual[key].residual === 'number') {
        layerSum += residual[key].residual >= 0 ? residual[key].residual : 0;
      }
    }

    const bucketSum = residual.automatable + residual.manual + residual.informational;
    assert.equal(bucketSum, layerSum,
      'automatable + manual + informational should equal sum of all 19 layer residuals');
  });
});
