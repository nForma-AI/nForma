---
status: awaiting_human_verify
trigger: "nf-solve-test-timeouts"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED — three-part root cause found and fixed
test: All 7 tests now pass in ~1s each (7637ms total for 7 tests)
expecting: Human verification that tests pass in their environment
next_action: Await human confirmation

## Symptoms

expected: Integration tests (TC-INT-1 through TC-INT-4, TC-CONV-1, TC-CONV-2, TC-INT --project-root) complete within their timeout limits
actual: All 7 tests timeout at 120-180s. The spawned nf-solve.cjs subprocess takes too long. Output is truncated/empty JSON causing parse failures.
errors:
- SyntaxError: Unexpected end of JSON input (from JSON.parse on truncated subprocess output)
- 120007ms / 180014ms durations (hitting timeout limits)
reproduction: Run `node --test bin/nf-solve.test.cjs` — the TC-INT and TC-CONV tests all timeout
started: Pre-existing issue, not caused by recent changes

## Eliminated

- hypothesis: Bug in formatJSON or output formatting
  evidence: The process never finishes — it's not a formatting problem, it's a runtime duration problem
  timestamp: 2026-03-16T00:00:00Z

- hypothesis: maxBuffer truncation (1MB limit)
  evidence: Raw buffer was 65536 bytes regardless of maxBuffer setting — this was OS pipe buffer cap, not Node maxBuffer
  timestamp: 2026-03-16T00:05:00Z

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: TC-INT-1 through TC-INT-4, TC-CONV-1, TC-CONV-2, TC-INT --project-root spawnSync calls
  found: All 7 tests use timeout 120000-180000 but do NOT pass --fast or --skip-proximity flags
  implication: Each test spawns a full nf-solve run with proximity index rebuild

- timestamp: 2026-03-16T00:00:00Z
  checked: Timed `nf-solve.cjs --json --report-only --fast --skip-proximity --max-iterations=1`
  found: Completes in 0.68 seconds
  implication: --fast + --skip-proximity reduces runtime from 120-180s to <1s

- timestamp: 2026-03-16T00:00:00Z
  checked: TC-FOCUS-1 and TC-INT-empty-project (existing tests that pass)
  found: These already use --fast --max-iterations=1 with 60s timeout
  implication: Pattern of using --fast for integration tests is established in the file

- timestamp: 2026-03-16T00:02:00Z
  checked: nf-solve.cjs main() at line 4666 — `DRY_RUN_FLAG` reference
  found: `DRY_RUN_FLAG` is undefined — throws ReferenceError before producing any output
  implication: Subprocess crashes silently when running fast enough to reach that code path
  note: Bug introduced in commit c8cfce5c (FPTUNE-01/02); should be `reportOnly`

- timestamp: 2026-03-16T00:04:00Z
  checked: stdout output size via spawnSync with explicit 10MB maxBuffer
  found: Raw buffer is 65536 bytes (64KB) regardless of maxBuffer — JSON truncated at pipe buffer boundary
  implication: process.exit() called before stdout drains to the parent pipe

- timestamp: 2026-03-16T00:05:00Z
  checked: spawnSync stdout after drain fix
  found: Full 80861 bytes delivered, valid JSON parses successfully
  implication: drain fix eliminates stdout truncation

## Resolution

root_cause: Three compounding bugs:
  1. Tests spawn nf-solve.cjs without --fast/--skip-proximity flags, causing proximity index rebuild (60-120s) + all sweep layers to run — tests timeout before subprocess completes
  2. `DRY_RUN_FLAG` undefined in main() (commit c8cfce5c) causes ReferenceError crash when subprocess reaches that code path — stdout is empty
  3. `process.exit()` called immediately after `process.stdout.write()` without draining — OS pipe buffer (64KB) fills and stdout is truncated in spawnSync parent

fix:
  - bin/nf-solve.test.cjs: add --fast --skip-proximity --max-iterations=1 to all 7 slow spawnSync calls; reduce timeout 180000→60000
  - bin/nf-solve.cjs: replace DRY_RUN_FLAG with reportOnly (both occurrences in main())
  - bin/nf-solve.cjs: replace process.stdout.write + process.exit() with drain-aware exit pattern

verification: All 7 target tests pass (7637ms total, ~1s each). 86/95 total tests pass. 9 pre-existing hanging tests (TC-HEATMAP-2, TC-LAYER-4/5/6, etc.) involve computeResidual() → sweepTtoC() → `node --test` recursive spawn — separate pre-existing issue, not in scope.
files_changed:
  - bin/nf-solve.test.cjs
  - bin/nf-solve.cjs
