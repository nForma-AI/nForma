---
plan: "21-01"
phase: "21-categorization-engine"
status: complete
completed: "2026-02-22"
requirements: [CATG-01, CATG-02]
---

# Plan 21-01 Summary: Categorization Engine

## What Was Built

Replaced the Phase 20 stub categorization in `fix-tests.md` Step 6d with a full AI classification engine. The new engine assembles context per failure (test file source + top-2 stack trace source files), computes a `context_score` (0–3), gates low-context failures to `deferred_tests`/`deferred_report.low_context`, and classifies confirmed failures into 5 categories using inline Claude reasoning. Git pickaxe enrichment runs for every `adapt` verdict. State is saved with `categorization_verdicts` after each group of 20.

## Tasks Completed

| Task | File | Status |
|------|------|--------|
| 1 | `get-shit-done/workflows/fix-tests.md` | Complete — Step 6d replaced, Step 5 schema extended, Step 9 updated |
| 2 | `/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md` | Complete — installed copy written (disk-only, outside git repo) |

## Key Files

### Created / Modified
- `get-shit-done/workflows/fix-tests.md` — Step 6d full replacement (+125 lines, -19 lines); Step 5 state JSON extended with `categorization_verdicts`, `dispatched_tasks`, `deferred_report`; Step 9 real category counts replacing stub note
- `/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md` — installed copy updated to match source (348 lines, disk-write only)

## Decisions Made

- Installed copy written independently (not via cp), per Phase 20 pattern; all `gsd-tools.cjs` references use the absolute installed path which is identical to the source in this repo
- Phase 20 stub detection logic added: detects `categorization_verdicts == [] AND results_by_category non-empty`, clears stale state, re-classifies
- `real-bug` is the conservative fallback category (uncertain → real-bug, not auto-actioned)
- Pickaxe enrichment is enhancement-only: `commits = []` still dispatches as adapt; `pickaxe_context = null` if git unavailable
- Dispatch step (Step 6h) deferred to Plan 02 per plan boundary; Step 6d only produces verdicts

## Verification Results

```
grep -n "context_score" get-shit-done/workflows/fix-tests.md     → 5 occurrences (pass)
grep -n "git log -S" get-shit-done/workflows/fix-tests.md         → 1 occurrence (pass)
grep -n "Phase 20 placeholder" get-shit-done/workflows/fix-tests.md → no output (pass)
grep -n "categorization_verdicts" get-shit-done/workflows/fix-tests.md → 8 occurrences (pass)
grep -n "deferred_report" get-shit-done/workflows/fix-tests.md    → 5 occurrences (pass)
grep -c "valid-skip|adapt|isolate|real-bug|fixture" get-shit-done/workflows/fix-tests.md → 19 (pass)
wc -l get-shit-done/workflows/fix-tests.md                        → 348 (was 243, +105, pass)
Installed copy line count matches source: 348 = 348 (pass)
```

## Self-Check: PASSED
