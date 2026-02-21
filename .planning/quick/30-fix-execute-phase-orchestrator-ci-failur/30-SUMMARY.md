---
phase: quick-30
plan: 01
subsystem: execute-phase-orchestrator
tags: [ci-failures, auto-spawn, quick-task, orchestrator, failure-handling]
dependency_graph:
  requires: []
  provides: [auto-spawn-ci-fix-path]
  affects: [execute-phase-orchestrator]
tech_stack:
  added: []
  patterns: [diagnosis-detection-heuristic, auto-spawn-quick-task]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/execute-phase.md
    - ~/.claude/qgsd/workflows/execute-phase.md
decisions:
  - "Diagnosis detection heuristic: SUMMARY.md markers (Root Cause:, Diagnosed, Bug N —, CI Failures, Deferred: CI fixes) trigger auto-spawn path — no user gate"
  - "Auto-spawn mechanism mirrors quick.md Steps 2-6: init quick + qgsd-planner + quorum review + qgsd-executor + STATE.md update"
  - "Both step 4 (spot-check failure) and step 5 (real failure) check for diagnosis before falling back to user-facing questions"
  - "Installed file uses absolute path /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs; disk-only, not committed to git"
metrics:
  duration: 2 min
  completed: 2026-02-21
  tasks: 2
  files: 2
---

# Quick Task 30: Fix execute-phase orchestrator CI failure gate — auto-spawn quick task Summary

**One-liner:** Three targeted edits to execute-phase.md make the orchestrator auto-spawn a quick task (no user gate) when a failed plan's SUMMARY.md contains diagnosed CI failure markers, then resume phase execution.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Update execute_waves step 4 and step 5 in source | — (done before commit) | get-shit-done/workflows/execute-phase.md |
| 2 | Sync installed execute-phase.md and commit source | f13a22d | ~/.claude/qgsd/workflows/execute-phase.md (disk-only) |

## What Was Built

Added three targeted edits to the execute-phase orchestrator workflow:

1. **Edit 1 — Step 4, spot-check failure path:** Replaces the flat "ask Retry/Continue?" with a diagnosis-detection heuristic. When SUMMARY.md contains `Root Cause:`, `Diagnosed`, `Bug 1 —`, `Bug 2 —`, `CI Failures`, or `Deferred: CI fixes`, the orchestrator reads the diagnosis and auto-spawns a quick task. Only falls back to asking the user when no diagnosis is found.

2. **Edit 2 — Step 5, real failure path:** Same diagnosis check applied. Added the full "Auto-spawn quick task mechanism" section documenting the inline steps: `init quick` → qgsd-planner Task → quorum review (quick.md Step 5.7) → qgsd-executor Task → STATE.md update → resume phase execution.

3. **Edit 3 — failure_handling block:** Added bullet documenting the new CI-failures-with-diagnosed-root-causes path for reference alongside other failure types.

## Verification Results

Source file:
```
157:   **Diagnosis detection heuristic:** SUMMARY.md is diagnosed when it contains any of: `Root Cause:`, `Diagnosed`, `Bug 1 —`, `Bug 2 —`, `CI Failures`, `Deferred: CI fixes`.
187:   **Auto-spawn quick task mechanism** (used by both step 4 and step 5):
487:- **CI failures with diagnosed root causes:** Executor SUMMARY.md contains sections with...
```

Installed file: 3 matching lines at same line numbers.

Git log: `f13a22d feat(quick-30): auto-spawn quick task on diagnosed CI failures in execute-phase orchestrator`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- Source file modified: FOUND get-shit-done/workflows/execute-phase.md
- Installed file modified: FOUND /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
- Source commit: FOUND f13a22d
- 3 grep matches in source: CONFIRMED
- 3 grep matches in installed: CONFIRMED
