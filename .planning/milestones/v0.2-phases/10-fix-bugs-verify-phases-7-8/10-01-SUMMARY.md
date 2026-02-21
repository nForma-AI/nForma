---
phase: 10-fix-bugs-verify-phases-7-8
plan: "01"
subsystem: installer
tags: [bug-fix, uninstall, circuit-breaker, config, installer]
dependency_graph:
  requires: []
  provides: [INST-08, RECV-01, INST-10, CONF-09]
  affects: [bin/install.js, templates/qgsd.json]
tech_stack:
  added: []
  patterns: [git-root-resolution, sub-key-backfill, shallow-merge-docs]
key_files:
  created: []
  modified:
    - bin/install.js
    - templates/qgsd.json
decisions:
  - "PreToolUse removal in uninstall() mirrors existing Stop/UserPromptSubmit pattern exactly (filter on command string, delete empty array)"
  - "RECV-01 uses inline require('child_process') in the reset-breaker block — spawnSync not used elsewhere in install.js; inline require is safe and avoids scope pollution"
  - "INST-10 backfill uses === undefined (not falsy) to preserve user-set value of 0 (which validateConfig() will warn about at runtime — correct behavior)"
  - "CONF-09 placed in _comment after the existing required_models shallow merge paragraph for narrative flow"
metrics:
  duration: "2 min"
  completed: "2026-02-21"
  tasks: 3
  files_modified: 2
---

# Phase 10 Plan 01: Bug Fixes — INST-08, RECV-01, INST-10, CONF-09 Summary

**One-liner:** Three targeted installer bug fixes (uninstall dead hook, reset-breaker subdirectory, sub-key backfill) plus CONF-09 shallow merge documentation in qgsd.json template.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | INST-08: Fix uninstall() to remove PreToolUse circuit breaker hook | 169dd4b | bin/install.js |
| 2 | RECV-01: Fix --reset-breaker path resolution to use git root | 633e896 | bin/install.js |
| 3 | INST-10 + CONF-09: Sub-key backfill + shallow merge docs | b346ad3 | bin/install.js, templates/qgsd.json |

## What Was Built

### INST-08 — PreToolUse removal in uninstall()

Added a PreToolUse filter block in the `uninstall()` function of `bin/install.js` (lines 1109-1119) that removes the circuit breaker hook entry from `settings.hooks.PreToolUse`. The block follows the identical pattern used for Stop and UserPromptSubmit removal: filter on `h.command.includes('qgsd-circuit-breaker')`, log removal, delete empty array. Before this fix, uninstall left a dead PreToolUse entry pointing to the deleted `qgsd-circuit-breaker.js` file, causing Claude Code to emit hook errors on every Bash command.

### RECV-01 — git root resolution for --reset-breaker

Replaced the hardcoded `process.cwd()` in the `--reset-breaker` handler with a git-root-aware resolution via `spawnSync('git', ['rev-parse', '--show-toplevel'])`. Falls back to `process.cwd()` when git is unavailable (no regression). Before this fix, invoking `npx qgsd --reset-breaker` from a subdirectory would compute the wrong state file path and report "no active state" without actually clearing the breaker.

### INST-10 — Sub-key backfill for partial circuit_breaker config

Extended the INST-10 reinstall block from a top-level presence check to a two-step backfill. When `circuit_breaker` exists but is missing individual sub-keys (`oscillation_depth`, `commit_window`), the new `else` branch backfills only the absent sub-keys using `=== undefined` checks, preserving user-modified values. Before this fix, a user with `circuit_breaker: { oscillation_depth: 5 }` would not get `commit_window` backfilled on reinstall.

### CONF-09 — circuit_breaker shallow merge documentation

Added four lines to the `_comment` array in `templates/qgsd.json` after the existing `required_models` shallow merge paragraph. The new text explicitly documents that `circuit_breaker` uses the same shallow merge behavior, that `commit_window` falls back to the DEFAULT (not the global value) when a project config only sets `oscillation_depth`, and provides a concrete example showing how to set both sub-keys when overriding only one.

## Verification Results

- `grep -n "qgsd-circuit-breaker" bin/install.js`: Two occurrences — install section (line 1750, 1754) and uninstall section (line 1112). PASS.
- `grep -n "rev-parse\|projectRoot" bin/install.js`: `rev-parse --show-toplevel` and `projectRoot` appear in the reset-breaker handler. PASS.
- INST-10 sub-key checks: `oscillation_depth === undefined` and `commit_window === undefined` present. PASS.
- CONF-09 doc: `t._comment.some(line => line.includes('circuit_breaker') && line.includes('shallow'))` → true. PASS.
- `npm test`: 141 tests pass (0 failures). PASS.

## Deviations from Plan

None — plan executed exactly as written.

The plan noted npm test should show 138 tests; actual count was 141. This is not a regression — previous plans added 3 additional tests since the plan was written. All 141 pass.
