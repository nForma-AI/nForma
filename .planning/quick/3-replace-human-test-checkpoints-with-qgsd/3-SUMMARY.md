---
phase: quick-3
plan: 01
subsystem: commands/qgsd
tags: [quorum, debug, test-verification, checkpoints]
dependency_graph:
  requires: [commands/qgsd/quorum-test.md]
  provides: [commands/qgsd/debug.md, updated checkpoint annotations]
  affects: [.planning/phases/02-config-mcp-detection/02-04-PLAN.md, .planning/phases/01-hook-enforcement/01-05-PLAN.md]
tech_stack:
  added: []
  patterns: [parallel-task-dispatch, quorum-workers, artifact-save]
key_files:
  created: [commands/qgsd/debug.md]
  modified:
    - .planning/phases/02-config-mcp-detection/02-04-PLAN.md
    - .planning/phases/01-hook-enforcement/01-05-PLAN.md
decisions:
  - "/qgsd:debug overwrites gsd:debug entirely — same file path, new command name and quorum-augmented behavior"
  - "01-05 live-session checkpoint annotated but not replaced — Test A/B/C/D require a running Claude Code session and cannot be automated with quorum-test"
  - "02-04 Check 1+2 prepend automated path before manual fallback — preserves backward compat for manual runs"
metrics:
  duration: 2 min
  completed: 2026-02-21
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 3: Replace Human Test Checkpoints with QGSD Summary

**One-liner:** Quorum-test references added to phase plan test checkpoints, and gsd:debug replaced with qgsd:debug — a 4-model parallel quorum loop that votes on root cause and next debugging step before any investigation begins.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update human test checkpoints to reference /qgsd:quorum-test | a20ddea | 02-04-PLAN.md, 01-05-PLAN.md |
| 2 | Create /qgsd:debug command | 8a1f5df | commands/qgsd/debug.md |

## What Was Built

**Task 1:** Two existing human-verify checkpoints now direct test verification through `/qgsd:quorum-test`:
- `02-04-PLAN.md` Check 1 (config-loader.test.js) and Check 2 (qgsd-stop.test.js) each have an "Automated via /qgsd:quorum-test" block prepended, with manual fallback preserved.
- `01-05-PLAN.md` Task 2 (live integration) received a comment annotation: `<!-- Unit test coverage for hook logic: use /qgsd:quorum-test hooks/qgsd-stop.test.js — this checkpoint verifies live session behavior only -->`. The Test A/B/C/D steps were not changed because they verify live Claude Code session behavior, not test runner output.

**Task 2:** `commands/qgsd/debug.md` is now the `/qgsd:debug` command:
- Collects failure context from `$ARGUMENTS` and/or fresh test run output
- Reads up to 3 most relevant source files from the error trace
- Assembles a bundle (failure context + exit code + test output + source context)
- Dispatches 4 parallel Task workers: Gemini, OpenCode, Copilot, Codex
- Each worker returns `root_cause:`, `next_step:`, `confidence:` lines only — no fixes
- Determines consensus: 3+ workers agree → consensus; otherwise lists all recommendations
- Renders a NEXT STEP table with consensus row
- Saves artifact to `.planning/quick/quorum-debug-latest.md`
- Prompts user to apply the step and run `/qgsd:debug` again

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

- **gsd:debug replaced by qgsd:debug:** The task spec explicitly overwrites the existing file at `commands/qgsd/debug.md`. The underlying `agents/gsd-debugger.md` agent is unchanged — `/qgsd:debug` is a quorum consultation step, not a replacement for the full autonomous debugger.
- **01-05 live-session checkpoint: annotation only:** Tests A/B/C/D require an active Claude Code session with real hook firing. These cannot be automated by `quorum-test` (which runs `node --test`). The annotation communicates where quorum-test applies without replacing genuinely live verification steps.
- **02-04 manual fallback preserved:** The `node --test` commands were not removed from Check 1 and Check 2. The quorum-test path is prepended as the recommended path; the manual fallback remains for environments where quorum workers are unavailable.

## Self-Check: PASSED

All files verified present. All commits verified in git log.

| Item | Status |
|------|--------|
| commands/qgsd/debug.md | FOUND |
| .planning/phases/02-config-mcp-detection/02-04-PLAN.md | FOUND |
| .planning/phases/01-hook-enforcement/01-05-PLAN.md | FOUND |
| commit a20ddea | FOUND |
| commit 8a1f5df | FOUND |
