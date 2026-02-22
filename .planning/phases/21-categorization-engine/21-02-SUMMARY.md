---
plan: "21-02"
phase: "21-categorization-engine"
status: complete
completed: "2026-02-22"
requirements: [CATG-03]
---

# Plan 21-02 Summary: Dispatch Engine + Deferred Report

## What Was Built

Added Step 6h to the fix-tests workflow: groups actionable categorization verdicts (adapt, fixture, isolate) by a composite `category+error_type+directory_prefix` key, chunks them at max 20 per task, saves a `dispatched_task` record to state BEFORE spawning each `/qgsd:quick` Task agent. `real-bug` failures are never dispatched — they accumulate in `state.deferred_report.real_bug`. Added a deferred user report block to the Step 9 terminal summary that prints the real-bug and low-context failure lists when non-empty.

## Tasks Completed

| Task | File | Status |
|------|------|--------|
| 1 | `get-shit-done/workflows/fix-tests.md` | Complete — Step 6h inserted after 6g, Step 9 deferred report added |
| 2 | `/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md` | Complete — installed copy written (disk-only, outside git repo) |

## Key Files

### Modified
- `get-shit-done/workflows/fix-tests.md` — Step 6h added (+98 lines for dispatch), Step 9 deferred report block added (+20 lines); total 466 lines
- `/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md` — installed copy updated identically (466 lines, disk-write only)

## Decisions Made

- Step 6h correctly placed AFTER Step 6g (terminal condition check gates dispatch — no dispatch fires on terminal batch)
- State saved with `dispatched_task` record BEFORE Task spawn (idempotent on resume: deduplication check skips already-dispatched chunks)
- `real-bug` path: accumulated in `deferred_report.real_bug` only, never dispatched (developer judgment required)
- INTG-03 compliance maintained: no quorum workers called; dispatched Tasks use `subagent_type="qgsd-planner"` via quick planning_context format
- Installed copy uses the same absolute gsd-tools.cjs path as source (they are identical in this repo)

## Verification Results

```
grep -n "Step 6h" fix-tests.md (source)     → line 277 (### heading present, pass)
grep -n "dispatched_tasks" (source)           → 7 occurrences (pass)
grep -n "group_key"                           → 2 occurrences — definition + usage (pass)
grep -n "subagent_type"                       → 1 occurrence — Task spawn (pass)
grep -n "chunk_suffix|batch 1/"               → 3 occurrences (pass)
grep -n "deferred_report.real_bug"            → 5 occurrences (6h + Step 9, pass)
grep -n "Skip if terminal"                    → line 279 (gate before dispatch, pass)
grep -n "Deferred Failures" (source)          → line 419 (Step 9 report, pass)
wc -l source                                  → 466 (was 348, +118, pass)
wc -l installed                               → 466 = source (pass)
dispatched_tasks count installed = source     → 7 = 7 (pass)
```

## Self-Check: PASSED
