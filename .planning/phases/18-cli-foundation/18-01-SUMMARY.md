---
phase: 18-cli-foundation
plan: 01
subsystem: testing
tags: [gsd-tools, cli, test-discovery, jest, playwright, pytest, spawnSync]

# Dependency graph
requires: []
provides:
  - "cmdMaintainTestsDiscover function in gsd-tools.cjs — framework auto-detection and test list generation"
  - "maintain-tests discover sub-command dispatch in main() switch"
  - "Unit tests for discover command covering runner flags, empty detection, --output-file, and jest config detection"
affects: [18-02-batch, 18-03-run-batch, 18-04-save-load-state, phase-19-state-schema, phase-20-workflow-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Framework detection via config-file presence (jest.config.*, playwright.config.*, pytest.ini/pyproject.toml) — never globs"
    - "spawnSync invocation for framework CLIs (jest --listTests, playwright test --list, python -m pytest --collect-only -q)"
    - "Deduplication by normalized absolute path — first-listed framework wins on collision"
    - "JSON output schema: { runners, test_files, total_count, by_runner, warnings? }"

key-files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/bin/gsd-tools.test.cjs

key-decisions:
  - "Use spawnSync (not execSync with shell:true) for all CLI invocations — eliminates shell injection risk"
  - "Config-file-first detection, never independent *.test.* globbing — prevents monorepo cross-discovery collision (DISC-02)"
  - "Each framework CLI is the authoritative source for its own test list — no custom glob fallback"
  - "Warnings array in JSON output for failed runners — partial results preferred over full failure"
  - "--runner flag overrides auto-detection entirely when specified"

patterns-established:
  - "maintain-tests sub-commands dispatch via nested switch: case 'maintain-tests' -> case 'discover'"
  - "All maintain-tests commands use (cwd, options, raw) signature"

requirements-completed: [DISC-01, DISC-02]

# Metrics
duration: unknown
completed: 2026-02-22
---

# Phase 18 Plan 01: Maintain-Tests Discover Summary

**Config-file-driven test discovery via framework CLIs (jest --listTests, playwright --list, pytest --collect-only) with deduplication and JSON output, wired into gsd-tools.cjs as the maintain-tests discover sub-command**

## Performance

- **Duration:** N/A (implementation pre-completed before SUMMARY creation)
- **Started:** N/A
- **Completed:** 2026-02-22
- **Tasks:** 3 (Task 1: implement, Task 2: unit tests, Task 3: wire dispatch + header comment)
- **Files modified:** 2

## Accomplishments
- Implemented `cmdMaintainTestsDiscover(cwd, options, raw)` in gsd-tools.cjs with full config-file-first detection for Jest, Playwright, and Pytest
- Wired discover sub-command into the `maintain-tests` switch case in `main()` with proper flag parsing (`--runner`, `--dir`, `--output-file`)
- Added `maintain-tests discover command` describe block in gsd-tools.test.cjs with 5 test cases covering runner flag override, empty detection, --output-file write, deduplication schema, and jest package.json key detection
- Updated top-of-file usage comment block to document the new sub-command

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement cmdMaintainTestsDiscover in gsd-tools.cjs** - `dbf7173` (feat)
2. **Task 2: Add unit tests for discover in gsd-tools.test.cjs** - `c1d83ea` (test)
3. **Task 3: Wire discover into command dispatch and update header comment** - `c1d83ea` (included in test commit)

## Files Created/Modified
- `get-shit-done/bin/gsd-tools.cjs` - Added cmdMaintainTestsDiscover function and maintain-tests switch case dispatch
- `get-shit-done/bin/gsd-tools.test.cjs` - Added maintain-tests discover describe block with 5 test cases

## Decisions Made
- Used spawnSync (not execSync with shell:true) for all CLI invocations to eliminate shell injection risk
- Config-file-first detection prevents independent filesystem globbing that would cause monorepo cross-discovery collisions (DISC-02)
- Warnings array in JSON output for failed runners — command returns partial results rather than failing entirely
- --runner flag bypasses auto-detection entirely, enabling scripted single-framework invocation
- Deduplication attributes colliding paths to the first-listed framework (order: jest → playwright → pytest)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- cmdMaintainTestsDiscover is the foundational discovery layer for all downstream maintain-tests sub-commands
- 18-02 (batch) and 18-03 (run-batch) depend on the JSON output schema established here
- DISC-01 and DISC-02 requirements are satisfied by this implementation

---
*Phase: 18-cli-foundation*
*Completed: 2026-02-22*
