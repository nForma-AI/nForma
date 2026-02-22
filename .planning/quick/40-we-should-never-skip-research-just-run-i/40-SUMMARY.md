---
phase: quick-40
plan: 40
subsystem: workflow
tags: [plan-phase, research, workflow, get-shit-done]

# Dependency graph
requires: []
provides:
  - "plan-phase.md Step 5 always runs research unless explicitly skipped"
  - "has_research shortcut branch removed"
affects: [plan-phase]

# Tech tracking
tech-stack:
  added: []
  patterns: ["research-always policy: research runs on every /qgsd:plan-phase invocation unless --skip-research, --gaps, or research_enabled=false"]

key-files:
  created: []
  modified:
    - get-shit-done/workflows/plan-phase.md

key-decisions:
  - "Research always runs on /qgsd:plan-phase invocation — existing RESEARCH.md is never a skip condition"
  - "The only valid skip paths are: --skip-research flag, --gaps flag, research_enabled=false in config"
  - "Installed copy (/Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md) updated disk-only per project convention"

patterns-established:
  - "Research-always policy: never cache research output between plan-phase invocations"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-22
---

# Quick Task 40: Remove has_research Shortcut from plan-phase Step 5 Summary

**Deleted the silent research-skip branch in plan-phase.md Step 5 so /qgsd:plan-phase always spawns qgsd-phase-researcher regardless of whether RESEARCH.md already exists**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T19:12:59Z
- **Completed:** 2026-02-22T19:14:00Z
- **Tasks:** 1
- **Files modified:** 1 (repo) + 1 (installed, disk-only)

## Accomplishments

- Removed three-line `has_research` shortcut block from Step 5 that silently reused an existing RESEARCH.md
- Replaced conditional header with "Research always runs" statement with explicit cache-overwrite semantics
- Updated `success_criteria` to remove "or exists" as a skip condition
- Updated `offer_next` Research status to remove "Used existing" option (now only Completed | Skipped)
- Copied updated file verbatim to installed path (disk-only, no separate git commit)

## Task Commits

1. **Task 1: Remove has_research shortcut from Step 5** - `8ac9ca8` (fix)

## Files Created/Modified

- `get-shit-done/workflows/plan-phase.md` — Step 5 research-always policy enforced; success_criteria and offer_next updated

## Decisions Made

- The `has_research` field returned by `gsd-tools.cjs init` is still valid (other callers may use it); only the shortcut branch reading it to skip research was removed
- Installed copy updated disk-only per project convention (consistent with quick-2, quick-4, quick-38 precedents)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Research-always policy is now enforced by the workflow document. Future /qgsd:plan-phase invocations will always run qgsd-phase-researcher regardless of RESEARCH.md presence. The only skip paths are --skip-research, --gaps, and research_enabled=false.

## Self-Check: PASSED

- `get-shit-done/workflows/plan-phase.md` exists and contains "Research always runs" at line 70
- Commit `8ac9ca8` confirmed in git log
- Installed copy at `/Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md` is identical to repo copy (diff returned empty)
- Zero matches for "has_research" shortcut branch, "or exists", and "Used existing" in both files

---
*Phase: quick-40*
*Completed: 2026-02-22*
