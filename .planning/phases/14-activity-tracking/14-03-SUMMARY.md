---
phase: 14-activity-tracking
plan: 03
subsystem: workflows
tags: [activity-tracking, gsd-tools, plan-phase, quick, oscillation-resolution, new-milestone, session-resume]

# Dependency graph
requires:
  - phase: 14-01
    provides: activity-set/clear/get CLI commands in gsd-tools.cjs
provides:
  - plan-phase workflow with activity tracking at research/planning/checking_plan/quorum stages
  - quick workflow with activity tracking at planning/executing stages and clear on completion
  - oscillation-resolution-mode workflow with activity tracking at oscillation_diagnosis/awaiting_approval stages
  - new-milestone workflow with activity tracking at researching/creating_roadmap stages and clear on completion
affects: [resume-work, activity-tracking, session-continuity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activity tracking injected as Bash calls in workflow markdown before each major agent spawn or lifecycle stage"
    - "activity-set calls use JSON payload with activity, sub_activity, and optional context fields"
    - "activity-clear called after final status presentation to user (workflows that complete cleanly)"
    - "oscillation-resolution-mode does NOT call activity-clear — circuit_breaker states persist until parent workflow completes"

key-files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
    - /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
    - /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/quick.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md
    - /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/oscillation-resolution-mode.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/new-milestone.md
    - /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/new-milestone.md

key-decisions:
  - "quorum activity-set added in Step 8.5 (new section) between planner spawn and Handle Planner Return — most accurate point where per-R3 quorum runs before user output"
  - "oscillation-resolution-mode.md does NOT get activity-clear — circuit_breaker states persist until execute-phase's update_roadmap step clears them"
  - "Both installed (qgsd) and source (get-shit-done) versions updated for all 4 workflows"

patterns-established:
  - "Activity tracking pattern: inject activity-set before agent spawn; activity-clear after final user output"

requirements-completed: [ACT-06]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 14 Plan 03: Activity Tracking in Non-Execute Workflows Summary

**Activity tracking injected into plan-phase, quick, oscillation-resolution-mode, and new-milestone workflows — all major non-execute lifecycle stages now write to current-activity.json**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T19:10:24Z
- **Completed:** 2026-02-21T19:13:30Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- plan-phase.md now tracks: researching (before researcher spawn), planning (before planner spawn), quorum (step 8.5 with round number), checking_plan (before plan-checker spawn), and clears on completion
- quick.md now tracks: planning (before planner spawn), executing (before executor spawn), and clears on completion
- oscillation-resolution-mode.md now tracks: oscillation_diagnosis (Step 4) and awaiting_approval (Step 5) — no activity-clear as circuit_breaker states persist
- new-milestone.md now tracks: researching (Step 8, before 4 parallel researcher spawns), creating_roadmap (Step 10, before roadmapper spawn), and clears on completion
- All 8 files updated (4 workflows x 2 locations: qgsd installed + get-shit-done source)

## Task Commits

Each task was committed atomically:

1. **Task 1: Inject activity tracking into plan-phase.md** - `7a5d9f2` (feat)
2. **Task 2: Inject activity tracking into quick.md and oscillation-resolution-mode.md** - `d715c47` (feat)
3. **Task 3: Inject activity tracking into new-milestone.md** - `e71eec5` (feat)

## Files Created/Modified
- `/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md` - Added 4 activity-set calls + 1 activity-clear; new step 8.5 for quorum tracking
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/plan-phase.md` - Same changes with `~/.claude/qgsd/bin/gsd-tools.cjs` path
- `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md` - Added 2 activity-set calls (planning, executing) + 1 activity-clear
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/quick.md` - Same changes with `~/.claude/qgsd/bin/gsd-tools.cjs` path
- `/Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md` - Added 2 activity-set calls (oscillation_diagnosis, awaiting_approval); no activity-clear
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/oscillation-resolution-mode.md` - Same changes with `~/.claude/qgsd/bin/gsd-tools.cjs` path
- `/Users/jonathanborduas/.claude/qgsd/workflows/new-milestone.md` - Added 2 activity-set calls (researching, creating_roadmap) + 1 activity-clear
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/new-milestone.md` - Same changes with `~/.claude/qgsd/bin/gsd-tools.cjs` path

## Decisions Made
- quorum activity-set inserted at Step 8.5 (between planner return and Handle Planner Return section) — this is where CLAUDE.md R3 quorum runs before presenting output to user, making it the most accurate placement for session-resume tracking
- oscillation-resolution-mode.md does NOT call activity-clear because the circuit_breaker states (oscillation_diagnosis, awaiting_approval) should persist until the parent workflow (execute-phase) fully completes
- Both installed and source versions updated for all 4 workflows to ensure consistency

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ACT-06 is fully satisfied: all major non-execute workflows (plan-phase, quick, oscillation-resolution-mode, new-milestone) write activity at stage boundaries
- Phase 14 plans 01-03 complete; plan 04 (resume-work integration) can now use the activity data written by these workflows

## Self-Check: PASSED

- All 8 workflow files exist with correct modifications
- SUMMARY.md created at .planning/phases/14-activity-tracking/14-03-SUMMARY.md
- Task commits: 7a5d9f2 (Task 1), d715c47 (Task 2), e71eec5 (Task 3) — all verified in git log

---
*Phase: 14-activity-tracking*
*Completed: 2026-02-21*
