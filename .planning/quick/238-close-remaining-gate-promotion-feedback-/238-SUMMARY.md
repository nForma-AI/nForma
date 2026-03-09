---
phase: quick-238
plan: 01
subsystem: formal-verification
tags: [gate-promotion, evidence-refresh, demotion, changelog, tui, formalization]

requires:
  - phase: quick-236
    provides: Evidence files wired into gate promotion pipeline
provides:
  - Always-on evidence refresh at session end via Stop hook
  - Structured promotion/demotion changelog with 200-entry retention cap
  - Automatic gate demotion with hysteresis thresholds
  - Formalization candidate ranking by churn signal
  - TUI visibility for recent gate changes
affects: [solve-tui, nf-stop, compute-per-model-gates, nf-solve]

tech-stack:
  added: []
  patterns: [hysteresis-thresholds, fail-open-evidence-refresh, changelog-retention-cap]

key-files:
  created:
    - bin/formalization-candidates.cjs
    - .planning/formal/promotion-changelog.json
  modified:
    - hooks/nf-stop.js
    - hooks/dist/nf-stop.js
    - bin/compute-per-model-gates.cjs
    - bin/nf-solve.cjs
    - bin/solve-tui.cjs

key-decisions:
  - "Hysteresis thresholds: promote SOFT_GATE at score>=1, demote at <0.8; promote HARD_GATE at score>=3, demote at <2.5"
  - "Trace density defaults to 1.0 (neutral) since trace-corpus-stats.json lacks per-file data"
  - "Changelog capped at 200 entries with front-trim retention policy"

patterns-established:
  - "Hysteresis gap between promotion and demotion thresholds prevents oscillation"
  - "visLen/visPad ANSI-aware padding helpers for TUI rendering"

requirements-completed: [GATE-01, GATE-02, GATE-03, GATE-04]

duration: 4min
completed: 2026-03-09
---

# Quick 238: Close Remaining Gate Promotion Feedback Loops Summary

**Always-on evidence refresh via Stop hook, structured promotion/demotion changelog with TUI visibility, formalization candidate ranking by churn, and automatic gate demotion with hysteresis thresholds**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T08:23:34Z
- **Completed:** 2026-03-09T08:27:36Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Evidence files refresh automatically at end of every successful session via nf-stop.js
- Gate promotions and demotions logged to promotion-changelog.json with 200-entry retention cap
- SOFT_GATE demotes to ADVISORY at evidence score <0.8; HARD_GATE demotes to SOFT_GATE at <2.5 (hysteresis buffers)
- formalization-candidates.cjs ranks uncovered files by churn signal, integrated into nf-solve report
- TUI main menu shows recent gate changes (7 days) with color-coded promotion/demotion labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Always-on evidence collection + promotion changelog + demotion logic** - `c8ec84cb` (feat)
2. **Task 2: Formalization candidates script + nf-solve integration** - `5a71ea7f` (feat)
3. **Task 3: TUI promotion changelog section** - `d909b75e` (feat)

## Files Created/Modified
- `hooks/nf-stop.js` - Evidence refresh spawnSync call on approve path (fail-open)
- `hooks/dist/nf-stop.js` - Synced copy for install
- `bin/compute-per-model-gates.cjs` - appendChangelog function, demotion logic, demotions output field
- `.planning/formal/promotion-changelog.json` - Structured promotion/demotion history
- `bin/formalization-candidates.cjs` - Ranks uncovered files by churn x trace_density
- `bin/nf-solve.cjs` - Formalization candidates section in formatReport
- `bin/solve-tui.cjs` - Recent Gate Changes display with ANSI-aware padding

## Decisions Made
- Hysteresis thresholds: promote at score>=1/3 but demote at <0.8/2.5 to prevent oscillation
- Trace density set to 1.0 (neutral) since trace-corpus-stats.json has no per-file references
- Changelog retention capped at 200 entries, trimmed from front
- Evidence refresh placed only on the approve path (after quorum passes), not on block/fail paths
- visLen/visPad helpers used for ANSI-aware padding instead of hardcoded offsets

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 feedback loops closed and operational
- Promotion changelog already populated with real data from first run
- Future improvement: per-file trace data source would improve formalization candidate ranking

## Self-Check: PASSED

---
*Phase: quick-238*
*Completed: 2026-03-09*
