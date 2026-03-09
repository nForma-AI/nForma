---
phase: quick-239
plan: 01
subsystem: installer
tags: [install, validation, hooks, path-safety]
dependency_graph:
  requires: []
  provides: [install-time-hook-path-validation]
  affects: [bin/install.js]
tech_stack:
  added: []
  patterns: [fail-open-validation, conditional-export]
key_files:
  created:
    - test/install-path-validation.test.cjs
  modified:
    - bin/install.js
decisions:
  - Used conditional export (require.main !== module) to expose validateHookPaths for testing without affecting CLI behavior
  - Added bin-vs-nf-bin hint since this is the most common broken path pattern in hooks
metrics:
  duration: 2m 13s
  completed: 2026-03-09
---

# Quick 239: Add Install-Time Path Validation Summary

Install-time scanner for broken path.join(__dirname, ...) references in hook files, with fail-open warnings and bin-vs-nf-bin hints.

## Completed Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add validateHookPaths function and wire into install flow | 19ea4d0b | bin/install.js |
| 2 | Add unit tests for validateHookPaths | 61104d6f | test/install-path-validation.test.cjs |

## What Was Done

### Task 1: validateHookPaths function
Added `validateHookPaths(hooksDest, targetDir)` to bin/install.js that:
- Scans all `.js` files (excluding `.test.js`) in the installed hooks directory
- Uses regex to extract `path.join(__dirname, ...)` patterns from file contents
- Resolves each pattern relative to the hooks directory (matching runtime __dirname)
- Warns about targets that do not exist on disk
- Provides a "did you mean nf-bin?" hint when resolved path contains `/bin/` but not `/nf-bin/`
- Returns structured warnings array for programmatic use
- Wired into install() after both hooks and nf-bin copy complete

The validator immediately found 31 broken path references across installed hooks -- all referencing `~/.claude/bin/` when scripts live in `~/.claude/nf-bin/`. These are fail-open in hooks (try/catch wraps), but now they are visible at install time.

### Task 2: Unit tests
Created test/install-path-validation.test.cjs with 6 test cases:
1. No warnings for valid paths (sibling file exists)
2. Warning for missing target
3. Hint for bin vs nf-bin mismatch
4. Skips .test.js files
5. Handles multiple patterns in one file (2 broken, 1 valid)
6. No suggestion when path already uses nf-bin

Added conditional export at end of install.js: `if (require.main !== module) { module.exports = { validateHookPaths }; }` -- only exports when required as a library, preserving CLI behavior.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `node bin/install.js --claude --global` completes with exit code 0
- 31 broken path warnings printed (all bin-vs-nf-bin mismatches)
- `node test/install-path-validation.test.cjs` -- all 6 tests pass
- `node test/install-virgin.test.cjs` -- existing tests still pass
