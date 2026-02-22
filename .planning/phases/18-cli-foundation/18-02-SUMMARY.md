---
phase: 18-cli-foundation
plan: 02
subsystem: testing
tags: [gsd-tools, maintain-tests, batch, mulberry32, prng, deterministic]

# Dependency graph
requires: []
provides:
  - "cmdMaintainTestsBatch function in gsd-tools.cjs"
  - "mulberry32 PRNG (inline, no external dep)"
  - "seededShuffle Fisher-Yates implementation"
  - "maintain-tests batch sub-command with deterministic shuffle, exclude filter, manifest output"
affects:
  - "18-cli-foundation (plans 03, 04 — run-batch and state management consume batch manifests)"
  - "workflow-orchestrator phase (batch manifest is the contract between discovery and execution)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mulberry32 PRNG implemented inline (no external dependency) for deterministic test shuffling"
    - "Fisher-Yates shuffle with seeded PRNG for reproducible batch manifests"
    - "Manifest-first protocol: write batch manifest to disk before any execution begins"

key-files:
  created: []
  modified:
    - "get-shit-done/bin/gsd-tools.cjs"
    - "get-shit-done/bin/gsd-tools.test.cjs"

key-decisions:
  - "Mulberry32 PRNG implemented inline with no external dependency — maintains zero-dep policy for gsd-tools"
  - "Manifest written to disk (--manifest-file) BEFORE returning — enables crashed-run resume without re-shuffling"
  - "--exclude-file resolves paths via path.resolve() for robust cross-platform matching"
  - "Default seed uses Date.now() % 2147483647 and is always printed in output for reproducibility"

patterns-established:
  - "Batch manifest schema: seed, batch_size, total_files, total_batches, batches[].{batch_id, files, file_count}"
  - "seededShuffle(arr, seed) pattern reusable for any deterministic shuffle need in gsd-tools"

requirements-completed:
  - EXEC-01

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 18 Plan 02: Maintain-Tests Batch Summary

**Deterministic batch manifest generation for test suites using Mulberry32 PRNG and Fisher-Yates shuffle — enables reproducible, resume-capable test execution**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T00:00:00Z
- **Completed:** 2026-02-22
- **Tasks:** 3 (Task 3 verified via Task 1 dispatch wiring)
- **Files modified:** 2

## Accomplishments
- Implemented `cmdMaintainTestsBatch` in gsd-tools.cjs with full flag support: `--input-file`, `--input-json`, `--size`, `--seed`, `--exclude-file`, `--manifest-file`
- Added Mulberry32 PRNG and seededShuffle inline (no external dependencies)
- Wired `batch` case into the `maintain-tests` switch alongside the existing `run-batch` case (from concurrent 18-03 work)
- Added 6 unit tests covering: determinism, batch sizing, exclude filter, manifest write, empty input, single file
- Full test suite: 155 pass, 0 fail (no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement cmdMaintainTestsBatch** - `7839344` (feat)
2. **Task 2: Add unit tests for batch** - `d232dc8` (test)
3. **Task 3: Wire batch into dispatch** - (included in Task 1 commit — dispatch wired simultaneously)

## Files Created/Modified
- `get-shit-done/bin/gsd-tools.cjs` - Added mulberry32(), seededShuffle(), cmdMaintainTestsBatch(), batch case in maintain-tests switch, usage comment
- `get-shit-done/bin/gsd-tools.test.cjs` - Added describe('maintain-tests batch command') with TC1-TC6

## Decisions Made
- Mulberry32 PRNG implemented inline with no external dependency — maintains zero-dep policy for gsd-tools
- Manifest written to disk BEFORE returning when `--manifest-file` is provided — enables crashed-run resume
- `--exclude-file` uses `path.resolve()` for robust path comparison across relative/absolute paths
- Default seed: `Date.now() % 2147483647` (always printed in output for reproducibility)

## Deviations from Plan

None — plan executed exactly as written, with one minor coordination note:

Plan 18-03 (run-batch) was executing concurrently and had pre-staged a `maintain-tests` switch with the `run-batch` case. Instead of creating a new switch, I added the `batch` case to the existing switch structure. The error message was also updated from "Available: run-batch" to "Available: batch, run-batch". This is additive only — no conflicts.

## Issues Encountered

Concurrent execution by Plan 18-03 agent pre-modified gsd-tools.cjs (added maintain-tests switch with run-batch case, added spawnSync/spawn imports). Integrated cleanly by adding the `batch` case to the existing switch rather than creating a second `maintain-tests` case. No conflicts.

## Next Phase Readiness
- `maintain-tests batch` fully functional — ready to receive discover output and produce batch manifests
- Batch manifest schema established — Plans 18-03 (run-batch) and 18-04 (state) can consume this format
- Mulberry32/seededShuffle available for reuse by any future deterministic shuffle need

---
*Phase: 18-cli-foundation*
*Completed: 2026-02-22*
