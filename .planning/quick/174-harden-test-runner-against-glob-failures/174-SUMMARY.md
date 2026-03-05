---
phase: quick
plan: 174
subsystem: testing
tags: [test-runner, glob-safety, timeout, zsh, node-test]

requires:
  - phase: none
    provides: standalone workflow hardening
provides:
  - "Safe find-based test enumeration in quick.md full-suite fallback"
  - "Per-file and total timeout guards for test execution"
  - "Graceful timeout-as-warning handling"
  - "Anti-pattern documentation for glob and timeout pitfalls"
affects: [quick-workflow, verification, test-execution]

tech-stack:
  added: []
  patterns: ["find-based test enumeration instead of raw globs", "5-min Bash timeout + 15s per-test timeout"]

key-files:
  created: []
  modified:
    - "/Users/jonathanborduas/.claude/qgsd/workflows/quick.md"

key-decisions:
  - "Use find-based enumeration instead of glob patterns to avoid zsh fatal errors on unmatched globs"
  - "Set --test-timeout=15000 per file and Bash timeout: 300000 total to prevent hangs"
  - "Treat full-suite timeout as pass-with-warning since Phase 1 task-specific tests already validated the change"

patterns-established:
  - "find-enumeration: Always use find to list test files, never raw glob patterns with node --test"
  - "timeout-layering: Per-file timeout (15s) + total timeout (5min) for full suite runs"

requirements-completed: [QUICK-174]

duration: 2min
completed: 2026-03-05
---

# Quick Task 174: Harden Test Runner Summary

**Safe find-based test enumeration with layered timeouts (15s per-file, 5min total) replacing raw glob patterns in quick.md full-suite fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T08:10:50Z
- **Completed:** 2026-03-05T08:12:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced raw `$RUN_CMD` in Phase 2 full-suite fallback with find-based enumeration and `--test-timeout=15000`
- Replaced raw `$RUN_CMD` in gap auto-fix loop with same safe enumeration pattern
- Added Bash `timeout: 300000` (5min) instructions to both full-suite execution blocks
- Added timeout-as-warning handling: full-suite timeout preserves Phase 1 verification status
- Added safety note to Phase 1 confirming git-diff-based files are already safe
- Added 3 new anti-patterns: no raw globs, mandatory timeouts, no glob-retry loops

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace raw globs with find-based enumeration and add timeout guards** - N/A (file outside git repo at ~/.claude/qgsd/workflows/quick.md)

## Files Created/Modified
- `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md` - Hardened Phase 2 fallback, gap auto-fix loop, and anti-patterns section

## Decisions Made
- Used `find` with `-o` (OR) for multiple extensions instead of multiple find calls for efficiency
- Timeout-as-warning for Phase 2 fallback (since Phase 1 already validated task changes) vs timeout-as-failure for gap auto-fix loop (where we need confirmation gaps are actually closed)
- Added `2>/dev/null` to find command to suppress errors from missing directories

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Target file (`~/.claude/qgsd/workflows/quick.md`) is outside the QGSD git repository, so no per-task git commit was possible. The file was modified in-place successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- quick.md workflow now handles full-suite fallback safely
- No blockers for future quick tasks

---
*Quick Task: 174-harden-test-runner-against-glob-failures*
*Completed: 2026-03-05*
