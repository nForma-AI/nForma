'use strict';
const assert = require('assert');
const { LAYER_KEYS } = require('./layer-constants.cjs');

// Verify count (19 keys after h_to_m addition — STRUCT-01)
assert.strictEqual(LAYER_KEYS.length, 19, 'LAYER_KEYS must have exactly 19 entries');

// Verify key set matches canonical list
const expected = [
  'r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c',
  'r_to_d', 'd_to_c', 'p_to_f', 'c_to_r', 't_to_r',
  'd_to_r', 'l1_to_l3', 'l3_to_tc',
  'per_model_gates', 'git_heatmap', 'git_history',
  'formal_lint', 'hazard_model', 'h_to_m',
];
assert.deepStrictEqual(LAYER_KEYS, expected, 'LAYER_KEYS must match canonical order');

// Verify no duplicates
assert.strictEqual(new Set(LAYER_KEYS).size, 19, 'No duplicate keys');

// Verify array is not accidentally frozen/mutable in a way that breaks consumers
assert.ok(Array.isArray(LAYER_KEYS), 'LAYER_KEYS is an array');

console.log('layer-constants.test.cjs: all assertions passed');
