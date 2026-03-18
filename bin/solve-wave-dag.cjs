'use strict';

/**
 * solve-wave-dag.cjs — Dependency DAG and wave computation for remediation dispatch.
 *
 * Computes dependency-ordered wave groupings so independent layers within each
 * wave can run in parallel (up to 3 concurrent agents per RAM budget).
 * Sequential chains (single-layer waves in succession) are compacted into one
 * wave with a `sequential: true` flag to keep total wave count <= 6.
 *
 * @see PERF-01
 */

/**
 * Layer dependency adjacency list.
 * Each key maps to an array of layer keys it depends on.
 *
 * Note: Uses l1_to_l3 (not l1_to_l2/l2_to_l3) per STRUCT-01 collapse.
 */
const LAYER_DEPS = {
  r_to_f:          [],
  r_to_d:          [],
  t_to_c:          [],
  p_to_f:          [],
  f_to_t:          ['r_to_f'],
  c_to_f:          ['t_to_c'],
  f_to_c:          ['f_to_t', 'c_to_f'],
  d_to_c:          [],
  git_heatmap:     [],
  c_to_r:          ['r_to_f', 'r_to_d', 'f_to_t', 't_to_c', 'c_to_f', 'f_to_c', 'd_to_c', 'git_heatmap', 'p_to_f'],
  t_to_r:          ['r_to_f', 'r_to_d', 'f_to_t', 't_to_c', 'c_to_f', 'f_to_c', 'd_to_c', 'git_heatmap', 'p_to_f'],
  d_to_r:          ['r_to_f', 'r_to_d', 'f_to_t', 't_to_c', 'c_to_f', 'f_to_c', 'd_to_c', 'git_heatmap', 'p_to_f'],
  hazard_model:    ['c_to_r', 't_to_r', 'd_to_r'],
  l1_to_l3:        ['hazard_model'],
  l3_to_tc:        ['l1_to_l3'],
  per_model_gates: ['l1_to_l3', 'l3_to_tc'],
  h_to_m: [],  // No dependencies — hypothesis measurement is independent
  b_to_f: ['t_to_c'],  // Depends on test-to-code traceability for requirement lineage
};

const MAX_PER_WAVE = 3;

/**
 * Return the dependency list for a single layer key.
 * @param {string} layerKey
 * @returns {string[]}
 */
function getLayerDeps(layerKey) {
  return LAYER_DEPS[layerKey] || [];
}

/**
 * Compute wave groupings from a residual vector.
 *
 * Algorithm:
 * 1. Filter to layers with residual > 0
 * 2. Topological sort (longest-path assignment for correct wave ordering)
 * 3. Group by wave number
 * 4. Split large waves into sub-waves of MAX_PER_WAVE
 * 5. Compact trailing sequential chains (consecutive single-layer waves) into
 *    one wave with sequential:true to keep total wave count bounded
 *
 * @param {Object} residualVector — keys are layer names, values are objects
 *   with at least a `residual` property. Layers with residual <= 0 are skipped.
 * @param {Object} [priorityWeights={}] — optional { [layerKey]: number } for
 *   hypothesis-driven intra-wave ordering. Layers with higher weight appear first
 *   within their wave. Does NOT change wave assignment (topology preserved).
 * @returns {Array<{wave: number, layers: string[], sequential?: boolean}>}
 */
function computeWaves(residualVector, priorityWeights = {}) {
  // Filter to active layers (residual > 0)
  const active = new Set();
  for (const [key, val] of Object.entries(residualVector)) {
    if (val && typeof val === 'object' && val.residual > 0 && LAYER_DEPS.hasOwnProperty(key)) {
      active.add(key);
    }
  }

  if (active.size === 0) return [];

  // Compute longest-path wave assignment (ensures correct ordering)
  const waveAssignment = new Map();

  function getWave(layer) {
    if (waveAssignment.has(layer)) return waveAssignment.get(layer);
    const deps = (LAYER_DEPS[layer] || []).filter(d => active.has(d));
    if (deps.length === 0) {
      waveAssignment.set(layer, 0);
      return 0;
    }
    const maxDepWave = Math.max(...deps.map(d => getWave(d)));
    const w = maxDepWave + 1;
    waveAssignment.set(layer, w);
    return w;
  }

  for (const layer of active) {
    getWave(layer);
  }

  // Group by wave number
  const waveGroups = new Map();
  for (const [layer, waveNum] of waveAssignment.entries()) {
    if (!waveGroups.has(waveNum)) waveGroups.set(waveNum, []);
    waveGroups.get(waveNum).push(layer);
  }

  // Build raw waves with MAX_PER_WAVE splits
  const sortedWaveNums = [...waveGroups.keys()].sort((a, b) => a - b);
  const rawWaves = [];

  for (const waveNum of sortedWaveNums) {
    const layers = waveGroups.get(waveNum).sort((a, b) =>
      (priorityWeights[b] || 0) - (priorityWeights[a] || 0) || a.localeCompare(b)
    ); // priority weight descending, then alphabetical tiebreaker
    for (let i = 0; i < layers.length; i += MAX_PER_WAVE) {
      const chunk = layers.slice(i, i + MAX_PER_WAVE);
      rawWaves.push({ layers: chunk });
    }
  }

  // Compact: merge consecutive single-layer waves at the tail into one
  // sequential wave. This collapses chains like hazard -> l1_to_l3 -> l3_to_tc -> per_model_gates.
  const result = [];
  let i = 0;
  while (i < rawWaves.length) {
    // Look ahead for a run of consecutive single-layer waves (2+ in a row)
    if (rawWaves[i].layers.length === 1) {
      let runEnd = i;
      while (runEnd + 1 < rawWaves.length && rawWaves[runEnd + 1].layers.length === 1) {
        runEnd++;
      }
      if (runEnd > i) {
        // Merge the run into one sequential wave
        const merged = [];
        for (let j = i; j <= runEnd; j++) {
          merged.push(...rawWaves[j].layers);
        }
        result.push({ wave: result.length + 1, layers: merged, sequential: true });
        i = runEnd + 1;
        continue;
      }
    }
    result.push({ wave: result.length + 1, layers: rawWaves[i].layers });
    i++;
  }

  return result;
}

// CLI mode
if (require.main === module) {
  console.log('=== Layer Dependency DAG ===\n');
  for (const [key, deps] of Object.entries(LAYER_DEPS)) {
    console.log(`  ${key}: ${deps.length === 0 ? '(root)' : deps.join(', ')}`);
  }

  // Sample wave grouping with all layers active
  const allActive = {};
  for (const key of Object.keys(LAYER_DEPS)) {
    allActive[key] = { residual: 1 };
  }
  const waves = computeWaves(allActive);

  console.log('\n=== Wave Grouping (all layers active) ===\n');
  for (const w of waves) {
    const seq = w.sequential ? ' [sequential]' : '';
    console.log(`  Wave ${w.wave}: ${w.layers.join(', ')}${seq}`);
  }
  console.log(`\n  Total: ${waves.length} waves`);
}

module.exports = { computeWaves, getLayerDeps, LAYER_DEPS, MAX_PER_WAVE };
