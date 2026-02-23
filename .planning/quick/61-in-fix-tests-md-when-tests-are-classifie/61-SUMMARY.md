---
phase: quick-61
plan: 01
subsystem: testing
tags: [fix-tests, quorum, real-bug, hypothesis, dispatch, workflow]

# Dependency graph
requires: []
provides:
  - "Real-bug quorum investigation step (6h.1) in fix-tests.md"
  - "Consensus hypothesis generation per real-bug verdict"
  - "Automatic /qgsd:quick task dispatch for real-bug failures"
  - "Updated INTG-03 compliance note"
  - "Updated install sync at ~/.claude/qgsd/workflows/fix-tests.md"
affects: [fix-tests-workflow, quorum, maintain-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-bug quorum investigation: Mode A sequential calls → consensus hypothesis → dispatched fix task"
    - "deferred_report.real_bug entries now include consensus_hypothesis for audit trail"
    - "dispatched_tasks records include consensus_hypothesis for real-bug category"

key-files:
  created: []
  modified:
    - "get-shit-done/workflows/fix-tests.md"
    - "~/.claude/qgsd/workflows/fix-tests.md (installed copy)"

key-decisions:
  - "real-bug classified test failures now trigger quorum investigation (Steps A-D) then dispatch, not silent deferral"
  - "deferred_report.real_bug entries use object shape {file, reason, consensus_hypothesis} — not plain string"
  - "Step 6h dispatch summary line no longer claims 'real-bug failures deferred'; redirects to 6h.1"
  - "INTG-03 updated to clarify scoped quorum use (investigation in 6h.1, not classification quorum for whole workflow)"

patterns-established:
  - "Quorum investigation pattern for per-test hypothesis: Claude hypothesis first, then sequential quorum models, then consensus synthesis"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-23
---

# Quick Task 61: fix-tests.md real-bug quorum investigation + dispatch

**Real-bug test failures now trigger a quorum investigation (Claude + available models) to produce a consensus fix hypothesis, then auto-dispatch a /qgsd:quick fix task — identical dispatch pattern to adapt/fixture/isolate.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T09:20:00Z
- **Completed:** 2026-02-23T09:24:00Z
- **Tasks:** 2
- **Files modified:** 1 (source) + install sync

## Accomplishments
- Added Step 6h.1 (Quorum investigation and dispatch for real-bug verdicts) with Steps A-F covering: investigation bundle assembly, Claude's own hypothesis, sequential quorum model queries, consensus synthesis, state persistence, and /qgsd:quick task dispatch
- Updated Step 6h filter: real-bug is now listed as actionable (via quorum investigation) — no longer silently deferred
- Updated INTG-03 compliance note to accurately describe scoped quorum use (inline investigation, not planning quorum)
- Updated Step 7 terminal summary: real-bug count now shows "investigated by quorum + dispatched" and deferred_report entries include consensus_hypothesis
- Ran install sync: ~/.claude/qgsd/workflows/fix-tests.md updated and verified

## Task Commits

1. **Task 1: Add real-bug quorum investigation and dispatch to Step 6h** - `1b5ab7e` (feat)
2. **Task 2: Run install sync to propagate changes to ~/.claude/qgsd/** - `66f11ab` (chore)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md` - New Step 6h.1 block (140 lines), updated Step 6h filter, updated INTG-03 note, updated Step 7 summary

## Decisions Made
- deferred_report.real_bug entries change shape: from `[string]` array to `[{file, reason, consensus_hypothesis}]` objects — preserves audit trail while carrying hypothesis forward
- dispatched_tasks records for real-bug category get an extra `consensus_hypothesis` field
- Step 6h dispatch summary line updated to not mention "deferred" for real-bug — readers now see only adapt/fixture/isolate counts in 6h; real-bug gets its own 6h.1 summary line

## Deviations from Plan

None - plan executed exactly as written. One minor addition: updated the dispatch summary print line in Step 6h to remove the "real-bug failures deferred" text (was still present in the original file, plan didn't explicitly call this out but it was clearly inconsistent with the new behavior).

## Issues Encountered
None — all edits applied cleanly; install sync succeeded and installed copy verified.

## Next Phase Readiness
- fix-tests.md now has full real-bug automation: classify → investigate (quorum) → dispatch fix task
- Pattern is symmetric with adapt/fixture/isolate dispatch
- adapt/fixture/isolate dispatch block in Step 6h is completely unchanged

---
*Phase: quick-61*
*Completed: 2026-02-23*
