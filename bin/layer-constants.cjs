'use strict';

/**
 * Canonical 19-layer key array — single source of truth.
 * All layer-iteration consumers MUST import from this module.
 * @see STRUCT-02
 */
const LAYER_KEYS = [
  'r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c',
  'r_to_d', 'd_to_c', 'p_to_f', 'c_to_r', 't_to_r',
  'd_to_r', 'l1_to_l2', 'l2_to_l3', 'l3_to_tc',
  'per_model_gates', 'git_heatmap', 'git_history',
  'formal_lint', 'hazard_model',
];

module.exports = { LAYER_KEYS };
