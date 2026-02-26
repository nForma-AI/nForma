---
phase: quick-112
plan: 01
subsystem: quorum-dispatcher
tags: [failure-logging, observability, health-check, quorum]
dependency_graph:
  requires: []
  provides: [quorum-failures-log, health-failure-surfacing]
  affects: [bin/call-quorum-slot.cjs, bin/check-provider-health.cjs]
tech_stack:
  added: []
  patterns: [upward-dir-walk, upsert-json-log, module-level-helper-function]
key_files:
  created: []
  modified:
    - bin/call-quorum-slot.cjs
    - bin/check-provider-health.cjs
    - .gitignore
decisions:
  - "printQuorumFailures() extracted as module-level function (not inlined in main()) to handle both early-exit and normal-exit code paths in check-provider-health.cjs"
  - "Color helpers redefined with f-prefix (fYellow, fRed, etc.) in printQuorumFailures() since the existing helpers are scoped inside the else block in main()"
  - "quorum-failures.json gitignored as disk-only runtime artifact, same pattern as quorum-scoreboard.json"
metrics:
  duration: "~5 min"
  completed: "2026-02-26"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 112: Add Quorum Slot-Worker Failure Log and Health Surfacing

**One-liner:** Persistent structured failure log in `.planning/quorum-failures.json` written by `call-quorum-slot.cjs` on non-zero exit, with recurring-pattern WARN surfaced in `check-provider-health.cjs` when count >= 3.

## What Was Built

### Task 1 — writeFailureLog() in call-quorum-slot.cjs

Added `findProjectRoot()` (upward walk from `__dirname` looking for `.planning/`) and `writeFailureLog(slot, errorMsg, stderrText)` to `bin/call-quorum-slot.cjs`.

`writeFailureLog` classifies the error into one of four `error_type` values:
- `CLI_SYNTAX` — matches usage/flag/option/unrecognized patterns
- `TIMEOUT` — matches TIMEOUT
- `AUTH` — matches 401/403/unauthorized/forbidden
- `UNKNOWN` — everything else

Records are upserted by `(slot, error_type)` — repeated failures increment `count` and update `last_seen` rather than creating duplicates.

Called in two places:
1. Main catch block (line ~360) — before the existing `process.exit(1)`
2. Unknown-provider-type branch — before `process.exit(1)`

The entire function body is wrapped in try/catch so failure logging never interrupts the primary dispatch flow.

### Task 2 — Recurring failure surfacing in check-provider-health.cjs + gitignore

Added `printQuorumFailures()` as a module-level function in `bin/check-provider-health.cjs`. It:
- Reads `.planning/quorum-failures.json` (located via `findProjectRoot()`)
- Groups records by `(slot, error_type)`
- Emits a yellow WARN line per pair where `count >= 3`, with the pattern and a type-specific hint
- Silently skips if the file is missing or unparseable
- Is called at both the early-exit path (no HTTP providers configured) and at normal `process.exit()`

Added `.planning/quorum-failures.json` to `.gitignore` in the "Internal planning documents" block.

## Verification

End-to-end smoke test passed:
1. `echo "test" | node bin/call-quorum-slot.cjs --slot codex-1 --timeout 1` → created `quorum-failures.json` with `count: 1`
2. Two more runs → `count: 3`
3. `node bin/check-provider-health.cjs` → WARN for `codex-1` TIMEOUT with hint about `timeout_ms`
4. `git status` → `quorum-failures.json` not tracked (gitignored)
5. `node --check bin/call-quorum-slot.cjs` → SYNTAX OK
6. `node --check bin/check-provider-health.cjs` → SYNTAX OK

Below-threshold test (count=2): no WARN emitted.
Missing file test: no crash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `printQuorumFailures()` extracted to module level to handle early-exit path**
- **Found during:** Task 2 implementation
- **Issue:** `check-provider-health.cjs` has a module-level early `process.exit(0)` when no HTTP providers are configured. Placing the failure section only inside `main()` would silently skip it in that case.
- **Fix:** Extracted the failure printing logic into a module-level `printQuorumFailures()` function called at both the early-exit and normal-exit paths.
- **Files modified:** `bin/check-provider-health.cjs`

## Commits

- `7daa16c` feat(quick-112): add writeFailureLog() to call-quorum-slot.cjs
- `3777c21` feat(quick-112): surface recurring slot failures in check-provider-health.cjs

## Self-Check: PASSED

Files verified:
- bin/call-quorum-slot.cjs — modified (writeFailureLog + findProjectRoot added)
- bin/check-provider-health.cjs — modified (printQuorumFailures + findProjectRoot added)
- .gitignore — modified (.planning/quorum-failures.json added)
Commits verified: 7daa16c and 3777c21 present in git log.
