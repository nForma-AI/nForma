---
phase: quick-58
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/fix-tests.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "When ddmin_ran is true and polluter_set is empty, the fixer agent sees exhaustive search stats (run count and candidate count) and knows ddmin ruled out all co-runners"
    - "When ddmin did not run or could not complete, the fixer agent sees a distinct, weaker message acknowledging uncertainty"
    - "The fixer agent dispatched for isolate/ddmin-exhausted is explicitly redirected toward timing, async, and I/O causes rather than shared state"
  artifacts:
    - path: "get-shit-done/workflows/fix-tests.md"
      provides: "Updated dispatch template in step 6h with split ddmin cases"
      contains: "ddmin_ran == true AND polluter_set is empty"
  key_links:
    - from: "step 6d.1 (ddmin enrichment)"
      to: "step 6h dispatch template"
      via: "verdict.candidates_tested and verdict.runs_performed fields"
      pattern: "candidates_tested|runs_performed"
---

<objective>
Improve the step 6h dispatch template in fix-tests.md so that a fixer agent receiving an
`isolate` task with `ddmin_ran == true` but `polluter_set == []` gets crystal-clear
diagnostic context: exact run count, candidate count, and explicit redirection away from
shared-state investigation toward timing/async/IO root causes.

Purpose: The current template collapses two distinct situations into one vague sentence —
"no specific polluter identified via ddmin" — which doesn't distinguish "ddmin ran
exhaustively and ruled everyone out" from "ddmin never ran." The fixer agent wastes time
on shared-state investigation when ddmin has already proved no co-runner is responsible.

Output: Updated fix-tests.md with (a) `candidates_tested` and `runs_performed` stored in
the verdict at step 6d.1, and (b) a three-case split in the step 6h dispatch template that
gives the fixer agent unambiguous guidance.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Store candidates_tested and runs_performed in isolate verdicts (step 6d.1)</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
In step 6d.1, item 6 (the block that sets verdict fields from ddmin_result), add two
additional fields to what gets stored in the verdict:

Current (three lines):
```
   - Set `verdict.polluter_set = ddmin_result.polluter_set`
   - Set `verdict.ddmin_ran = ddmin_result.ddmin_ran`
   - Set `verdict.ddmin_reason = ddmin_result.reason`
```

Updated (five lines):
```
   - Set `verdict.polluter_set = ddmin_result.polluter_set`
   - Set `verdict.ddmin_ran = ddmin_result.ddmin_ran`
   - Set `verdict.ddmin_reason = ddmin_result.reason`
   - Set `verdict.ddmin_candidates_tested = ddmin_result.candidates_tested`
   - Set `verdict.ddmin_runs_performed = ddmin_result.runs_performed`
```

These fields come from the ddmin output JSON (both are always present in the result
object regardless of outcome).
  </action>
  <verify>grep -n "ddmin_candidates_tested\|ddmin_runs_performed" get-shit-done/workflows/fix-tests.md</verify>
  <done>Both new fields appear in step 6d.1 item 6 of the workflow file.</done>
</task>

<task type="auto">
  <name>Task 2: Split the step 6h dispatch template into three distinct ddmin outcome cases</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
In step 6h, find the current single-branch isolate block that handles "empty polluter set
or ddmin not ran":

```
{if category == "isolate" AND (verdict.polluter_set is empty OR ddmin_ran == false):
"Order dependency suspected but no specific polluter identified via ddmin. Check for shared global state, ports, or DB side-effects."}
```

Replace it with THREE distinct cases. Place them immediately after the existing non-empty
polluter_set block (which ends with `Tip: the polluter test(s) likely share state...`):

```
{if category == "isolate" AND verdict.ddmin_ran == true AND verdict.polluter_set is empty:
"Ddmin exhaustive search result — NO polluter found:
  Candidates tested: {verdict.ddmin_candidates_tested}
  Runs performed:    {verdict.ddmin_runs_performed}
  Reason:            {verdict.ddmin_reason}

Ddmin ran every co-runner against this test and could NOT reproduce the failure with any
subset. Shared state from another test is NOT the cause. Do NOT investigate global vars,
DB side-effects, or port conflicts.

Instead, investigate:
  - Timing / race condition: async teardown that doesn't fully await, timers not cleared
  - I/O side-effects: file system writes in one test run that affect the next run (not another test)
  - Process-level state: singleton caches, module-level variables reset between runs but not within a run
  - Non-deterministic behavior: randomness, clock sensitivity, network calls without mocks
  - Test harness ordering: beforeAll/afterAll hooks that run once but should run per-test"}
{if category == "isolate" AND verdict.ddmin_ran == false AND verdict.polluter_set is empty:
"Ddmin did not run (no candidates in this batch or skipped). Order dependency suspected but
unconfirmed. Check for shared global state, ports, DB side-effects, or async teardown issues."}
{if category == "isolate" AND verdict.ddmin_ran == true AND verdict.polluter_set is non-empty AND len(verdict.polluter_set) == 0:}
```

NOTE: The third conditional above is a duplicate guard — only the first two cases are
needed. The existing non-empty polluter block covers `polluter_set is non-empty`. Use only
two new cases:

Case A — `ddmin_ran == true AND polluter_set is empty`:
Shows run count, candidate count, ddmin_reason, and EXPLICITLY redirects away from
shared-state to timing/async/IO investigation.

Case B — `ddmin_ran == false AND polluter_set is empty` (covers: no candidates, skipped):
Keeps the softer "unconfirmed" message since ddmin never ran.

The final structure of the three isolate blocks in order should be:
1. `[existing] if category == "isolate" AND polluter_set is non-empty` — polluter tip
2. `[new] if category == "isolate" AND ddmin_ran == true AND polluter_set is empty` — exhaustive ruling, redirect to timing/async/IO
3. `[new] if category == "isolate" AND ddmin_ran == false AND polluter_set is empty` — unconfirmed, soft guidance

Make sure to preserve the surrounding task description structure (the "Test files:" list,
"Category:", "Error pattern:" lines remain unchanged above these blocks).
  </action>
  <verify>grep -n "Ddmin exhaustive\|Candidates tested\|Runs performed\|ddmin_ran == false\|Do NOT investigate\|Timing / race" get-shit-done/workflows/fix-tests.md</verify>
  <done>
Step 6h contains three separate isolate conditional blocks: (1) non-empty polluter set with
the existing tip, (2) ddmin_ran==true + empty polluter with run/candidate stats and
timing/async redirect, (3) ddmin_ran==false + empty polluter with the softer uncertainty
message. The single-branch OR condition is gone.
  </done>
</task>

</tasks>

<verification>
Run after both tasks:
```bash
grep -n "ddmin" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md
```
Expected output includes:
- Line in 6d.1: `ddmin_candidates_tested` and `ddmin_runs_performed`
- Line in 6h: `ddmin_ran == true AND verdict.polluter_set is empty`
- Line in 6h: `Candidates tested:` and `Runs performed:`
- Line in 6h: `Do NOT investigate global vars`
- Line in 6h: `ddmin_ran == false AND verdict.polluter_set is empty`
- The old single-branch `(verdict.polluter_set is empty OR ddmin_ran == false)` line is GONE
</verification>

<success_criteria>
- step 6d.1 stores `candidates_tested` and `runs_performed` from the ddmin result into the verdict
- step 6h dispatch template has THREE isolate cases (non-empty polluter, exhaustive-no-polluter, ddmin-skipped)
- The exhaustive-no-polluter case shows run count + candidate count + reason, and explicitly says shared-state is NOT the cause
- The exhaustive-no-polluter case lists timing/async/IO investigation directions
- The ddmin-skipped case retains the softer unconfirmed language
- No regression: the non-empty polluter block is unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/58-in-fix-tests-md-step-6h-dispatch-templat/58-SUMMARY.md`
</output>
