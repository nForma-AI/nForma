---
phase: quick-35
plan: 35
subsystem: workflows
tags: [auto-advance, new-project, new-milestone, plan-phase, task-spawn]

# Dependency graph
requires:
  - phase: quick-33
    provides: "auto_advance defaulting to true in config/gsd-tools"
provides:
  - "new-project.md auto-advances to plan-phase 1 via Task spawn after roadmap approval"
  - "new-milestone.md auto-advances to plan-phase FIRST_PHASE via Task spawn after roadmap approval"
  - "Both workflows read AUTO_CFG from config (covers non---auto YOLO users)"
affects: [new-project, new-milestone, plan-phase, auto-advance pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Task spawn for auto-advance (separate context window, no bloat)", "AUTO_CFG config check with --auto flag fallback"]

key-files:
  created: []
  modified:
    - get-shit-done/workflows/new-project.md
    - get-shit-done/workflows/new-milestone.md

key-decisions:
  - "Task spawn (not SlashCommand/inline) used for plan-phase auto-advance — prevents orchestrator context bloat"
  - "AUTO_CFG check in addition to --auto flag — ensures YOLO users with config but no flag also get auto-advance"
  - "FIRST_PHASE lookup with grep fallback in new-milestone.md — handles edge cases when roadmap tool unavailable"
  - "activity-clear placed before auto-advance check so new activity-set reflects plan_phase sub_activity cleanly"

patterns-established:
  - "Auto-advance pattern: read AUTO_CFG config, spawn Task, handle PLANNING COMPLETE / error cases, activity-clear"

requirements-completed: [QUICK-35]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Quick Task 35: Auto-advance new-project and new-milestone to plan-phase via Task spawn

**SlashCommand replaced by Task-spawned plan-phase in new-project.md; AUTO_CFG-gated Task spawn added to new-milestone.md — both read config so YOLO users get auto-advance without --auto flag**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T23:12:50Z
- **Completed:** 2026-02-21T23:14:xx Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed `SlashCommand("/qgsd:discuss-phase 1 --auto")` from new-project.md Step 9 — replaced with AUTO_CFG config read + Task spawn of `plan-phase 1`
- Added AUTO_CFG check + FIRST_PHASE lookup + Task spawn of `plan-phase ${FIRST_PHASE}` to new-milestone.md Step 11 after `activity-clear`
- Updated new-milestone.md `success_criteria`: last bullet changed from "user knows next step" to auto-advance condition
- Both installed copies (~/.claude/qgsd/workflows/) updated disk-only to match source

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace SlashCommand with Task spawn in new-project.md** - `7810d1c` (feat)
2. **Task 2: Add AUTO_CFG auto-advance block to new-milestone.md** - `9b08f6b` (feat)

## Files Created/Modified
- `get-shit-done/workflows/new-project.md` - Step 9: SlashCommand removed; AUTO_CFG check + Task spawn added; interactive fallback preserved
- `get-shit-done/workflows/new-milestone.md` - Step 11: AUTO_CFG check + FIRST_PHASE lookup + Task spawn added after activity-clear; success_criteria updated
- `~/.claude/qgsd/workflows/new-project.md` - Installed copy updated (disk-only)
- `~/.claude/qgsd/workflows/new-milestone.md` - Installed copy updated (disk-only)

## Decisions Made
- Task spawn (not inline SlashCommand) used in both workflows — separate context window prevents orchestrator context bloat
- AUTO_CFG reads `workflow.auto_advance` from config (quick-33 default: true), so all YOLO users get auto-advance regardless of --auto flag
- FIRST_PHASE in new-milestone uses `roadmap list-phases` with grep fallback on ROADMAP.md — safe for edge cases
- new-milestone.md places `activity-clear` before auto-advance block (the existing one) then sets new activity for plan_phase, then clears again after Task completes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auto-advance pipeline now runs end-to-end: new-project/new-milestone → roadmap approval → plan-phase (Task spawn) → execute-phase
- Both source and installed workflow files are in sync
- No follow-up tasks needed

---
*Phase: quick-35*
*Completed: 2026-02-21*
