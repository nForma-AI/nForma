---
phase: quick-314
plan: 01
subsystem: formal-verification
tags: [proximity-graph, orphan-detection, threshold-tuning, requirement-extraction, coverage-analysis]

requires:
  - phase: none
    provides: none
provides:
  - "countEmbeddedEdges utility for accurate edge counting in proximity index"
  - "Source annotation extraction (@requirement) from .als/.tla/.pm/.props files"
  - "Graph-connectivity orphan detection replacing zero-scoring-pair heuristic"
  - "Default threshold raised to 0.7 eliminating noise floor false positives"
  - "Fast-path skipping ensemble when coverage >= 95%"
  - "Uncovered requirements surfacing in CLI output and JSON"
affects: [formal-verify, solve-loop, candidate-discovery]

tech-stack:
  added: []
  patterns: ["graph-connectivity orphan detection", "fast-path coverage bypass", "source annotation extraction"]

key-files:
  created: []
  modified:
    - bin/formal-proximity.cjs
    - bin/formal-proximity.test.cjs
    - bin/candidate-discovery.cjs
    - bin/candidate-discovery.test.cjs

key-decisions:
  - "Include .props files alongside .pm for PRISM annotation extraction (both contain @requirement)"
  - "Adapted PRISM test to use HEAL-01 in deliberation-healing.pm (quorum.pm has no annotations)"
  - "Graph-connectivity orphan = node with 0 edges, not zero-scoring pairs"

patterns-established:
  - "Source annotation pattern: @requirement REQ-ID in formal model comments creates modeled_by edges"

requirements-completed: [QUICK-314]

duration: 4min
completed: 2026-03-16
---

# Quick Task 314: Fix Proximity Pipeline Summary

**Accurate edge counting via countEmbeddedEdges, graph-connectivity orphan detection, 0.7 threshold, source annotation extraction from .als/.tla/.pm/.props, and uncovered requirement surfacing with fast-path bypass**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T14:04:08Z
- **Completed:** 2026-03-16T14:08:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added countEmbeddedEdges() that accurately sums node.edges.length across all proximity index nodes
- buildIndex() now extracts 592 @requirement annotations from 190 source files across alloy/tla/prism
- Orphan detection uses graph connectivity (0-edge nodes) instead of zero-scoring pairs
- Default threshold raised from 0.6 to 0.7, ensemble floor also raised to 0.7
- Fast-path skips expensive ensemble scoring when coverage >= 95% (with --no-fast-path override)
- Truly uncovered requirements surfaced prominently in stderr and JSON output

## Task Commits

Each task was committed atomically:

1. **Task 1: Add countEmbeddedEdges and TLA+/PRISM extraction** - `62384afc` (feat)
2. **Task 2: Fix orphan definition, raise threshold, surface uncovered** - `88166e63` (feat)

## Files Created/Modified
- `bin/formal-proximity.cjs` - Added countEmbeddedEdges(), Step 12b source annotation extraction
- `bin/formal-proximity.test.cjs` - 3 new tests: edge counting, TLA+ annotations, PRISM annotations
- `bin/candidate-discovery.cjs` - Graph-connectivity orphans, 0.7 threshold, fast-path, uncovered requirements
- `bin/candidate-discovery.test.cjs` - 3 new tests: default threshold, graph orphans, uncovered_requirements shape

## Decisions Made
- Included .props files alongside .pm for PRISM since both contain @requirement annotations
- Adapted the PRISM test to check HEAL-01 in deliberation-healing.pm (quorum.pm has no annotations, contrary to plan)
- Added ENSEMBLE_METHODS to mock in candidate-discovery tests (was missing, would cause failures)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PRISM test target adjusted**
- **Found during:** Task 1
- **Issue:** Plan specified QUORUM-02 in quorum.pm but that file has no @requirement annotations
- **Fix:** Used HEAL-01 in deliberation-healing.pm which has real annotations
- **Files modified:** bin/formal-proximity.test.cjs
- **Verification:** Test passes against real data
- **Committed in:** 62384afc

**2. [Rule 2 - Missing Critical] Added .props file support and ENSEMBLE_METHODS mock**
- **Found during:** Task 1 and Task 2
- **Issue:** PRISM .props files also contain @requirement annotations; mock missing ENSEMBLE_METHODS
- **Fix:** Added .props glob to source scan dirs; added ENSEMBLE_METHODS to test mock
- **Files modified:** bin/formal-proximity.cjs, bin/candidate-discovery.test.cjs
- **Verification:** 592 annotations extracted (vs fewer without .props); tests pass
- **Committed in:** 62384afc, 88166e63

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Proximity pipeline now produces accurate orphan detection and coverage analysis
- Source annotations create additional modeled_by edges improving graph connectivity
- Fast-path significantly reduces runtime for high-coverage codebases

---
*Phase: quick-314*
*Completed: 2026-03-16*
