---
phase: quick-317
plan: 01
subsystem: solve
tags: [proximity-index, BFS, haiku-classification, false-positive-reduction]

requires:
  - phase: quick-314
    provides: proximity-index pipeline and stats reader
provides:
  - proximityPreFilter function in nf-solve.cjs for suppressing reverse-scanner FPs via proximity graph
  - Haiku classification prompt enrichment with nearest-requirement context
affects: [solve-classify, solve-tui, nf-solve]

tech-stack:
  added: []
  patterns: [proximity-based pre-filter with BFS depth-2 requirement reachability]

key-files:
  created: []
  modified:
    - bin/nf-solve.cjs
    - bin/solve-tui.cjs
    - commands/nf/solve-classify.md

key-decisions:
  - "Claims (D->R) skip proximity filter since doc claims have no code_file nodes in proximity graph"
  - "sweepTtoR orphan_tests converted from string[] to object[] ({file, nearest_req?, proximity_context?}) for proximity enrichment"
  - "BFS depth 2 for requirement suppression, depth 3 for broader context attachment"

patterns-established:
  - "Proximity pre-filter pattern: fail-open BFS lookup before classification loop"

requirements-completed: [SOLVE-FP]

duration: 8min
completed: 2026-03-16
---

# Quick 317: Proximity Pre-filter for Reverse Scanners Summary

**BFS depth-2 proximity pre-filter suppresses reverse-scanner items reachable to requirements before Haiku classification, with nearest-req context enrichment for remaining items**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T18:49:38Z
- **Completed:** 2026-03-16T18:57:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `proximityPreFilter()` function to nf-solve.cjs that uses BFS depth-2 reachability in proximity-index.json to auto-suppress reverse-scanner items covered by nearby requirements
- Wired pre-filter into `assembleReverseCandidates()` between acknowledged filter and classification loop, adding `proximity_suppressed` count to return value
- Enriched sweepCtoR and sweepTtoR detail items with `nearest_req` and `proximity_context` fields from proximity graph
- Updated Haiku classification prompt in solve-tui.cjs to include nearest-requirement context for ctor/ttor items, improving classification accuracy
- Updated solve-classify.md objective to document proximity context usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Add proximityPreFilter to nf-solve.cjs and wire into assembleReverseCandidates** - `18d5fb32` (feat)
2. **Task 2: Enrich Haiku classification prompt with nearest-requirement context** - `07851ebd` (feat)

## Files Created/Modified
- `bin/nf-solve.cjs` - Added proximityPreFilter function, wired into assembleReverseCandidates, enriched sweep detail items with proximity data, exported new function
- `bin/solve-tui.cjs` - loadSweepData passes through nearest_req/proximity_context; classifyWithHaiku prompt lines and category descriptions include proximity context
- `commands/nf/solve-classify.md` - Updated objective to mention proximity-index context usage

## Decisions Made
- Claims (D->R) skip proximity filter since doc claims lack code_file nodes in the proximity graph
- sweepTtoR orphan_tests converted from plain strings to objects ({file, nearest_req?, proximity_context?}) with backward-compatible handling in assembleReverseCandidates
- BFS depth 2 for requirement suppression threshold, depth 3 for broader context attachment on non-suppressed items

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sweepTtoR orphan format change required backward-compatible handling**
- **Found during:** Task 1
- **Issue:** sweepTtoR previously returned orphan_tests as string[], but proximity enrichment requires object[]. assembleReverseCandidates and loadSweepData both consumed the old format.
- **Fix:** Added `typeof` checks in assembleReverseCandidates T->R gathering and loadSweepData ttor mapping to handle both string and object formats
- **Files modified:** bin/nf-solve.cjs, bin/solve-tui.cjs
- **Verification:** loadSweepData runs without error, assembleReverseCandidates handles both formats
- **Committed in:** 18d5fb32 (Task 1), 07851ebd (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Backward-compatible format handling was necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing lint-isolation violation in solve-report.md (portable-require) causes `npm test` to fail; confirmed pre-existing, not caused by this task's changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Proximity pre-filter is active and will suppress items automatically when proximity-index.json contains relevant code_file nodes
- Haiku classification accuracy should improve for items with proximity context

---
*Phase: quick-317*
*Completed: 2026-03-16*
