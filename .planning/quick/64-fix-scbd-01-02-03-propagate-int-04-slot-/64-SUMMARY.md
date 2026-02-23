---
phase: quick-64
plan: 01
subsystem: orchestrator, install-sync
tags: [scoreboard, slot, orchestrator, install-sync, debug]
dependency_graph:
  requires: [v0.7-04 orchestrator commit at HEAD]
  provides: [installed ~/.claude/agents/qgsd-quorum-orchestrator.md with --slot fix, debug.md backtick cleanup committed]
  affects: [SCBD-01, SCBD-02, SCBD-03]
tech_stack:
  added: []
  patterns: [install-sync propagation, scoreboard composite key <slot>:<model-id>]
key_files:
  created: []
  modified:
    - commands/qgsd/debug.md
    - ~/.claude/agents/qgsd-quorum-orchestrator.md (installed, not tracked)
decisions:
  - "Backtick cleanup in debug.md committed separately to keep task scope clean"
  - "Install sync copies agents/qgsd-quorum-orchestrator.md to ~/.claude/agents/ — no git commit needed for installed files"
metrics:
  duration: ~3min
  completed: 2026-02-23
  tasks_completed: 2
  files_modified: 1
---

# Quick Task 64: fix SCBD-01/02/03 — propagate INT-04 --slot/--model-id fix from quorum.md Mode B to qgsd-quorum-orchestrator.md Mode A scoreboard block

Committed debug.md backtick cleanup and ran install sync to propagate the already-committed orchestrator --slot/--model-id fix to the installed copy at ~/.claude/agents/.

## Objective

SCBD-01/02/03 require that the scoreboard writes to data.slots{} using composite key `<slot>:<model-id>`. The orchestrator Mode A fix was already committed (agents/qgsd-quorum-orchestrator.md). This task finalised the remaining work: committed the pending debug.md backtick cleanup and synced the installed copy.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Commit debug.md backtick cleanup | 8f86abe | commands/qgsd/debug.md |
| 2 | Install sync | (no new commit — installed files are gitignored) | ~/.claude/agents/qgsd-quorum-orchestrator.md |

## Verification Results

1. `grep -n "\-\-slot" agents/qgsd-quorum-orchestrator.md` — hits at lines 93, 244, 254, 291, 301 in Mode A scoreboard block: PASS
2. `grep -n "\-\-slot" ~/.claude/agents/qgsd-quorum-orchestrator.md` — same hits in installed copy: PASS
3. `grep -n "derive the key" agents/qgsd-quorum-orchestrator.md` — no results (deprecated language removed): PASS
4. `git status --short -- commands/qgsd/debug.md` — empty (file is clean): PASS

## Success Criteria Met

- [x] Orchestrator Mode A scoreboard block instructs --slot + --model-id for claude-mcp servers (already committed at HEAD before this task)
- [x] Orchestrator Mode A still instructs --model for native CLI agents (already committed)
- [x] Deprecated "derive key from health_check model field" language removed from orchestrator (already committed)
- [x] Installed ~/.claude/agents/qgsd-quorum-orchestrator.md reflects the fix (propagated by install sync in Task 2)
- [x] Backtick cleanup change in debug.md committed (Task 1, commit 8f86abe)
- [x] SCBD-01, SCBD-02, SCBD-03 fully satisfied: primary execution path (Mode A) writes to data.slots{} via composite key <slot>:<model-id>

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Verified

- commands/qgsd/debug.md: clean after commit 8f86abe
- ~/.claude/agents/qgsd-quorum-orchestrator.md: contains --slot (lines 93, 244, 254, 291, 301)
- agents/qgsd-quorum-orchestrator.md: source has --slot fix (committed prior to this task)

### Commits Verified

- 8f86abe: fix(quick-64): remove backtick wrapping from $ARGUMENTS in debug.md — FOUND

## Self-Check: PASSED
