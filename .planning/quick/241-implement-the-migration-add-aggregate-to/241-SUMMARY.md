---
phase: quick-241
plan: 01
subsystem: gates
tags: [gate-scoring, aggregate, migration, formal-verification]

requires:
  - phase: quick-236
    provides: evidence files wired into gate promotion pipeline
provides:
  - unified --aggregate mode in compute-per-model-gates.cjs producing continuous 0-1 gate scores
  - all gate consumers migrated to single aggregation path
  - six redundant global gate scripts deleted
affects: [nf-solve, cross-layer-dashboard, run-formal-verify, formal-gates]

tech-stack:
  added: []
  patterns: [memoized-aggregate-loader, testable-function-export]

key-files:
  created:
    - bin/compute-per-model-gates.test.cjs
  modified:
    - bin/compute-per-model-gates.cjs
    - bin/nf-solve.cjs
    - bin/cross-layer-dashboard.cjs
    - bin/run-formal-verify.cjs

key-decisions:
  - "Mapped failing gate A models to model_gap category in unexplained_counts (semantically accurate)"
  - "Retained .planning/formal/gates/ directory for aggregate JSON file output (backward compat for cached dashboard)"
  - "Replaced 4 pipeline entries in run-formal-verify with single unified entry"
  - "Memoized aggregate loader in nf-solve.cjs so 3 sweep functions share one spawn"

patterns-established:
  - "Aggregate gate scoring via compute-per-model-gates.cjs --aggregate --json"
  - "Testable function export pattern: computeAggregate() with require.main guard"

requirements-completed: [GATE-01, GATE-02, GATE-03, GATE-04]

duration: 6min
completed: 2026-03-09
---

# Quick 241: Gate Migration Summary

**Unified gate scoring via compute-per-model-gates.cjs --aggregate replacing three redundant global gate scripts**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T11:49:15Z
- **Completed:** 2026-03-09T11:55:37Z
- **Tasks:** 3
- **Files modified:** 5 modified, 1 created, 6 deleted

## Accomplishments
- Added --aggregate mode to compute-per-model-gates.cjs producing continuous 0-1 gate scores with diagnostic breakdowns matching global gate JSON schemas
- Created 57-assertion unit test suite (compute-per-model-gates.test.cjs) covering mixed results, empty input, all-pass, and structural validation
- Migrated all 3 consumers (nf-solve.cjs, cross-layer-dashboard.cjs, run-formal-verify.cjs) to use --aggregate path
- Deleted 6 redundant files (3 global gate scripts + 3 test files) with zero dangling references
- Consolidated 4 pipeline entries in run-formal-verify.cjs into 1 unified entry

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --aggregate mode** - `942ddef6` (feat)
2. **Task 2: Migrate all consumers** - `43bb9a22` (refactor)
3. **Task 3: Delete global gate scripts** - `10064bbb` (chore)

## Files Created/Modified
- `bin/compute-per-model-gates.cjs` - Added AGGREGATE_FLAG, computeAggregate(), writeAggregateGateFiles(), module.exports
- `bin/compute-per-model-gates.test.cjs` - 57-assertion unit test suite for aggregate score calculations
- `bin/nf-solve.cjs` - Memoized getAggregateGates(), rewrote sweepL1toL2/L2toL3/L3toTC, added --aggregate to sweepPerModelGates
- `bin/cross-layer-dashboard.cjs` - Replaced collectGateData calls with single --aggregate spawn
- `bin/run-formal-verify.cjs` - Replaced 4 gate pipeline entries with 1, updated comment
- `bin/gate-a-grounding.cjs` - DELETED
- `bin/gate-a-grounding.test.cjs` - DELETED
- `bin/gate-b-abstraction.cjs` - DELETED
- `bin/gate-b-abstraction.test.cjs` - DELETED
- `bin/gate-c-validation.cjs` - DELETED
- `bin/gate-c-validation.test.cjs` - DELETED

## Decisions Made
- Mapped failing gate A models to `model_gap` category in `unexplained_counts` -- semantically accurate since a model failing gate A means its grounding has gaps
- Retained `.planning/formal/gates/` directory -- aggregate mode writes gate JSON files there for backward compatibility with cached dashboard mode
- Used memoized aggregate loader in nf-solve.cjs so all 3 sweep functions share a single spawn call
- Exported computeAggregate() function with require.main guard for testability without running main()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in check-tui-assets-stale.cjs (ansiToSvg function not found) -- unrelated to this task, not introduced by changes
- Node v25 TypeScript type-stripping mode interfered with shell escaping in verification one-liners -- used temp files as workaround

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Gate scoring pipeline is now unified through a single script
- All consumers produce equivalent output
- 714 tests pass with 0 failures (excluding pre-existing check-tui-assets-stale.cjs issue)

---
*Quick: 241*
*Completed: 2026-03-09*
