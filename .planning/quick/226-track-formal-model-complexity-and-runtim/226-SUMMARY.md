---
phase: quick-226
plan: 01
subsystem: formal-verification
tags: [complexity, runtime-profiling, state-space, nf-solve]

requires:
  - phase: quick-140
    provides: nf-solve consistency solver framework
provides:
  - model-complexity-profile.cjs combining runtime + static complexity into unified profile
  - Split/merge recommendations based on runtime classification
  - Model Complexity section in nf-solve text and JSON reports
affects: [nf-solve, formal-verification-pipeline]

tech-stack:
  added: []
  patterns: [formalism-prefix-to-path correlation layer for NDJSON/state-space join]

key-files:
  created:
    - bin/model-complexity-profile.cjs
    - bin/model-complexity-profile.test.cjs
  modified:
    - bin/nf-solve.cjs

key-decisions:
  - "Runtime-only profile is the default production path (state-space-report.json does not exist on disk)"
  - "Formalism-prefix-to-path correlation normalizes check_ids (e.g., tla:account-manager) to file paths (e.g., MCAccountManager.tla) via slug matching"
  - "Runtime thresholds: FAST<=1s, MODERATE<=10s, SLOW<=30s, HEAVY>30s"

patterns-established:
  - "Fail-open profiling: missing data sources produce partial profiles, never exit non-zero"

requirements-completed: [QUICK-226]

duration: 5min
completed: 2026-03-08
---

# Quick 226: Model Complexity Profile Summary

**Runtime complexity profiler classifying 55 formal models into FAST/MODERATE/SLOW/HEAVY with split/merge recommendations surfaced in nf-solve reports**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T19:51:29Z
- **Completed:** 2026-03-08T19:56:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created model-complexity-profile.cjs that combines check-results.ndjson runtime data with state-space-report.json static complexity
- Profiles 55 models with runtime classification (FAST/MODERATE/SLOW/HEAVY) and identifies 6 split candidates
- Integrated into nf-solve: Model Complexity section in text report + complexity_profile in JSON output
- 18 unit tests covering thresholds, joins, deduplication, and graceful degradation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create model-complexity-profile.cjs profiler** - `bc496af7` (feat)
2. **Task 2: Wire model-complexity-profile into nf-solve report** - `86e2650b` (feat)

## Files Created/Modified
- `bin/model-complexity-profile.cjs` - Complexity profiler combining runtime + static analysis
- `bin/model-complexity-profile.test.cjs` - 18 unit tests for the profiler
- `bin/nf-solve.cjs` - Added profiler call in F->C sweep, Model Complexity section in text/JSON reports

## Decisions Made
- Runtime-only profile is the default production path since state-space-report.json does not currently exist on disk
- Formalism-prefix-to-path correlation layer normalizes NDJSON check_ids to state-space file paths via slug matching (strips MC/NF prefixes, removes hyphens/underscores)
- Runtime thresholds set at 1s/10s/30s boundaries matching existing solver timing expectations
- Split candidates: HEAVY = hard recommend, SLOW = soft recommend ("consider splitting if complexity grows")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complexity profile data available for future nf-solve enhancements
- Split/merge recommendations can inform formal model refactoring decisions

---
*Phase: quick-226*
*Completed: 2026-03-08*
