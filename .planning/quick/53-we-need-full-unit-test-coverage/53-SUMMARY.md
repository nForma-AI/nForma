---
phase: quick-53
plan: 01
subsystem: testing
tags: [unit-tests, qgsd-prompt, update-scoreboard, node-test-runner]
dependency_graph:
  requires: []
  provides: [hooks/qgsd-prompt.test.js, bin/update-scoreboard.test.cjs]
  affects: [package.json]
tech_stack:
  added: []
  patterns: [process-spawn-testing, node-built-in-test-runner, temp-dir-isolation]
key_files:
  created:
    - hooks/qgsd-prompt.test.js
    - bin/update-scoreboard.test.cjs
  modified:
    - package.json
decisions:
  - "Process-spawn pattern (spawnSync) used for both test files — avoids process.exit() contamination and mirrors existing qgsd-stop.test.js convention"
  - "UNAVAIL output format corrected: actual CLI prints UNAVAIL (+0) not UNAVAIL (0) — test assertion updated to match production behavior"
metrics:
  duration: ~8min
  completed: 2026-02-22
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase quick-53: we need full unit test coverage - Summary

**One-liner:** Process-spawn test suites for qgsd-prompt.js (10 tests) and update-scoreboard.cjs (15 tests) wired into npm test, raising total to 226 green tests.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Write hooks/qgsd-prompt.test.js | a4fca13 | Done |
| 2 | Write bin/update-scoreboard.test.cjs | 63ca73f | Done |
| 3 | Wire new test files into npm test | 76b24b5 | Done |

## Verification

```
npm test
ℹ tests 226
ℹ pass 226
ℹ fail 0
```

## What Was Built

### hooks/qgsd-prompt.test.js (10 tests)

Process-spawn tests covering all non-trivial logic in qgsd-prompt.js:
- **TC1**: Non-planning command (`/qgsd:execute-phase`) exits 0 with no stdout (silent pass)
- **TC2**: `/qgsd:plan-phase` triggers quorum injection (additionalContext contains "QUORUM REQUIRED")
- **TC3**: `/gsd:plan-phase` (GSD prefix) also triggers injection (tests the `q?gsd:` regex prefix)
- **TC4**: `/qgsd:research-phase` triggers injection
- **TC5**: `/qgsd:verify-work` triggers injection
- **TC6**: `/qgsd:discuss-phase` triggers injection
- **TC7**: Malformed JSON stdin exits 0 with no output (fail-open path)
- **TC8**: `/qgsd:plan-phase-extra` does NOT trigger (word boundary `(\s|$)` enforced)
- **TC9**: Circuit breaker active (temp git repo + state file) injects "CIRCUIT BREAKER ACTIVE" context
- **TC10**: Circuit breaker with `disabled: true` produces no injection (silent pass)

### bin/update-scoreboard.test.cjs (15 tests)

CLI-spawn tests covering the scoreboard updater's pure functions and validation:
- **SC-TC1**: Missing args exits 1 with `--model is required` in stderr
- **SC-TC2**: Valid vote creates file and prints confirmation line
- **SC-TC3**: TP result → score +1
- **SC-TC4**: TN result → score +5
- **SC-TC5**: FP result → score -3
- **SC-TC6**: FN result → score -1
- **SC-TC7**: TP+ result → score +3
- **SC-TC8**: Second vote on same task+round updates existing entry (no duplicate, `rounds.length === 1`)
- **SC-TC9**: Second vote on different round appends new entry (`rounds.length === 2`)
- **SC-TC10**: Cumulative recompute — two TP votes across rounds gives `models.claude.score === 2`
- **SC-TC11**: Invalid `--model` value exits 1
- **SC-TC12**: Invalid `--result` value exits 1
- **SC-TC13**: UNAVAIL result keeps score at 0, prints `UNAVAIL (+0)`
- **SC-TC14**: `init-team` writes 16-char hex fingerprint to scoreboard
- **SC-TC15**: `init-team` idempotent — second call with same args outputs "no change"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UNAVAIL output format mismatch**
- **Found during:** Task 2 (SC-TC13 first run)
- **Issue:** Plan specified `stdout contains "UNAVAIL (0)"` but actual CLI output is `"UNAVAIL (+0)"` — the sign is always shown in the delta string
- **Fix:** Updated test assertion to `stdout.includes('UNAVAIL (+0)')` to match actual production code behavior
- **Files modified:** bin/update-scoreboard.test.cjs
- **Commit:** 63ca73f

## Self-Check: PASSED

- hooks/qgsd-prompt.test.js: FOUND
- bin/update-scoreboard.test.cjs: FOUND
- Commits a4fca13, 63ca73f, 76b24b5: all confirmed in git log
- npm test: 226 pass, 0 fail
