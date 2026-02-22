# fix-tests Workflow

## Overview

Discover → Batch → Execute → Stub-Categorize → Iterate loop with circuit breaker lifecycle and
three-condition termination. Phase 21 replaces stub categorization with real AI classification.

---

## Step 1: Load Existing State (Resume Check)

Run:
```bash
STATE_JSON=$(node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests load-state 2>/dev/null)
```

- If STATE_JSON is `null` or empty: this is a FRESH START — proceed to Step 2.
- If STATE_JSON is a JSON object: this is a RESUME — extract `batches_complete` and `manifest_path`
  from the state, then skip Steps 3-4 (discovery and batching), jump directly to Step 6 starting
  at batch index `batches_complete`.

## Step 2: Disable Circuit Breaker

Run:
```bash
npx qgsd --disable-breaker
```

This writes `{ "disabled": true, "active": false }` to `.claude/circuit-breaker-state.json`.
The breaker MUST be re-enabled on every exit path (normal completion AND error). If the workflow
aborts mid-run, print the re-enable command so the user can run it manually:
`npx qgsd --enable-breaker`

## Step 3: Discover Tests (fresh start only)

Set discovering activity:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"discovering_tests","state_file":".planning/maintain-tests-state.json"}'
```

Run discovery:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests discover \
  --output-file .planning/maintain-tests-discover.json
```

Print: `QGSD fix-tests: Discovery complete — {N} tests found`

## Step 4: Batch Tests (fresh start only)

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests batch \
  --input-file .planning/maintain-tests-discover.json \
  --manifest-file .planning/maintain-tests-manifest.json
```

Parse the manifest to extract `total_batches` and `total_files`.
Print: `QGSD fix-tests: Batching complete — {total_files} tests in {total_batches} batches`

## Step 5: Initialize State (fresh start only)

Build initial state JSON and save:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '{"schema_version":1,"session_id":"<ISO timestamp>","manifest_path":".planning/maintain-tests-manifest.json","total_tests":<total_files>,"batches_complete":0,"batch_status":{},"processed_files":[],"results_by_category":{"valid_skip":[],"adapt":[],"isolate":[],"real_bug":[],"fixture":[]},"flaky_tests":[],"iteration_count":0,"last_unresolved_count":<total_files>,"consecutive_no_progress":0,"deferred_tests":[]}'
```

Read `ITERATION_CAP` from `.claude/qgsd.json` path `maintain_tests.iteration_cap` — default 5 if not set.

## Step 6: Batch Loop

For each batch index B starting from `batches_complete` up to `total_batches - 1` (zero-based):

### 6a. Set activity: running_batch

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"running_batch","batch":<B+1>,"batch_total":<total_batches>,"state_file":".planning/maintain-tests-state.json"}'
```

### 6b. Execute batch

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests run-batch \
  --batch-file .planning/maintain-tests-manifest.json \
  --batch-index <B> \
  --output-file .planning/maintain-tests-batch-result.json
```

Read `.planning/maintain-tests-batch-result.json` to get batch results.

If `batch_timed_out: true`: update `batch_status[B+1] = "timed_out"` in state, save state, continue to next batch (do NOT advance `batches_complete`).

### 6c. Set activity: categorizing_batch

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"categorizing_batch","batch":<B+1>,"batch_total":<total_batches>,"state_file":".planning/maintain-tests-state.json"}'
```

### 6d. Stub-categorize results (Phase 20 placeholder — Phase 21 replaces this)

For each result in batch_result.results:
- If `status == "failed"`: append `result.file` to `state.results_by_category.real_bug`
- If `status == "flaky"`: append `result.file` to `state.flaky_tests`
- If `status == "passed"` or `status == "skipped"`: append `result.file` to `state.processed_files`

DO NOT dispatch /qgsd:quick tasks in Phase 20. Classification dispatch is Phase 21 (CATG-03).

### 6e. Print progress banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FIX-TESTS: Batch {B+1} / {total_batches} complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Passed: {passed_count}  |  Failed: {failed_count}  |  Flaky: {flaky_count}  |  Skipped: {skipped_count}
 Total classified: {sum(all category arrays)} / {total_tests}
 Iteration: {iteration_count + 1} / {ITERATION_CAP}
```

### 6f. Update state

Increment `batches_complete` by 1.
Update `batch_status[B+1] = "complete"`.
Calculate:
- `classified = len(valid_skip) + len(adapt) + len(isolate) + len(real_bug) + len(fixture)`
- `flaky_count = len(flaky_tests)`
- `unresolved = total_tests - classified - flaky_count`

If `unresolved == last_unresolved_count`:
  increment `consecutive_no_progress` by 1
Else:
  set `consecutive_no_progress = 0`

Set `last_unresolved_count = unresolved`.

If `batches_complete == total_batches`:
  increment `iteration_count` by 1

Save state:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '<updated state JSON>'
```

### 6g. Check termination conditions (in this order)

**Condition 1 — All tests classified:**
```
IF unresolved == 0:
  TERMINAL: "all tests classified"
  → break loop, go to Step 7
```

**Condition 2 — No progress in 5 consecutive batches:**
```
IF consecutive_no_progress >= 5:
  TERMINAL: "no progress in last 5 batches"
  → break loop, go to Step 7
```

**Condition 3 — Iteration cap reached (check at end of last batch in iteration):**
```
IF iteration_count >= ITERATION_CAP AND B == total_batches - 1:
  TERMINAL: "iteration cap reached ({ITERATION_CAP} iterations)"
  → break loop, go to Step 7
```

If no terminal condition: continue to next batch (or loop back to batch 0 if `B == total_batches - 1`).
When looping back: increment `iteration_count` by 1 before resetting B to 0.

## Step 7: Re-enable Circuit Breaker

```bash
npx qgsd --enable-breaker
```

This writes `{ "disabled": false, "active": false }` to `.claude/circuit-breaker-state.json`.

## Step 8: Clear Activity State

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  '{"activity":"maintain_tests","sub_activity":"complete","state_file":".planning/maintain-tests-state.json"}'
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

## Step 9: Print Terminal Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FIX-TESTS: Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Terminal condition: {condition}
 Batches run: {batches_complete} / {total_batches}
 Iterations: {iteration_count} / {ITERATION_CAP}

 Results:
   Classified (real_bug / stub): {len(real_bug)}
   Flaky:                        {len(flaky_tests)}
   Passed / Skipped:             {len(processed_files)}
   Unresolved:                   {unresolved}

 Note: Phase 20 stub — all failures marked as real_bug.
 Run Phase 21 categorization to replace with accurate classification.

 State saved to: .planning/maintain-tests-state.json
```

---

## Error Handling

If any Bash step fails (non-zero exit code):
1. Print: `QGSD fix-tests: ERROR at <step name> — <error output>`
2. Run: `npx qgsd --enable-breaker` (always — do not skip)
3. Run: `node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs activity-clear`
4. Surface the original error to the user

---

## Resume Logic Detail

On a RESUME (STATE_JSON is not null):

1. Skip Steps 3-4 (discover and batch — manifest already exists at `state.manifest_path`)
2. Read `total_batches` from the manifest at `state.manifest_path`
3. Read `ITERATION_CAP` as normal
4. Start batch loop at index `state.batches_complete` (the first un-completed batch)
5. Use state's existing `results_by_category`, `flaky_tests`, `processed_files` as the running totals
6. Do NOT reset `consecutive_no_progress` or `iteration_count` — resume from exact interrupted point

---

## INTG-03 Compliance Note

This workflow MUST NOT call any quorum worker (mcp__gemini-cli__, mcp__codex-cli__, etc.).
It is execution-only. Adding fix-tests to quorum_commands violates R2.1 and will cause the
Stop hook to block every response waiting for quorum that was never dispatched.
