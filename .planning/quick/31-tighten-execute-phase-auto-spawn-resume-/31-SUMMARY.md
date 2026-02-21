---
phase: quick-31
plan: 31
subsystem: execute-phase workflow
tags: [orchestrator, quick-task, ci-loop-prevention, post-fix-verification]
dependency_graph:
  requires: [quick-30]
  provides: [post-fix-verification-gate]
  affects: [get-shit-done/workflows/execute-phase.md]
tech_stack:
  added: []
  patterns: [cap-1-retry-gate, quorum-test-rerun]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/execute-phase.md
    - ~/.claude/qgsd/workflows/execute-phase.md (disk-only)
decisions:
  - "Post-fix verification capped at 1 retry: second BLOCK escalates to user rather than spawning another quick task — prevents infinite auto-spawn loops"
  - "Quorum-test re-run is mandatory after quick task completes — CI pass is required before phase execution resumes"
metrics:
  duration: "3 min"
  completed: "2026-02-21T22:46:03Z"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 31: Tighten execute-phase auto-spawn resume Summary

**One-liner:** Added 3-step post-fix verification block (cap: 1 retry) replacing vague resume line in auto-spawn quick task mechanism of execute-phase orchestrator.

## What Was Done

Replaced the single vague instruction "Then resume phase execution from the failed plan." in `get-shit-done/workflows/execute-phase.md` with a concrete 3-step post-fix verification block:

1. Re-run `/qgsd:quorum-test` on the same plan to confirm CI now passes
2. If quorum-test PASS → mark plan complete, continue to next wave/phase normally
3. If quorum-test BLOCK again → do NOT auto-spawn another quick task — ask user instead

This closes the infinite loop risk introduced by quick-30's auto-spawn mechanism.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace vague resume line in source execute-phase.md | 845e627 | get-shit-done/workflows/execute-phase.md |
| 2 | Mirror change to installed copy (disk-only) | disk-only | ~/.claude/qgsd/workflows/execute-phase.md |

## Verification

- `grep "Post-fix verification (cap: 1 retry)"` returns line 203 in both source and installed files
- `grep "Then resume phase execution from the failed plan"` returns no output in either file
- Pre-existing path format differences (tilde vs absolute) in installed copy are unrelated to this task

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- get-shit-done/workflows/execute-phase.md contains "Post-fix verification (cap: 1 retry)" at line 203
- ~/.claude/qgsd/workflows/execute-phase.md contains "Post-fix verification (cap: 1 retry)" at line 203
- "Then resume phase execution from the failed plan." absent from both files
- Commit 845e627 exists in git log
