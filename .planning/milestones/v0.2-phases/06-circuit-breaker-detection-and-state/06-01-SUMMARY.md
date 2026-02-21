---
phase: 06-circuit-breaker-detection-and-state
plan: 01
status: complete
commit: 1a0527b
---

## What Was Built

PreToolUse hook (`hooks/qgsd-circuit-breaker.js`) that detects oscillation in git history
and persists breaker state to `.claude/circuit-breaker-state.json`. Phase 6 scope: detection
and state persistence only — hook always exits 0 (no blocking). Blocking is Phase 7.

## Artifacts

- `hooks/qgsd-circuit-breaker.js` — PreToolUse hook, 115 lines
- `hooks/qgsd-circuit-breaker.test.js` — 15 TDD test cases, 487 lines, all passing
- `scripts/build-hooks.js` — HOOKS_TO_COPY extended with `qgsd-circuit-breaker.js`
- `package.json` — test script updated to include `qgsd-circuit-breaker.test.js`
- `.gitignore` — `.claude/circuit-breaker-state.json` entry added

## Requirements Delivered

DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05, STATE-01, STATE-02, STATE-03, STATE-04

## Key Decisions

**Switched from `execSync` (string) to `spawnSync` (array args)**: Security hook blocked
inline edits to the `execSync` template literal. `spawnSync` with array args is also safer
(no shell injection risk) and avoids the string-splitting pitfall that broke test helpers.

**Added `--root` flag to `git diff-tree`**: Without it, root commits (no parent) return an
empty file set, preventing oscillation detection in repos with fewer than 4 commits. `--root`
treats the diff as "empty tree → commit", exposing all files without affecting non-root commits.

**Commit creation must precede state file setup in tests**: `git add .` includes any pre-existing
`.claude/` files (state file, blocking file), changing the root commit's file set and preventing
3× strict-equality match. Creating commits first ensures consistent file sets across all commits.

## Bugs Found and Fixed

Three bugs in the planner-generated implementation/tests:

1. **Root commit blind spot**: `git diff-tree --no-commit-id -r --name-only HASH` returns nothing
   for the initial commit. Fixed: added `--root` flag. Without it CB-TC6, CB-TC8, CB-TC10,
   CB-TC11, CB-TC12, CB-TC13 all fail.

2. **String-splitting commit helper**: Test helpers used `spawnSync('git', cmd.split(' '))` and
   called `git('commit -m "commit 0"')`, which split into `['commit', '-m', '"commit', '0"']`.
   Git treats `0"` as a pathspec — commit silently created zero commits. Fixed: replaced all
   helpers with direct `spawnSync('git', [...array])` calls.

3. **State file contaminating git history**: CB-TC8, CB-TC10, CB-TC15 created state files
   before running oscillation commits. `git add .` captured them, making root commit's file set
   `[.claude/state.json, file1.txt, ...]` instead of `[file1.txt, ...]`. Oscillation count
   never reached depth=3. Fixed: create commits before state file setup.

## Test Results

```
npm test: 125/125 pass (0 fail)
- qgsd-stop.test.js:         19/19
- config-loader.test.js:     10/10
- gsd-tools.test.cjs:        81/81
- qgsd-circuit-breaker.test.js: 15/15
```
