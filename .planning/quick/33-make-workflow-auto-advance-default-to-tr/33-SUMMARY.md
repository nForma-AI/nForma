---
phase: quick-33
plan: 33
subsystem: workflow-config
tags: [auto_advance, yolo, config, workflow, gsd-tools]
dependency_graph:
  requires: []
  provides: [auto_advance default true across all workflows]
  affects: [execute-phase.md, plan-phase.md, discuss-phase.md, transition.md, gsd-tools.cjs, templates/config.json]
tech_stack:
  added: []
  patterns: [config default override, shell fallback value]
key_files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/workflows/execute-phase.md
    - get-shit-done/workflows/plan-phase.md
    - get-shit-done/workflows/discuss-phase.md
    - get-shit-done/workflows/transition.md
    - get-shit-done/templates/config.json
    - .planning/config.json
decisions:
  - "auto_advance default changed to true so YOLO mode is on by default without explicit config entry"
  - "Project .planning/config.json updated to reflect new default (auto_advance: true)"
  - "transition.md milestone boundary no longer resets auto_advance to false"
metrics:
  duration: "3 min"
  completed: "2026-02-21T22:59:22Z"
  tasks_completed: 3
  files_modified: 7
---

# Quick-33: Make workflow.auto_advance Default to True Summary

**One-liner:** Set auto_advance default to true in loadConfig defaults, all 4 shell fallbacks across 3 workflow files, and config template — YOLO mode on by default.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add auto_advance default to loadConfig in gsd-tools.cjs | e177dc8 | gsd-tools.cjs, .planning/config.json |
| 2 | Flip all echo "false" fallbacks in workflow files | e1103cb | execute-phase.md, plan-phase.md, discuss-phase.md |
| 3 | Remove auto_advance=false reset from transition.md + fix config.json template | 3a64716 | transition.md, templates/config.json |

## Verification Results

1. `config-get workflow.auto_advance` → `true` (PASS)
2. `grep -c 'echo "false"' execute-phase.md` → `0` (PASS)
3. `grep "auto_advance false" transition.md` → not found (PASS)
4. `grep "auto_advance" templates/config.json` → `"auto_advance": true` (PASS)

## Changes Made

### gsd-tools.cjs — loadConfig() defaults

Added `auto_advance: true` to the `defaults` object and added `auto_advance` getter to the returned config object:

```js
auto_advance: get('auto_advance', { section: 'workflow', field: 'auto_advance' }) ?? defaults.auto_advance,
```

### Workflow shell fallbacks (4 occurrences across 3 files)

Changed `|| echo "false"` to `|| echo "true"` in:
- `execute-phase.md` line 227 (checkpoint handling)
- `execute-phase.md` line 462 (offer_next section)
- `plan-phase.md` line 361 (offer_next section)
- `discuss-phase.md` line 508 (auto_advance step)

### transition.md — removed milestone reset

Removed the "Clear auto-advance" block that ran `config-set workflow.auto_advance false` at milestone boundaries. YOLO mode now persists across milestone transitions.

### templates/config.json

Changed `"auto_advance": false` to `"auto_advance": true`.

### .planning/config.json (project config)

Updated QGSD project config from `false` to `true` to reflect the new default behavior.

## Installed Files Updated (Disk-Only)

- `~/.claude/qgsd/bin/gsd-tools.cjs` — copied from source
- `~/.claude/qgsd/workflows/execute-phase.md` — copied from source
- `~/.claude/qgsd/workflows/plan-phase.md` — copied from source
- `~/.claude/qgsd/workflows/discuss-phase.md` — copied from source
- `~/.claude/qgsd/workflows/transition.md` — copied from source

## Deviations from Plan

**1. [Rule 2 - Missing] Updated .planning/config.json to reflect new default**
- **Found during:** Task 1 verification
- **Issue:** Project config.json had `"auto_advance": false` explicitly, causing `config-get workflow.auto_advance` to return `false` despite the loadConfig default change
- **Fix:** Updated `.planning/config.json` workflow.auto_advance from `false` to `true`
- **Files modified:** `.planning/config.json`
- **Commit:** e177dc8 (included in Task 1 commit)

## Self-Check: PASSED

Files exist:
- FOUND: get-shit-done/bin/gsd-tools.cjs
- FOUND: get-shit-done/workflows/execute-phase.md
- FOUND: get-shit-done/workflows/plan-phase.md
- FOUND: get-shit-done/workflows/discuss-phase.md
- FOUND: get-shit-done/workflows/transition.md
- FOUND: get-shit-done/templates/config.json

Commits exist:
- FOUND: e177dc8
- FOUND: e1103cb
- FOUND: 3a64716
