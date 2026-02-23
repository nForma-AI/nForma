---
phase: quick-75
plan: 01
subsystem: mcp-status
tags: [sequential, sibling-tool-call, mcp-status, install-sync]
dependency_graph:
  requires: []
  provides: [sequential-bash-guard-in-mcp-status]
  affects: [commands/qgsd/mcp-status.md]
tech_stack:
  added: []
  patterns: [sequential-bash-calls, explicit-instruction-guards]
key_files:
  created: []
  modified:
    - commands/qgsd/mcp-status.md
decisions:
  - "Added IMPORTANT top-of-process note and per-step sequential labels to prevent parallel bash call cascade failures"
metrics:
  duration: "~3 min"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 1
---

# Phase quick-75 Plan 01: Isolate Each Calls to Avoid Sibling Tool Call Errored - Summary

**One-liner:** Added sequential-call guards (IMPORTANT top-note + per-step headers) to mcp-status.md Steps 1/2/3 to prevent sibling bash call cascade failures; installed copy synced via install script.

## What Was Built

The `mcp-status` skill document already had a sequential instruction on Step 5 (CLI identity calls), but Steps 1, 2, and 3 (the three bash data-gathering calls) were unguarded. When Claude Code issues parallel bash calls and one fails, it marks all siblings as errored — this meant a single failure in a node -e inline script could silently wipe out scoreboard reads, provider info, and endpoint probes simultaneously.

The fix adds two layers of protection:

1. **Top-of-process IMPORTANT note** — a blockquote at the top of the `<process>` section that explicitly prohibits parallel bash calls and explains why (sibling cancellation behavior).
2. **Per-step sequential labels** — each of Steps 1, 2, and 3 now carries an explicit "(sequential — run this bash call N, ...)" label matching the pattern already established in Step 5.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add sequential-call guard to Steps 1, 2, and 3 | 9a348a0 | commands/qgsd/mcp-status.md |
| 2 | Sync installed copy via install script | (no repo change — installed to ~/.claude/commands/qgsd/mcp-status.md) | installed copy |

## Verification

- `grep -c "sequential" commands/qgsd/mcp-status.md` → **5** (IMPORTANT note + Steps 1, 2, 3, 5)
- `grep -c "sequential" ~/.claude/commands/qgsd/mcp-status.md` → **5** (installed copy in sync)
- Bash script content for each step is unchanged (pure instruction text change, no logic regression)

## Deviations from Plan

None - plan executed exactly as written.

**Note on Task 2:** The install script correctly copied the updated file. The installed copy is at `~/.claude/commands/qgsd/mcp-status.md` (not `~/.claude/qgsd/commands/qgsd/mcp-status.md` as listed in the plan — the actual install layout puts commands directly in `~/.claude/commands/`). The sequential count of 5 is confirmed at the correct installed path.

## Self-Check

- [x] `commands/qgsd/mcp-status.md` exists and contains 5 "sequential" occurrences
- [x] `~/.claude/commands/qgsd/mcp-status.md` exists and contains 5 "sequential" occurrences
- [x] Task 1 commit `9a348a0` exists in git log
- [x] No bash script logic was modified (only heading text changed)

## Self-Check: PASSED
