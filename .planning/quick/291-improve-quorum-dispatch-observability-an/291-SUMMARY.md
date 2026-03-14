---
phase: quick-291
plan: 01
subsystem: quorum-dispatch
tags: [observability, health-probe, preflight, error-classification, slot-filtering]
dependency_graph:
  requires: [bin/quorum-preflight.cjs, bin/call-quorum-slot.cjs]
  provides: [runPreflightFilter, classifyDispatchError, NF_ALL_SLOTS_DOWN short-circuit]
  affects: [hooks/nf-prompt.js, bin/quorum-slot-dispatch.cjs]
tech_stack:
  added: []
  patterns: [fail-open error handling, NF_SKIP_PREFLIGHT env var for test isolation, spawnSync preflight probe, error type classification via regex]
key_files:
  modified:
    - hooks/nf-prompt.js
    - bin/quorum-slot-dispatch.cjs
    - hooks/nf-prompt.test.js
    - bin/quorum-slot-dispatch.test.cjs
decisions:
  - "Use NF_SKIP_PREFLIGHT=1 env var to bypass preflight probes in tests, set as default in runHook()"
  - "Remove getDownProviderSlots() and triggerHealthProbe() entirely — superseded by runPreflightFilter()"
  - "allDown short-circuit only fires when ALL slots in cappedSlots fail preflight AND cappedSlots is non-empty"
  - "error_type emitted as YAML field in emitResultBlock only when provided (non-UNAVAIL callers unaffected)"
metrics:
  duration: ~5 minutes
  completed: 2026-03-14
  tasks_completed: 3
  files_modified: 4
---

# Quick Task 291: Improve Quorum Dispatch Observability and Eliminate Wasteful Fallback Cascades — Summary

**One-liner:** Replaced per-provider health cache reads with two-layer quorum-preflight.cjs probes for CLI slot filtering, added NF_ALL_SLOTS_DOWN short-circuit, and classified UNAVAIL error types in result blocks.

## What Was Done

### Task 1: Preflight-based slot filtering in nf-prompt.js (commit: afe1fe5a)

Replaced `triggerHealthProbe()` (which ran `check-provider-health.cjs` via spawnSync to populate a cache) and `getDownProviderSlots()` (which read that cache and matched hostnames) with a single `runPreflightFilter(slots)` function that:

- Runs `quorum-preflight.cjs --all` (Layer 1 binary probe + Layer 2 upstream API probe) via spawnSync with 6s timeout
- Parses the `available_slots` and `unavailable_slots` JSON from preflight output
- Keeps a slot if it is in `available_slots` OR if preflight did not probe it at all (unprobed slots, like claude-*, pass through)
- Removes slots explicitly listed in `unavailable_slots`
- Returns `{ filteredSlots, allDown, unavailableSlots }` with fail-open on any error

Added all-down short-circuit: when `allDown === true` and `orderedSlots.length > 0`, the hook emits `<!-- NF_ALL_SLOTS_DOWN -->` with a summary of failed probes and exits immediately, bypassing the full FALLBACK-01 cascade.

Updated the skip note in dispatch instructions to use `preflightResult.unavailableSlots` instead of the old provider cache data.

Added `NF_SKIP_PREFLIGHT=1` env var to bypass the probe for fast test runs.

### Task 2: Enhanced UNAVAIL result block in quorum-slot-dispatch.cjs (commit: b5b6143e)

Added `classifyDispatchError(output)` helper function that classifies raw output from failed dispatch into:
- `TIMEOUT` — output contains "TIMEOUT"
- `AUTH` — output contains 401/403/unauthorized/forbidden
- `QUOTA` — output contains 402/quota/rate-limit
- `SPAWN_ERROR` — output contains "spawn error"
- `CLI_SYNTAX` — output contains usage/unknown flag/unrecognized
- `UNKNOWN` — catch-all for unrecognized patterns

Updated the UNAVAIL block reasoning from the hardcoded `'Bash call failed or timed out.'` to `UNAVAIL (${type}): ${output.slice(0, 200)}`.

Added optional `error_type` field to `emitResultBlock()` — emitted as a YAML line `error_type: TIMEOUT` after `verdict:` when provided. All existing callers that omit `error_type` are unaffected.

Exported `classifyDispatchError` from module.exports for unit testing.

### Task 3: Tests + sync + reinstall (commit: 57a82371)

**nf-prompt.test.js:**
- Updated `runHook()` default env to include `NF_SKIP_PREFLIGHT=1` to prevent real CLI probes from causing test timeouts (auto-fixed 2 pre-existing test failures caused by the new preflight probe)
- Added TC-PREFLIGHT-1: verifies fail-open path produces QUORUM REQUIRED dispatch, not NF_ALL_SLOTS_DOWN
- Added TC-PREFLIGHT-2: verifies NF_SKIP_PREFLIGHT=0 with real preflight does not crash (12s timeout)

**quorum-slot-dispatch.test.cjs:**
- Added `classifyDispatchError` export test
- Added TC-DISPATCH-UNAVAIL-1 through 9: unit tests for all 6 error type classifications, `emitResultBlock` error_type emission, and the 200-char reasoning excerpt format

**Sync and reinstall:**
- `cp hooks/nf-prompt.js hooks/dist/nf-prompt.js` (hooks/dist is gitignored, sync done but not committed)
- `node bin/install.js --claude --global` installed updated hook
- Verified: `~/.claude/hooks/nf-prompt.js` contains `runPreflightFilter` (2 occurrences) and `NF_ALL_SLOTS_DOWN`

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| hooks/nf-prompt.test.js | 28 | 28 | 0 |
| bin/quorum-slot-dispatch.test.cjs | 59 | 59 | 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 2 test timeouts caused by new preflight probe**
- **Found during:** Task 1 verification
- **Issue:** TC-PROMPT-N-CAP and TC-PROMPT-FALLBACK-AUTHTYPE-DYNAMIC failed at 5000ms timeout because `runPreflightFilter` spawns `quorum-preflight.cjs --all` which tries to probe real CLI binaries (gemini, opencode, copilot etc.) that exist in system PATH and take >5s to respond
- **Fix:** Added `NF_SKIP_PREFLIGHT=1` env var support to `runPreflightFilter` and set it as default in `runHook()` test helper. Tests that explicitly test the preflight path use `NF_SKIP_PREFLIGHT: '0'` in extraEnv.
- **Files modified:** hooks/nf-prompt.js, hooks/nf-prompt.test.js
- **Commit:** afe1fe5a (included in Task 1 commit)

## Self-Check: PASSED

- hooks/nf-prompt.js: FOUND
- bin/quorum-slot-dispatch.cjs: FOUND
- 291-SUMMARY.md: FOUND
- commit afe1fe5a: FOUND
- commit b5b6143e: FOUND
- commit 57a82371: FOUND
