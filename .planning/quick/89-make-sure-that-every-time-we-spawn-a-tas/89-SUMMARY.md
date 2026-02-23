---
phase: quick-89
plan: 89
subsystem: workflows
tags: [task-spawning, description, sub-agents, ux]
requires: []
provides: [description-on-all-task-spawns]
affects: [execute-phase, execute-plan, research-phase, audit-milestone, settings, model-profile-resolution]
tech-stack:
  added: []
  patterns: [task-description-parameter]
key-files:
  created: []
  modified:
    - /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md
    - /Users/jonathanborduas/.claude/qgsd/workflows/settings.md
    - /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/execute-plan.md
    - get-shit-done/workflows/research-phase.md
    - get-shit-done/workflows/audit-milestone.md
    - get-shit-done/workflows/settings.md
    - get-shit-done/references/model-profile-resolution.md
key-decisions:
  - "Edit both installed files (~/.claude/qgsd/) and source files (get-shit-done/) to keep them in sync; only source files committed to git"
  - "Inline prose Task() references in execute-phase.md and execute-plan.md updated to reflect description= even though they are not real code blocks"
decisions: []
requirements: []
duration: ~5 min
completed: 2026-02-23
---

# Quick Task 89: Add description= to All Task() Spawns — Summary

Added `description=` parameter to all 8 Task() blocks across 6 QGSD workflow and reference files so every sub-agent spawn is labeled with a meaningful identifier in the Claude Code UI and activity log.

## What Was Done

Ran the paren-tracking audit script which identified 7 Task() blocks missing `description=` across the 6 target files. Applied targeted edits to each location:

| File | Location | Description Added |
|------|----------|-------------------|
| execute-phase.md | Executor Task (~line 110) | `"Execute plan {plan_number}: {phase_number}-{phase_name}"` |
| execute-phase.md | Inline prose (~line 200) | `description="Execute quick task {task_number}: {slug}"` in sentence |
| execute-phase.md | Verifier Task (~line 368) | `"Verify phase {phase_number}"` |
| execute-plan.md | Pattern A prose (~line 69) | `description="Execute plan {plan_number}: {phase_number}-{phase_name}"` in inline example |
| research-phase.md | Researcher Task (~line 44) | `"Research phase {phase}: {name}"` |
| audit-milestone.md | Integration-checker Task (~line 80) | `"Audit milestone: integration check"` |
| settings.md | Task() string reference (~line 83) | Updated string to mention `description= set per agent` |
| model-profile-resolution.md | Example Task block (~line 20) | `"[descriptive label for this sub-agent]"` |

Note: the quorum-orchestrator Task in execute-phase.md (~line 402) already had `description=` and was not modified.

Both the installed files at `~/.claude/qgsd/` and the source files at `get-shit-done/` were updated. Only the source files are tracked in git.

## Verification

Ran the paren-tracking Python audit script after all edits. Output:

```
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md:110
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md:368
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md:404
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md:69
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md:44
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md:80
OK:      /Users/jonathanborduas/.claude/qgsd/workflows/settings.md:83
OK:      /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md:20
PASS: all Task() blocks have description=
```

Script exited 0. All 8 Task() blocks show OK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source files also needed the same edits**
- **Found during:** Task 1 (commit step)
- **Issue:** Plan only mentioned editing `~/.claude/qgsd/` installed files. The `get-shit-done/` source files in the QGSD git repo are the canonical source and also needed the same changes.
- **Fix:** Applied identical edits to all 6 corresponding source files at `get-shit-done/workflows/` and `get-shit-done/references/`. Only the source files were committed to git (the installed copies at `~/.claude/qgsd/` are not tracked).
- **Files modified:** 6 source files in `get-shit-done/` directory
- **Commit:** d33fa43

## Self-Check: PASSED

- Installed files edited: `~/.claude/qgsd/workflows/execute-phase.md`, `execute-plan.md`, `research-phase.md`, `audit-milestone.md`, `settings.md`, `~/.claude/qgsd/references/model-profile-resolution.md` — all confirmed modified
- Source files committed: `d33fa43` — git log confirms commit exists
- Audit script exits 0: PASS: all Task() blocks have description=
- Previously-correct files (fix-tests.md, quick.md, etc.) not modified — confirmed by `git diff --name-only`
