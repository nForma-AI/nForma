---
phase: quick-277
plan: 01
subsystem: proximity-pipeline
tags: [false-positive-reduction, proximity-scoring, keyword-filtering, category-gating]

requires: []
provides:
  - Type-aware hop penalty in proximity BFS scoring (0.5x for structural hubs)
  - Category-domain gating in candidate discovery
  - Already-covered requirement threshold (0.95) enforcement
  - Keyword pre-screen filtering (auto-reject zero overlap)
affects:
  - nf:proximity workflow
  - formal verification pipeline
  - haiku false positive reduction strategy

tech-stack:
  added: []
  patterns:
    - Multi-layer false positive filtering (graph pre-filter + scoring penalty + keyword screen)
    - Type-aware graph traversal penalties
    - Coverage-gap heuristic for non-neighbor discovery

key-files:
  created: []
  modified:
    - bin/formal-proximity.cjs
    - bin/candidate-discovery.cjs

key-decisions:
  - "Type-aware hop penalty targets formal_model hubs via structural edges (contains, in_file, owned_by, owns), applying 0.5x multiplier only to intermediate hops"
  - "All three pre-filters apply only to graph-sourced candidates; non-neighbor candidates bypass filters entirely"
  - "Keyword pre-screen reads model files synchronously (acceptable for offline batch processing)"
  - "Category-domain gating requires score > 0.95 to cross domain boundaries, already-covered requires same threshold"

requirements-completed: []

duration: 15min
completed: 2026-03-12
---

# Quick Task 277: Option C - Multi-layer False Positive Reduction for Proximity Pipeline

**Type-aware hop penalty (0.5x for formal_model hubs via structural edges) + three-layer pre-filtering (category-domain gating, already-covered threshold, keyword pre-screen) reduces false positive rate by deflating inflated scores and auto-rejecting semantic mismatches before expensive Haiku evaluation**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-03-12
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Task 1:** Implemented type-aware hop penalty in proximity BFS scoring that deflates scores accumulated through generic formal_model hub nodes via directory containment edges (0.5x multiplier for contains/in_file/owned_by/owns relationships)
- **Task 2:** Added three-layer pre-filtering system to candidate discovery:
  1. Category-domain gating: rejects cross-domain candidates unless score > 0.95
  2. Already-covered requirement check: raises threshold to 0.95 for requirements with existing formal_models
  3. Keyword pre-screen: auto-rejects candidates with zero keyword overlap between model content and requirement text
- All filters apply only to graph-sourced candidates; non-neighbor candidates unaffected
- Metadata now includes `candidates_filtered` count for transparency

## Task Commits

1. **Task 1 & 2: Add type-aware hop penalty and three-layer false positive reduction** - `f42636a3`

## Files Created/Modified

- `bin/formal-proximity.cjs` - Added type-aware hop penalty with 0.5x multiplier for structural edges through formal_model hubs
- `bin/candidate-discovery.cjs` - Added keywordOverlap() function and three pre-filter layers with category-domain gating, already-covered checks, and keyword matching

## Decisions Made

- **Hub penalty scope:** Penalty applies only to intermediate hops (edge.to !== nodeKeyB), not the final target node, to preserve direct connections while deflating weak multi-hop paths
- **Filter scope:** All three pre-filters apply only to graph-sourced candidates (score > threshold), not non-neighbor zero-path pairs, because non-neighbor pairs are valuable coverage-gap indicators and should never be auto-rejected
- **Threshold values:** Both category-domain and already-covered filters use the same 0.95 threshold to provide a clear enforcement level for high-confidence candidates
- **Keyword pre-screen placement:** Runs after category-domain and already-covered checks to minimize file I/O, but still catches semantic mismatches before adding to candidates list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation executed cleanly with all verification tests passing.

## Verification Performed

1. **formal-proximity.cjs syntax check:** Module loads without errors
2. **Exports verification:** buildIndex, proximity, EDGE_WEIGHTS, REVERSE_RELS all exported correctly
3. **Proximity scoring:** Penalty applied correctly to intermediate hops through formal_model nodes
4. **candidate-discovery.cjs syntax check:** Module loads without errors
5. **Exports verification:** discoverCandidates exported correctly
6. **Full pipeline run:** `node bin/candidate-discovery.cjs --json --top 10`
   - Pre-filter removed 2 candidates (cross-domain, already-covered, or keyword mismatch)
   - Non-neighbor candidates still present (20 added)
   - Metadata includes candidates_filtered: 2 field
   - Score histogram correct
   - No crashes or warnings

## End State

- Proximity pipeline now has three-layer false positive defense
- Graph-sourced candidates are pre-filtered before scoring and after keyword analysis
- Non-neighbor pairs remain unfiltered (high-value coverage gaps)
- Type-aware hop penalty deflates inflated multi-hop paths through generic hubs
- Ready for re-evaluation of false positive rate against Haiku semantic eval

---

*Quick Task: 277*
*Completed: 2026-03-12*
