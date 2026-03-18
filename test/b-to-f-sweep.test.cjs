'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { LAYER_KEYS } = require('../bin/layer-constants.cjs');
const { LAYER_DEPS, computeWaves } = require('../bin/solve-wave-dag.cjs');

describe('BTF-01: b_to_f layer registration', () => {
  it('LAYER_KEYS contains b_to_f', () => {
    assert.ok(LAYER_KEYS.includes('b_to_f'), 'b_to_f should be in LAYER_KEYS');
  });

  it('LAYER_KEYS has exactly 20 entries', () => {
    assert.equal(LAYER_KEYS.length, 20, `Expected 20 layer keys, got ${LAYER_KEYS.length}`);
  });

  it('b_to_f is at index 19', () => {
    assert.equal(LAYER_KEYS[19], 'b_to_f', `Expected LAYER_KEYS[19] to be b_to_f, got ${LAYER_KEYS[19]}`);
  });
});

describe('BTF-02: b_to_f wave DAG integration', () => {
  it('LAYER_DEPS has b_to_f entry', () => {
    assert.ok(LAYER_DEPS.b_to_f !== undefined, 'LAYER_DEPS should have b_to_f entry');
  });

  it('b_to_f depends on t_to_c', () => {
    assert.deepEqual(LAYER_DEPS.b_to_f, ['t_to_c'], 'b_to_f should depend on t_to_c only');
  });

  it('computeWaves places b_to_f after t_to_c in execution order', () => {
    const residualVector = {
      t_to_c: { residual: 1 },
      b_to_f: { residual: 1 },
    };
    const waves = computeWaves(residualVector);

    // With only these 2 layers active, compaction may merge them into a
    // single sequential wave. Verify b_to_f appears AFTER t_to_c in the
    // flattened execution order (either in a later wave or later in a
    // sequential wave's layers array).
    const flatOrder = [];
    for (const w of waves) {
      for (const layer of w.layers) {
        flatOrder.push(layer);
      }
    }

    const t_to_c_idx = flatOrder.indexOf('t_to_c');
    const b_to_f_idx = flatOrder.indexOf('b_to_f');

    assert.ok(t_to_c_idx >= 0, 't_to_c should be in the wave plan');
    assert.ok(b_to_f_idx >= 0, 'b_to_f should be in the wave plan');
    assert.ok(b_to_f_idx > t_to_c_idx, `b_to_f (index ${b_to_f_idx}) should execute after t_to_c (index ${t_to_c_idx})`);
  });
});
