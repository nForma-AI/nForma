---
id: "21"
slug: fix-qgsd-gaps-add-copilot-to-required-mo
phase: quick
plan: "21"
subsystem: hooks
tags: [quorum, copilot, config, enforcement, workflow]
dependency_graph:
  requires: []
  provides: [copilot-quorum-enforcement, quick-quorum-enforcement, step-5-7-workflow]
  affects: [hooks/config-loader.js, hooks/qgsd-stop.js, hooks/qgsd-prompt.js, get-shit-done/workflows/quick.md]
tech_stack:
  added: []
  patterns: [deriveMissingToolName copilot case, quorum_commands quick entry, Step 5.7 sequential quorum gate]
key_files:
  modified:
    - hooks/config-loader.js
    - hooks/qgsd-stop.js
    - hooks/qgsd-prompt.js
    - hooks/dist/config-loader.js
    - hooks/dist/qgsd-stop.js
    - hooks/dist/qgsd-prompt.js
    - get-shit-done/workflows/quick.md
    - hooks/config-loader.test.js
    - hooks/qgsd-stop.test.js
decisions:
  - "Copilot tool name derived as prefix+'ask' (mcp__copilot-cli__ask) — consistent with CLAUDE.md Appendix table; deriveMissingToolName extended with explicit case before generic fallback"
  - "Step 5.7 placed between plan-checker loop and Step 6 executor spawn — MANDATORY regardless of --full mode per R3.1; fail-open on unavailable models"
  - "dist/ rebuild via npm run build:hooks (existing build script); installed to ~/.claude/hooks/ (actual location, not ~/.claude/qgsd/hooks/ which does not exist)"
metrics:
  duration: "3 min"
  completed_date: "2026-02-21"
  tasks: 3
  files_modified: 9
---

# Quick Task 21: Fix QGSD Gaps — Add Copilot to Required Models Summary

**One-liner:** Closes three enforcement gaps: Copilot added to required_models + deriveMissingToolName, 'quick' added to quorum_commands, Step 5.7 sequential quorum gate inserted into quick.md workflow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Copilot to required_models, quick to quorum_commands, fix deriveMissingToolName, update prompt fallback, update tests | 3498850 | hooks/config-loader.js, hooks/qgsd-stop.js, hooks/qgsd-prompt.js, hooks/config-loader.test.js, hooks/qgsd-stop.test.js |
| 2 | Add Step 5.7 quorum review to quick.md workflow | f8641e3 | get-shit-done/workflows/quick.md |
| 3 | Rebuild dist/ and sync all changed files to installed location | 3306a9e | hooks/dist/config-loader.js, hooks/dist/qgsd-stop.js, hooks/dist/qgsd-prompt.js |

## Changes Made

### Gap 1: Copilot missing from required_models (hooks/config-loader.js)

Added to `DEFAULT_CONFIG.required_models`:
```js
copilot:  { tool_prefix: 'mcp__copilot-cli__', required: true },
```

### Gap 1b: deriveMissingToolName missing copilot case (hooks/qgsd-stop.js)

Added before the generic fallback:
```js
if (modelKey === 'copilot') return prefix + 'ask';
```

Without this, the block reason would name `mcp__copilot-cli__copilot` instead of `mcp__copilot-cli__ask`, misleading Claude about which tool to call.

### Gap 1c: Prompt fallback missing Copilot (hooks/qgsd-prompt.js)

DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK updated: added step 4 for `mcp__copilot-cli__ask`; old steps 4-5 renumbered to 5-6.

### Gap 2: 'quick' missing from quorum_commands (hooks/config-loader.js)

Added 'quick' to `DEFAULT_CONFIG.quorum_commands`. Stop hook and prompt hook will now trigger for `/qgsd:quick` planning turns.

### Gap 2b: quick.md missing quorum step (get-shit-done/workflows/quick.md)

Inserted Step 5.7 between plan-checker loop and Step 6 (executor spawn):
- MANDATORY regardless of `--full` mode (R3.1 requires quorum for any planning output)
- Sequential tool calls required (R3.2 — separate calls, never sibling)
- Fail-open on UNAVAILABLE models
- On APPROVE: include `<!-- GSD_DECISION -->` marker, proceed to Step 6
- On BLOCK: report to user, do not execute

### Gap dist: hooks/dist/ not rebuilt (hooks/dist/)

`npm run build:hooks` ran to regenerate all dist files. Three files updated: config-loader.js, qgsd-stop.js, qgsd-prompt.js.

### Gap tests: Test assertions not covering Copilot

- **config-loader.test.js TC9**: added assertions for `DEFAULT_CONFIG.required_models.copilot` and `'quick'` in `quorum_commands`
- **qgsd-stop.test.js TC-COPILOT**: new test verifies block reason names `mcp__copilot-cli__ask` (not `mcp__copilot-cli__copilot`) when copilot is the only missing required model

## Test Results

All 42 tests pass (41 pre-existing + 1 new TC-COPILOT):
```
ℹ tests 42
ℹ pass 42
ℹ fail 0
ℹ duration_ms 1301.030959
```

## Installed Location Discovery

The plan specified syncing to `~/.claude/qgsd/hooks/` which does not exist. The actual installed hooks location is `~/.claude/hooks/`. All three hook files synced correctly to `~/.claude/hooks/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Installed hooks path discovery**
- **Found during:** Task 3
- **Issue:** Plan specified `~/.claude/qgsd/hooks/` as installed location but that directory does not exist; actual installed location is `~/.claude/hooks/`
- **Fix:** Synced to `~/.claude/hooks/` instead; quick.md synced to `~/.claude/qgsd/workflows/` as planned (that path is correct)
- **Files modified:** ~/.claude/hooks/config-loader.js, ~/.claude/hooks/qgsd-stop.js, ~/.claude/hooks/qgsd-prompt.js (not tracked in repo)
- **Impact:** None — correct files installed to correct location

## Self-Check: PASSED

- FOUND: hooks/config-loader.js
- FOUND: hooks/qgsd-stop.js
- FOUND: hooks/qgsd-prompt.js
- FOUND: hooks/dist/config-loader.js
- FOUND: hooks/dist/qgsd-stop.js
- FOUND: get-shit-done/workflows/quick.md
- FOUND: hooks/config-loader.test.js
- FOUND: hooks/qgsd-stop.test.js
- Commits 3498850, f8641e3, 3306a9e confirmed in git log
- 42/42 tests pass
