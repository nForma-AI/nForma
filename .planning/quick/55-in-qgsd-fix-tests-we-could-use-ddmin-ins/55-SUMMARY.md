---
phase: quick-55
plan: 55
subsystem: fix-tests / gsd-tools
tags: [ddmin, delta-debugging, test-isolation, fix-tests, maintain-tests]
dependency_graph:
  requires: []
  provides: [maintain-tests ddmin CLI, fix-tests ddmin enrichment step]
  affects: [get-shit-done/bin/gsd-tools.cjs, get-shit-done/workflows/fix-tests.md]
tech_stack:
  added: []
  patterns: [ddmin2 algorithm, test-order sensitivity detection]
key_files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/workflows/fix-tests.md
decisions:
  - "ddmin run cap set to 50 runs to prevent runaway execution while still finding polluters in typical suites"
  - "ddmin is best-effort — timeout or no-repro never blocks dispatch; proceed with polluter_set=[] on failure"
  - "runSequence runs each prefix file fully (side effects matter) but only checks target file result"
metrics:
  duration: "~7 min"
  completed: "2026-02-23"
  tasks_completed: 3
  files_modified: 2
---

# Phase Quick-55: Ddmin Isolation in fix-tests Summary

**One-liner:** Added `maintain-tests ddmin` CLI subcommand (ddmin2 algorithm) and wired it into fix-tests.md step 6d.1 to enrich isolate verdicts with minimal polluter sets before dispatch.

## What Was Built

Before this task, when fix-tests classified a test as `isolate` (fails due to ordering/pollution from another test), the dispatched quick task only had a vague heuristic like "port conflict" or "env var missing" — no indication of which upstream test was causing the pollution. Fixers were flying blind.

Now:
1. `maintain-tests ddmin` finds the minimal subset of co-runner tests responsible for a given test's failure.
2. Step 6d.1 in fix-tests.md runs ddmin on every `isolate` verdict before dispatch.
3. Dispatched tasks for isolate failures include a "Polluter analysis" section listing exactly which test(s) cause the failure when run first.

## Tasks

### Task 1: maintain-tests ddmin subcommand (commit 8e0829a)

Added `cmdMaintainTestsDdmin` to `get-shit-done/bin/gsd-tools.cjs`.

**CLI signature:**
```
maintain-tests ddmin --failing-test <path> --candidates-file <path> [--timeout N] [--runner auto|jest|playwright|pytest] [--output-file path]
```

**Algorithm:** Standard ddmin2 — binary-splits candidates, tests each chunk and its complement, narrows to minimal polluter set. Handles edge cases:
- Empty candidates → `{ ddmin_ran: false, reason: "no candidates" }` (fast path, no test runs)
- Test fails in isolation → `{ ddmin_ran: false, reason: "test fails in isolation — not an ordering issue" }`
- Full set doesn't reproduce → `{ ddmin_ran: true, reason: "full candidate set does not reproduce failure" }`
- Run cap (50) hit → `{ reason: "run cap reached" }`
- Timeout → `{ reason: "timeout during ddmin" }`

**Output JSON:**
```json
{
  "failing_test": "<path>",
  "polluter_set": ["<path1>", "<path2>"],
  "candidates_tested": N,
  "runs_performed": M,
  "ddmin_ran": true,
  "reason": "minimal polluter set found"
}
```

### Task 2: fix-tests.md workflow integration (commit ffcde5f)

Updated `get-shit-done/workflows/fix-tests.md`:

- **New Step 6d.1** ("Ddmin enrichment for isolate verdicts") inserted between 6d and 6e — iterates all isolate verdicts in the current batch, builds candidates from batch siblings, runs `maintain-tests ddmin`, stores `polluter_set`/`ddmin_ran`/`ddmin_reason` on the verdict.
- **Step 6h dispatch template** updated with a conditional polluter context block for isolate category: if `polluter_set` non-empty, lists up to 5 polluters with tip about shared state; if empty/ddmin_ran false, shows generic guidance.
- **Step 5 initial state JSON** schema extended with `"ddmin_results":[]` field.
- **Step 9 terminal summary** adds `Ddmin runs: {N} tests enriched` stats line.

### Task 3: Install to sync source to ~/.claude/qgsd/ (no tracked file changes)

Ran `node bin/install.js --claude --global` to propagate both modified files to the installed copies used by Claude Code at runtime. Verified `~/.claude/qgsd/bin/gsd-tools.cjs` and `~/.claude/qgsd/workflows/fix-tests.md` contain the ddmin changes.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `node --check get-shit-done/bin/gsd-tools.cjs` → syntax OK
- `maintain-tests ddmin --failing-test x --candidates-file /dev/stdin <<< '{"test_files":[]}'` → `{ ddmin_ran: false, reason: "no candidates" }`
- `grep -c "ddmin" get-shit-done/workflows/fix-tests.md` → 17 (>= 8 required)
- `grep "6d.1" get-shit-done/workflows/fix-tests.md` → step exists
- `grep "cmdMaintainTestsDdmin" ~/.claude/qgsd/bin/gsd-tools.cjs` → installed copy updated
- Task commits: 8e0829a (Task 1), ffcde5f (Task 2)
