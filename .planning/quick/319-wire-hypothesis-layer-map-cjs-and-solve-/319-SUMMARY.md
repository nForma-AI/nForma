---
phase: quick-319
plan: 01
subsystem: solve-loop
tags: [hypothesis-targeting, wave-ordering, autoClose, dispatch-map]
dependency_graph:
  requires: [hypothesis-layer-map.cjs, solve-wave-dag.cjs]
  provides: [hypothesis-driven-wave-dispatch]
  affects: [nf-solve.cjs, nf-solve.test.cjs]
tech_stack:
  added: []
  patterns: [dispatch-map, wave-iteration, fail-open]
key_files:
  created: []
  modified:
    - bin/nf-solve.cjs
    - bin/nf-solve.test.cjs
decisions:
  - Extracted 9 layer handlers into LAYER_HANDLERS dispatch map for wave-aware iteration
  - DEFAULT_WAVES preserves original hardcoded if-chain sequence for backward compatibility
  - Wave ordering is fail-open -- hypothesis module errors fall back to default order
metrics:
  duration: ~10min
  completed: 2026-03-17
---

# Quick 319: Wire hypothesis-layer-map.cjs and solve-wave-dag.cjs into nf-solve.cjs Summary

LAYER_HANDLERS dispatch map with wave-aware iteration replacing sequential if-chain in autoClose, fed by hypothesis-driven computeWaves at solve loop call site.

## What Changed

### Task 1: Refactor autoClose to dispatch map with waveOrder parameter

- Added `require()` for `hypothesis-layer-map.cjs` and `solve-wave-dag.cjs`
- Refactored `autoClose(residual, oscillatingSet, waveOrder)` to accept optional `waveOrder` parameter
- Extracted 9 layer handlers (`f_to_t`, `c_to_f`, `t_to_c`, `r_to_f`, `f_to_c`, `r_to_d`, `d_to_c`, `p_to_f`, `per_model_gates`) into `LAYER_HANDLERS` dispatch map
- Added `DEFAULT_WAVES` constant matching original if-chain sequence for backward compatibility
- Wave-aware dispatch loop iterates wave objects, skipping unknown layer keys silently
- Cross-cutting concerns (TLA+ config, formal_lint, evidence readiness) remain outside dispatch map
- Wired solve loop call site: `computeWaves(residual, priorityWeights)` produces `waveOrder` passed to `autoClose`
- Wave ordering logged to stderr with wave count and transition info
- `wave_order` stored in iteration records for JSON output
- Commit: `ffa3025a`

### Task 2: Add TC-HTARGET tests

- TC-HTARGET-1: Backward compatibility -- autoClose without waveOrder returns expected shape
- TC-HTARGET-2: Wave dispatch order -- proves waveOrder controls action ordering (the critical behavioral test)
- TC-HTARGET-3: Unknown layer keys -- graceful skip without crash
- TC-HTARGET-4: computeWaves + computeLayerPriorityWeights integration -- end-to-end wave structure validation
- All 4 tests pass; existing tests unaffected
- Commit: `bcea6899`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `LAYER_HANDLERS` grep: 3 matches (definition, comment, usage)
2. `DEFAULT_WAVES` grep: 3 matches (docstring, definition, usage)
3. `waveOrder` grep: 7 matches (docstring, signature, dispatch, call site x4)
4. `hypothesis-layer-map` grep: 1 match (require line)
5. `solve-wave-dag` grep: 2 matches (require line, exclusion pattern)
6. `wave_order` grep: 1 match (iteration record)
7. TC-HTARGET tests: 4/4 pass
8. Existing tests (TC-HEALTH, TC-FORMAT, TC-JSON): 14/14 pass
9. Import check: `require('./bin/nf-solve.cjs')` succeeds
