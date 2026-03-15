---
description: Fix nf-solve.cjs NDJSON dedup bug and increase verification pipeline timeout
formal_artifacts: none
must_haves:
  truths:
    - "sweepFtoC NDJSON parser deduplicates by check_id using last-entry-wins"
    - "verification pipeline timeout is 600s (10min) instead of 300s (5min)"
    - "D->C false positive for ephemeral current-activity.json is acknowledged"
    - "installed copy at ~/.claude/nf-bin/nf-solve.cjs is synced"
  artifacts:
    - bin/nf-solve.cjs
    - .planning/formal/acknowledged-false-positives.json
  key_links:
    - bin/nf-solve.cjs:1277 (NDJSON dedup logic)
    - bin/nf-solve.cjs:1247 (timeout value)
---

# Quick Task 300: Fix nf-solve.cjs NDJSON dedup bug and increase verification pipeline timeout

## Context

During a `/nf:solve` session, two bugs were discovered in `bin/nf-solve.cjs`:

1. **NDJSON dedup bug**: `sweepFtoC()` parsed `check-results.ndjson` by counting every line, including duplicates from overlapping runs. Multiple verification pipeline invocations append to the same NDJSON file, causing stale "fail" entries to persist alongside newer "pass" entries for the same check_id. This inflated F->C residual by 25-45 phantom failures.

2. **Pipeline timeout**: The verification pipeline spawn timeout was 300s (5min), but with 207+ checks (50 TLA+, 100+ Alloy, PRISM, UPPAAL, CI), the pipeline regularly exceeded this. When killed mid-run, checks that hadn't executed yet retained stale NDJSON entries from previous runs.

3. **D->C FP**: `.planning/current-activity.json` flagged as "file not found" but it's an ephemeral file created by `activity-set` and removed by `activity-clear`. Absence at rest is correct behavior.

## Task 1: NDJSON dedup fix

**files:** bin/nf-solve.cjs
**action:** Replace the linear NDJSON parser in sweepFtoC with a Map-based deduplicator. Parse all lines into `Map<check_id, entry>` (last write wins), then count results from the deduplicated values.
**verify:** `node bin/nf-solve.cjs --json --report-only` produces F->C residual matching unique check count, not raw line count
**done:** sweepFtoC uses Map-based dedup, counts from deduped.values()

## Task 2: Increase verification pipeline timeout

**files:** bin/nf-solve.cjs
**action:** Change spawnTool timeout from 300000 (5min) to 600000 (10min) at the sweepFtoC verification pipeline spawn call.
**verify:** Pipeline completes all 207 checks without being killed
**done:** timeout value is 600000

## Task 3: Acknowledge D->C false positive

**files:** .planning/formal/acknowledged-false-positives.json
**action:** Add entry for `.planning/current-activity.json` with reason "Ephemeral file created by activity-set, removed by activity-clear. Absence is correct when no activity in progress."
**verify:** `node bin/nf-solve.cjs --json --report-only` shows d_to_c residual = 0
**done:** FP entry present in acknowledged-false-positives.json

## Task 4: Sync installed copy

**files:** ~/.claude/nf-bin/nf-solve.cjs
**action:** Copy bin/nf-solve.cjs to ~/.claude/nf-bin/nf-solve.cjs
**verify:** diff shows no differences
**done:** installed copy matches source
