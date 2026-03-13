---
phase: quick-276
plan: 01
subsystem: proximity-pipeline
tags: [candidate-discovery, non-neighbor-pairs, coverage-gap-heuristic]
type: feature
completed_date: 2026-03-12
completed_duration_minutes: 15
dependency_graph:
  requires: []
  provides: [non-neighbor-pair-discovery, coverage-gap-ranking]
  affects: [nf:proximity-skill, candidate-discovery]
tech_stack:
  added: []
  patterns: [coverage-gap-heuristic, zero-path-pair-ranking]
key_files:
  created: []
  modified:
    - bin/candidate-discovery.cjs
    - commands/nf/proximity.md
decisions: []
metrics:
  tasks_completed: 2
  deviations_found: 0
---

# Quick Task 276: Add top-N non-neighboring pair discovery to nf:proximity pipeline

## Objective

Add top-N non-neighboring pair discovery to the proximity pipeline. Previously, candidate-discovery.cjs only found pairs reachable via BFS (proximity_score > threshold). Pairs with no graph path (score = 0) were invisible. This implementation surfaces the top N zero-path pairs ranked by a coverage-gap heuristic that identifies which models and requirements are most under-covered.

## One-liner

Added non-neighbor discovery with coverage-gap heuristic to candidate-discovery.cjs, ranked zero-path pairs by model/requirement coverage gaps, integrated --non-neighbor-top flag throughout proximity pipeline.

## Tasks Completed

### Task 1: Add non-neighbor discovery to candidate-discovery.cjs

**Files modified:** bin/candidate-discovery.cjs

**Changes:**
- Updated `discoverCandidates()` function signature to accept `nonNeighborTop` option (default: 20)
- Added `source: 'graph'` field to all BFS-discovered candidates (lines ~73)
- Implemented zero-pair collection during BFS loop: tracks (modelPath, reqId) pairs where proximity() returns 0 or NaN
- Implemented coverage-gap heuristic ranking:
  - Pre-computed `reqModelCount` Map to avoid O(N*M) scanning
  - For each zero pair, computed priority = 1/(modelCoverage+1) + 1/(reqCoverage+1)
  - modelCoverage = linkedReqs count + BFS candidates for that model
  - reqCoverage = models referencing the req + BFS candidates for that req
- Added guard clause: if `nonNeighborTop <= 0`, skip zero-pair collection entirely
- Added deduplication check before pushing non-neighbor candidates to prevent duplicates
- Updated metadata to include `non_neighbor_count` and `non_neighbor_top` fields
- Updated `parseArgs()` to parse `--non-neighbor-top` flag (default: 20)
- Updated `printHelp()` with new flag documentation
- Updated `main()` to pass `nonNeighborTop` to `discoverCandidates()` and log non-neighbor count
- Updated histogram generation to include `'non_neighbor'` bucket label (distinct from 0.6-1.0 graph buckets)
- Updated JSDoc for `discoverCandidates()` to document the new `nonNeighborTop` parameter and `source` field

**Verification:**
- `node bin/candidate-discovery.cjs --help` shows `--non-neighbor-top` flag
- `node bin/candidate-discovery.cjs --json --non-neighbor-top 5` produces candidates with:
  - Graph candidates: `source: 'graph'` with `proximity_score > 0`
  - Non-neighbor candidates: `source: 'non_neighbor'` with `proximity_score: 0.0`
- Metadata includes `non_neighbor_count: 5` and `non_neighbor_top: 5`

### Task 2: Update proximity.md skill to pass and display non-neighbor flag

**Files modified:** commands/nf/proximity.md

**Changes:**
- Updated frontmatter `argument-hint` to include `[--non-neighbor-top N]`
- Updated Step 1 documentation to describe `--non-neighbor-top` flag extraction (default: 20)
- Updated Step 3 (Discover candidates):
  - Added `--non-neighbor-top <val>` to the command invocation
  - Updated display to show breakdown: "Found N graph candidates + M non-neighbor candidates"
  - Added line "Non-neighbor pairs ranked by coverage gap (top <non_neighbor_top>)" when count > 0
- Updated Step 7 (Summary dashboard) to show candidate breakdown: `C total (G graph + N non-neighbor)`
- Updated Notes section to document the `--non-neighbor-top` flag behavior and how to disable non-neighbor discovery

**Verification:**
- `grep -c "non-neighbor-top" commands/nf/proximity.md` returns 5 matches
- argument-hint includes the flag
- Step 1 documents extraction
- Step 3 mentions passing the flag and display logic
- Step 7 shows breakdown format in summary table
- Notes section documents the flag

## Success Criteria

- [x] candidate-discovery.cjs accepts `--non-neighbor-top` flag with default 20
- [x] Zero-path pairs ranked by coverage-gap heuristic and included in output
- [x] Non-neighbor candidates have `source: 'non_neighbor'` and `proximity_score: 0.0`
- [x] BFS candidates tagged with `source: 'graph'`
- [x] Metadata includes `non_neighbor_count` and `non_neighbor_top` fields
- [x] proximity.md Step 3 displays non-neighbor discovery count
- [x] proximity.md passes `--non-neighbor-top` flag through to script
- [x] No regression in existing BFS candidate discovery

## Deviations from Plan

None — plan executed exactly as written.

## Architecture Notes

The implementation follows the specified coverage-gap heuristic:
- **Defensive deduplication:** Pairs already found by BFS are filtered from zero-pairs before ranking
- **Pre-computation:** reqModelCount is computed once before ranking to avoid quadratic complexity
- **Guard clause:** Setting `--non-neighbor-top 0` disables the entire non-neighbor discovery feature
- **Histogram split:** Non-neighbor candidates appear as separate `'non_neighbor'` bucket in histogram output, not grouped with 0.6-1.0 graph candidates

The proximity.md skill integrates seamlessly:
- Parses the new flag like existing flags (--min-score, --max-hops)
- Passes it through to the script unchanged
- Displays breakdown in both Step 3 progress and Step 7 summary dashboard
