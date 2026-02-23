---
phase: quick
plan: 62
subsystem: workflows
tags: [resume, workflow, quick-tasks, debug, incomplete-work-detection]

requires: []
provides:
  - "resume-project.md check_incomplete_work detects quick tasks with PLAN but no SUMMARY"
  - "resume-project.md check_incomplete_work detects incomplete qgsd:debug sessions via quorum-debug-latest.md"
  - "present_status surfaces both new incomplete states with actionable recovery commands"
  - "determine_next_action routes both new incomplete states to appropriate recovery workflows"
affects: [resume-project, qgsd-resume-work]

tech-stack:
  added: []
  patterns:
    - "Bash glob .planning/quick/*/*-PLAN.md pattern for nested quick-task layout detection"
    - "grep '## fix applied' as sentinel for debug session completion state"

key-files:
  created: []
  modified:
    - "get-shit-done/workflows/resume-project.md"
    - "~/.claude/qgsd/workflows/resume-project.md (installed copy)"

key-decisions:
  - "Use nested glob pattern .planning/quick/*/*-PLAN.md to match current quick task layout (N-description/N-PLAN.md style since quick-52+)"
  - "Use '## fix applied' as the sentinel string in quorum-debug-latest.md to determine if a debug session's fix was applied"
  - "Recovery command for incomplete quick task is /qgsd:quick (picks up existing PLAN)"
  - "Recovery options for stale debug session include apply consensus, re-run /qgsd:debug, or dismiss (delete)"

patterns-established:
  - "PLAN+SUMMARY pair check extended to both phases/ and quick/ subdirectories"

requirements-completed: []

duration: 1min
completed: 2026-02-23
---

# Quick Task 62: resume-work should also look at quick tasks and incomplete qgsd:debug sessions Summary

**Extended resume-project.md check_incomplete_work step with bash detection for quick tasks missing SUMMARY and debug sessions missing fix-applied marker, plus present_status display and determine_next_action routing for both new cases.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-23T09:49:43Z
- **Completed:** 2026-02-23T09:50:44Z
- **Tasks:** 2
- **Files modified:** 1 (source + installed copy = 2 locations)

## Accomplishments

- Added bash loop scanning `.planning/quick/*/*-PLAN.md` to detect quick tasks with PLAN but no SUMMARY
- Added bash check for `.planning/quick/quorum-debug-latest.md` missing `## fix applied` marker to detect incomplete debug sessions
- Added handling prose in `check_incomplete_work` for both new incomplete states with recovery instructions
- Added `present_status` display blocks using same warning style as existing incomplete-plan entries
- Added `determine_next_action` routing blocks for both new incomplete states
- Ran `node bin/install.js --claude --global` to sync installed copy at `~/.claude/qgsd/workflows/resume-project.md`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend check_incomplete_work in resume-project.md** - `9ec05ce` (feat)
2. **Task 2: Install-sync** - (no separate commit; install updates files outside the repo)

**Plan metadata:** (final commit follows)

## Files Created/Modified

- `get-shit-done/workflows/resume-project.md` - Extended with quick-task and debug-session detection (358 → 404 lines)
- `~/.claude/qgsd/workflows/resume-project.md` - Installed copy updated via `node bin/install.js --claude --global`

## Decisions Made

- Nested glob pattern `.planning/quick/*/*-PLAN.md` chosen to match the standard layout since quick-52+ (slug subdirectory contains both PLAN and SUMMARY); flat `.planning/quick/N-PLAN.md` pattern exists only for older tasks and is not needed since they all have SUMMARYs
- `## fix applied` is the sentinel string — consistent with the debug workflow's convention for marking applied fixes
- Recovery for incomplete quick task is `/qgsd:quick` because the quick command checks for existing PLANs and resumes execution
- Three recovery options for stale debug sessions: apply consensus, re-run for fresh analysis, or dismiss if stale — gives user full control

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- resume-work now surfaces all three categories of incomplete work: incomplete phase plans, incomplete quick tasks, and stale debug sessions
- Installed copy is in sync with source
- No blockers or concerns

---
*Phase: quick-62*
*Completed: 2026-02-23*
