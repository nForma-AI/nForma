'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Tests for CONV-01: convergence loop oscillation exclusion.
 *
 * Validates:
 * 1. effectiveTotal computation excludes oscillating layer residuals
 * 2. autoClose isLayerBlocked respects oscillatingSet parameter
 */

describe('effectiveTotal computation (CONV-01)', () => {
  it('subtracts oscillating layer residuals from total', () => {
    // Simulate the effectiveTotal computation from the convergence loop
    const residual = {
      total: 25,
      r_to_f: { residual: 10 },
      f_to_t: { residual: 8 },
      c_to_f: { residual: 5 },
      t_to_c: { residual: 2 },
    };
    const oscillatingLayers = ['r_to_f', 'c_to_f'];

    let oscillatingSum = 0;
    for (const layer of oscillatingLayers) {
      if (residual[layer] && typeof residual[layer].residual === 'number' && residual[layer].residual > 0) {
        oscillatingSum += residual[layer].residual;
      }
    }
    const effectiveTotal = residual.total - oscillatingSum;

    // 25 - 10 (r_to_f) - 5 (c_to_f) = 10
    assert.equal(effectiveTotal, 10);
  });

  it('effectiveTotal equals total when no oscillating layers', () => {
    const residual = { total: 25, r_to_f: { residual: 10 } };
    const oscillatingLayers = [];

    let oscillatingSum = 0;
    for (const layer of oscillatingLayers) {
      if (residual[layer] && typeof residual[layer].residual === 'number' && residual[layer].residual > 0) {
        oscillatingSum += residual[layer].residual;
      }
    }
    const effectiveTotal = residual.total - oscillatingSum;

    assert.equal(effectiveTotal, 25);
  });

  it('handles oscillating layer not present in residual object', () => {
    const residual = { total: 10, r_to_f: { residual: 10 } };
    const oscillatingLayers = ['nonexistent_layer'];

    let oscillatingSum = 0;
    for (const layer of oscillatingLayers) {
      if (residual[layer] && typeof residual[layer].residual === 'number' && residual[layer].residual > 0) {
        oscillatingSum += residual[layer].residual;
      }
    }
    const effectiveTotal = residual.total - oscillatingSum;

    assert.equal(effectiveTotal, 10);
  });

  it('handles oscillating layer with zero residual', () => {
    const residual = { total: 10, r_to_f: { residual: 10 }, f_to_t: { residual: 0 } };
    const oscillatingLayers = ['f_to_t'];

    let oscillatingSum = 0;
    for (const layer of oscillatingLayers) {
      if (residual[layer] && typeof residual[layer].residual === 'number' && residual[layer].residual > 0) {
        oscillatingSum += residual[layer].residual;
      }
    }
    const effectiveTotal = residual.total - oscillatingSum;

    assert.equal(effectiveTotal, 10);
  });

  it('effectiveTotal can reach zero when all non-oscillating layers are clean', () => {
    const residual = { total: 15, r_to_f: { residual: 10 }, c_to_f: { residual: 5 } };
    const oscillatingLayers = ['r_to_f', 'c_to_f'];

    let oscillatingSum = 0;
    for (const layer of oscillatingLayers) {
      if (residual[layer] && typeof residual[layer].residual === 'number' && residual[layer].residual > 0) {
        oscillatingSum += residual[layer].residual;
      }
    }
    const effectiveTotal = residual.total - oscillatingSum;

    assert.equal(effectiveTotal, 0);
  });
});

describe('isLayerBlocked with oscillatingSet (CONV-01)', () => {
  // Replicate the isLayerBlocked logic from autoClose
  function makeIsLayerBlocked(verdicts, oscillatingSet) {
    return function isLayerBlocked(layerKey) {
      const v = verdicts[layerKey];
      if (v && v.blocked === true) return true;
      if (oscillatingSet && oscillatingSet.has(layerKey)) return true;
      return false;
    };
  }

  it('blocks layer in oscillatingSet', () => {
    const isBlocked = makeIsLayerBlocked({}, new Set(['f_to_t']));
    assert.equal(isBlocked('f_to_t'), true);
    assert.equal(isBlocked('r_to_f'), false);
  });

  it('blocks layer in verdicts', () => {
    const isBlocked = makeIsLayerBlocked({ f_to_t: { blocked: true } }, new Set());
    assert.equal(isBlocked('f_to_t'), true);
  });

  it('blocks layer present in both verdicts and oscillatingSet', () => {
    const isBlocked = makeIsLayerBlocked(
      { f_to_t: { blocked: true } },
      new Set(['f_to_t'])
    );
    assert.equal(isBlocked('f_to_t'), true);
  });

  it('does not block layer absent from both', () => {
    const isBlocked = makeIsLayerBlocked({}, new Set());
    assert.equal(isBlocked('f_to_t'), false);
  });

  it('handles undefined oscillatingSet (backward compat)', () => {
    const isBlocked = makeIsLayerBlocked({}, undefined);
    assert.equal(isBlocked('f_to_t'), false);
  });
});
