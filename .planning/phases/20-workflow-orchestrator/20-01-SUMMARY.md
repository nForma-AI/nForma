---
phase: 20-workflow-orchestrator
plan: "01"
subsystem: testing
tags: [fix-tests, workflow, circuit-breaker, batch-loop, maintain-tests, orchestration]

requires:
  - phase: 19-state-schema-activity-integration
    provides: maintain-tests load-state, save-state, run-batch --batch-index, activity-set/clear
  - phase: 18-test-maintenance-cli
    provides: maintain-tests discover, batch, run-batch mechanical primitives

provides:
  - /qgsd:fix-tests command (callable from any Claude session)
  - fix-tests workflow with 9-step discover→batch→execute→categorize→iterate loop
  - Three-condition termination: all classified / no progress in 5 batches / iteration cap
  - Circuit breaker lifecycle: disable at start, enable on all exit paths including errors
  - Stub categorization: confirmed failures marked as real_bug (Phase 21 replaces with AI)
  - Resume logic: load-state null check → skip discovery/batching on resume
  - Progress banner after each batch with pass/fail/flaky/skipped counts

affects:
  - phase-21-categorization-engine (replaces stub categorization in 6d with real AI classification)
  - phase-22-integration-test (verifies circuit breaker lifecycle, termination conditions end-to-end)

tech-stack:
  added: []
  patterns:
    - Command stub + separate workflow file (same pattern as quick.md, resume-work.md)
    - Workflow loop with state-driven resume (load-state null → fresh start; non-null → resume)
    - Circuit breaker disable/enable wrapping execution-only loops

key-files:
  created:
    - commands/qgsd/fix-tests.md
    - get-shit-done/workflows/fix-tests.md
    - ~/.claude/commands/qgsd/fix-tests.md (installed — immediately callable)
    - ~/.claude/qgsd/workflows/fix-tests.md (installed — runtime-accessible)
  modified: []

key-decisions:
  - "Stub categorization marks all confirmed failures as real_bug — conservative (no auto-actions), valid for Phase 21 to replace without schema change"
  - "consecutive_no_progress added to state JSON schema (not a workflow-only variable) so it survives interruption and resume is exact"
  - "Source files use tilde paths (~/.claude/qgsd/...); installed copies use absolute paths — do NOT cp; write each independently"
  - "INTG-03: fix-tests must NOT appear in quorum_commands — execution-only command, never routes through Stop hook quorum check"

patterns-established:
  - "Pattern: Execution-only commands do not appear in quorum_commands — only planning commands require quorum"
  - "Pattern: Circuit breaker disable/enable always via npx qgsd flags, never direct JSON write"
  - "Pattern: load-state 2>/dev/null suppresses ExperimentalWarning on Node >= 22.5 (sqlite)"
  - "Pattern: Four files per command — source stub, source workflow, installed stub, installed workflow"

requirements-completed: [ITER-01, ITER-02, INTG-01, INTG-03]

duration: 8min
completed: 2026-02-22
---

# Phase 20: Workflow Orchestrator — Plan 01 Summary

**`/qgsd:fix-tests` command with full 9-step discover→batch→execute→stub-categorize→iterate workflow, three-condition termination, and circuit breaker lifecycle**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T17:50:00Z
- **Completed:** 2026-02-22T17:58:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 source, 2 installed)

## Accomplishments

- Created `/qgsd:fix-tests` command stub and full workflow (242 lines) with all 9 steps including circuit breaker disable/enable, progress banners, three termination conditions, and resume logic
- Created both source copies (committed to git) and installed copies (absolute paths, immediately callable in Claude sessions)
- Verified INTG-03 compliance: `fix-tests` absent from `quorum_commands` in `~/.claude/qgsd.json`
- All 124 existing gsd-tools tests pass — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1+2+3: Create source files, installed copies, verify compliance** - `7f88616` (feat: /qgsd:fix-tests command and workflow orchestrator)

## Files Created/Modified

- `commands/qgsd/fix-tests.md` — Source command stub (27 lines); delegates to workflow via @-reference
- `get-shit-done/workflows/fix-tests.md` — Source workflow (242 lines); full 9-step loop with error handling and resume logic
- `/Users/jonathanborduas/.claude/commands/qgsd/fix-tests.md` — Installed command; uses absolute path in execution_context
- `/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md` — Installed workflow; identical to source (already uses absolute gsd-tools.cjs path)

## Decisions Made

- Stub categorization marks all confirmed failures as `real_bug` — conservative approach, no auto-actions dispatched in Phase 20; Phase 21 replaces this with AI classification (CATG-03)
- `consecutive_no_progress` stored in state JSON alongside `last_unresolved_count` so the progress counter survives interruption and resumes correctly
- No arguments added to fix-tests in Phase 20 (runner auto-detection is the default); `--runner` flag deferred to Phase 22 if needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The test count (124) differs from the "190" mentioned in the plan's Task 3 action — the 190 figure was stale in the plan text; 124 is the current live count after Phase 19's additions. Zero failures confirmed in both cases.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 21 (Categorization Engine): can replace `get-shit-done/workflows/fix-tests.md` Step 6d with real AI classification; all other loop machinery is production-ready
- Phase 22 (Integration Test): circuit breaker lifecycle, termination conditions, and resume logic are all in place and ready for end-to-end verification
- `/qgsd:fix-tests` is immediately callable in any Claude session (installed copies present)

---
*Phase: 20-workflow-orchestrator*
*Completed: 2026-02-22*
