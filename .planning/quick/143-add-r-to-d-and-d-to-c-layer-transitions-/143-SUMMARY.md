---
phase: quick-143
plan: 01
subsystem: testing
tags: [consistency-solver, layer-transitions, documentation-sweep, keyword-matching, structural-claims]

# Dependency graph
requires:
  - phase: quick-140
    provides: "Base qgsd-solve.cjs consistency solver with 5 layer transitions"
  - phase: quick-142
    provides: "Orchestrator skill (commands/qgsd/solve.md) for solver remediation dispatch"
provides:
  - "7 layer transitions in qgsd-solve: R->D (req->docs) and D->C (docs->code) added"
  - "discoverDocFiles(), extractKeywords(), extractStructuralClaims() helper functions"
  - "sweepRtoD() and sweepDtoC() sweep functions"
  - "12 new tests for keyword extraction, structural claims, and sweep validation"
  - "Alloy model with 7 LayerTransition singletons"
affects: [qgsd-solve, formal-models, orchestrator-skills]

# Tech tracking
tech-stack:
  added: []
  patterns: ["recursive walkDir with depth limit for doc discovery", "keyword-based fuzzy matching for requirement documentation detection", "structural claim extraction with false-positive filtering"]

key-files:
  created: []
  modified:
    - "bin/qgsd-solve.cjs"
    - "bin/qgsd-solve.test.cjs"
    - ".formal/alloy/solve-consistency.als"
    - "commands/qgsd/solve.md"

key-decisions:
  - "Keyword matching uses case-insensitive toLowerCase() with 3+ keyword threshold"
  - "Both R->D and D->C are manual-review only in autoClose (no automated remediation)"
  - "JSON output truncates detail arrays to 30 items to prevent pipe buffer overflow"
  - "Doc discovery uses config.json docs_paths or falls back to README.md + docs/**/*.md"

patterns-established:
  - "Structural claim extraction: parse backtick-wrapped values, skip fenced code blocks and Example headings"
  - "False positive filtering: template variables, home paths, code expressions, short tokens"
  - "JSON detail truncation with _truncated and _total metadata for large arrays"

requirements-completed: [QUICK-143]

# Metrics
duration: 29min
completed: 2026-03-04
---

# Quick 143: R-to-D and D-to-C Layer Transitions Summary

**Expanded qgsd-solve from 5 to 7 layer transitions with doc-aware sweeps for requirement coverage and structural claim validation**

## Performance

- **Duration:** 29 min
- **Started:** 2026-03-04T07:36:49Z
- **Completed:** 2026-03-04T08:05:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Solver engine now sweeps 7 layer transitions, closing the documentation blind spot
- R->D sweep detects requirements not mentioned in docs using ID match and 3+ keyword fuzzy matching
- D->C sweep detects stale file paths, CLI commands, and dependencies referenced in docs
- False positive filtering handles template variables, Example headings, home paths, fenced code blocks, and code expressions
- 12 new tests plus 6 updated mocks, all 28 tests pass
- Alloy formal model updated to 7 LayerTransition singletons

## Task Commits

Each task was committed atomically:

1. **Task 1: Add R-to-D and D-to-C sweep functions to solver engine + update Alloy model** - `3862766f` (feat)
2. **Task 2: Update test suite + orchestrator skill for R-to-D and D-to-C transitions** - `6a1fac44` (feat)

## Files Created/Modified
- `bin/qgsd-solve.cjs` - Added discoverDocFiles, extractKeywords, extractStructuralClaims, sweepRtoD, sweepDtoC, truncateResidualDetail; updated computeResidual, autoClose, formatReport, formatJSON; bumped solver_version to 1.1
- `bin/qgsd-solve.test.cjs` - Updated 6 existing mocks; added 12 new tests; added maxBuffer to integration tests
- `.formal/alloy/solve-consistency.als` - Added RtoD and DtoC singletons, updated facts and assertions to 7 transitions
- `commands/qgsd/solve.md` - Updated objective to 7 transitions, added r_to_d/d_to_c to Step 1, added Steps 3f/3g for manual review, added MANUAL rows to Step 6

## Decisions Made
- Keyword matching uses case-insensitive comparison with 3+ keyword threshold to reduce false positives
- Both R->D and D->C are manual-review only in autoClose (like C->F) - documentation requires human authoring
- JSON output truncates detail arrays to 30 items max to prevent macOS pipe buffer overflow (64KB limit)
- Doc discovery uses walkDir with max depth 10 to prevent runaway recursion
- extractStructuralClaims supports @scope/package names and path separators in dependency classification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSON output exceeding pipe buffer limit**
- **Found during:** Task 2 (test verification)
- **Issue:** D->C sweep found 147 broken claims, causing JSON output to exceed the 64KB macOS pipe buffer for spawnSync, breaking 5 existing integration tests (TC-INT-1, TC-INT-3, TC-INT-4, TC-CONV-1, TC-CONV-2)
- **Fix:** Added truncateResidualDetail() function that caps detail arrays at 30 items with _truncated and _total metadata; added maxBuffer to test spawnSync calls
- **Files modified:** bin/qgsd-solve.cjs, bin/qgsd-solve.test.cjs
- **Verification:** All 28 tests pass, JSON output reduced from 70KB to 17KB
- **Committed in:** 6a1fac44 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix was necessary to maintain existing test pass rate. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Solver engine is feature-complete with 7 layer transitions
- R->D and D->C sweeps are operational and producing real results (147 broken claims found in current project docs)
- Orchestrator skill is ready to display and guide manual review of documentation gaps

---
*Phase: quick-143*
*Completed: 2026-03-04*
