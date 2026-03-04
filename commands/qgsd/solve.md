---
name: qgsd:solve
description: Orchestrator skill that diagnoses consistency gaps, dispatches to remediation skills for each gap type, and converges via diagnose-remediate-rediagnose loop with before/after comparison
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
  - AskUserQuestion
---

<objective>
Run the QGSD consistency solver as a full orchestrator. Sweeps 5 layer transitions (R->F, F->T, C->F, T->C, F->C), computes a residual vector showing gaps at each boundary, and automatically dispatches to the correct remediation skill/script for each gap type. Re-diagnoses after each remediation round and iterates until convergence or max iterations reached. Returns before/after residual comparison.
</objective>

<execution_context>
This is a self-contained orchestrator skill. It runs the diagnostic engine (bin/qgsd-solve.cjs) and orchestrates higher-level remediation via sub-skills and scripts. No external quorum dispatch is needed — quorum enforcement, if required, is the responsibility of the sub-skills being called.
</execution_context>

<process>

## Step 1: Initial Diagnostic Sweep

Run `node bin/qgsd-solve.cjs --json --report-only` to get a baseline diagnostic:

```bash
BASELINE=$(node bin/qgsd-solve.cjs --json --report-only)
```

Parse the JSON output to extract the `residual_vector` object. Key fields:
- `residual_vector.r_to_f.residual` — count of requirements lacking formal coverage
- `residual_vector.f_to_t.residual` — count of formal invariants lacking test backing
- `residual_vector.c_to_f.residual` — count of constant mismatches (Code vs Formal)
- `residual_vector.t_to_c.residual` — count of failing unit tests
- `residual_vector.f_to_c.residual` — count of failing formal checks
- `residual_vector.total` — total residual across all layers

Store the parsed baseline residual as `baseline_residual` for the before/after comparison at the end.

Display the baseline residual in human-readable format:
```
Layer Transition         Baseline  Health
────────────────────────────────────────
R -> F (Req->Formal)        N      [status]
F -> T (Formal->Test)       N      [status]
C -> F (Code->Formal)       N      [status]
T -> C (Test->Code)         N      [status]
F -> C (Formal->Code)       N      [status]
Total                       N
```

Health status: GREEN (0), YELLOW (1-3), RED (4+), or UNKNOWN (error).

## Step 2: Report-Only Gate

If `--report-only` flag was passed:
- Display the baseline residual vector only
- STOP — do not proceed to remediation
- Exit with status based on whether residual is zero (0) or non-zero (1)

This preserves the read-only diagnostic mode.

## Step 3: Remediation Dispatch (Ordered by Dependency)

**Important:** Dispatch remediation in this strict order because R->F coverage is a prerequisite for F->T test stubs. New formal specs create new invariants needing test backing.

For each gap type with `residual > 0`, dispatch in this exact order:

### 3a. R->F Gaps (residual_vector.r_to_f.residual > 0)

Extract the list of uncovered requirement IDs from `residual_vector.r_to_f.detail.uncovered_requirements`.

If the list has 10 or fewer IDs, dispatch:
```
/qgsd:close-formal-gaps --ids=REQ-01,REQ-02,...
```

If the list has more than 10 IDs, dispatch:
```
/qgsd:close-formal-gaps --all
```

Log: `"Dispatching R->F remediation: close-formal-gaps for {N} uncovered requirements"`

Wait for the skill to complete. If it fails, log the failure and continue to the next gap type.

### 3b. F->T Gaps (residual_vector.f_to_t.residual > 0)

Run the formal-test-sync script directly (do NOT dispatch /qgsd:formal-test-sync as a skill — the Node.js script is sufficient):
```bash
node bin/formal-test-sync.cjs
```

This will generate test stubs for all uncovered invariants and update traceability sidecars.

Log: `"Dispatching F->T remediation: formal-test-sync for {N} uncovered invariants"`

If the script fails (exit code non-zero), log the failure and continue.

### 3c. T->C Gaps (residual_vector.t_to_c.residual > 0)

Dispatch the fix-tests skill:
```
/qgsd:fix-tests
```

This will discover and autonomously fix failing tests.

Log: `"Dispatching T->C remediation: fix-tests for {N} failing tests"`

If it fails, log the failure and continue.

### 3d. C->F Gaps (residual_vector.c_to_f.residual > 0)

Constant mismatches between code and formal specs. Display the mismatch table, then dispatch `/qgsd:quick` to align them:

```
C->F: {N} constant mismatch(es) — dispatching quick task to align
```

Display detail table:
```
Constant        Source            Formal Value    Config Value
─────────────────────────────────────────────────────────────
constant_name   formal_spec_file  formal_val      config_val
```

Dispatch:
```
/qgsd:quick Fix C->F constant mismatches: update formal specs OR code config to align these values: {mismatch_summary}
```

If the mismatch has `intentional_divergence: true`, skip it and log as intentional.

### 3e. F->C Gaps (residual_vector.f_to_c.residual > 0)

First, run the formal verification to get fresh failure data:
```bash
node bin/run-formal-verify.cjs
```

Then parse `.formal/check-results.ndjson` and classify each failure:

| Classification | Criteria | Dispatch |
|---------------|----------|----------|
| **Syntax error** | Summary contains "Syntax error", "parse error" | `/qgsd:quick Fix Alloy/TLA+ syntax error in {model_file}: {error_detail}` |
| **Scope error** | Summary contains "scope", "sig" | `/qgsd:quick Fix scope declaration in {model_file}: {error_detail}` |
| **Conformance divergence** | check_id contains "conformance" | `/qgsd:debug Investigate conformance trace divergences: {N} divergences in {model}` |
| **Verification failure** | Counterexample found | `/qgsd:debug Investigate formal verification counterexample in {check_id}: {summary}` |
| **Missing tool** | "not found", "not installed" | Log as infrastructure gap, skip |
| **Inconclusive** | result = "inconclusive" | Skip — not a failure |

Dispatch each fixable failure to the appropriate skill. Process syntax/scope errors first (they're usually quick fixes), then conformance/verification failures (require deeper investigation).

Log: `"F->C: {total} checks, {pass} pass, {fail} fail — dispatching {syntax_count} to quick, {debug_count} to debug, {skip_count} skipped"`

Each dispatch is independent — if one fails, continue to the next.

## Step 4: Re-Diagnostic Sweep

After all remediations in Step 3 complete, run the diagnostic again:
```bash
POST=$(node bin/qgsd-solve.cjs --json --report-only)
```

Parse the result as `post_residual`.

## Step 5: Convergence Check

Compare the baseline total residual against the post-remediation total:

- If `post_residual.total == 0`: Report `"✓ All layers converged to zero. System is fully consistent."` and EXIT.
- If `post_residual.total < baseline_residual.total`: Report improvement `"✓ Improvement: {baseline} → {post} gaps remaining"` and continue to Step 6.
- If `post_residual.total >= baseline_residual.total`: Report stasis `"⚠ Residual did not decrease. {baseline} → {post}. Remaining gaps may need manual attention."` and continue to Step 6.

### Iteration Loop (if --max-iterations > 1)

If `--max-iterations=N` was passed and N > 1:
- Increment iteration counter
- If iterations < max_iterations AND residual decreased AND residual > 0: loop back to Step 3 (re-dispatch remediation)
- If iterations >= max_iterations OR residual unchanged OR residual == 0: proceed to Step 6

Default behavior (no `--max-iterations` flag): max iterations = 5.

## Step 6: Before/After Summary

Display a comprehensive before/after comparison table:

```
Layer Transition         Before  After   Delta     Status
─────────────────────────────────────────────────────────
R -> F (Req→Formal)        {N}    {M}    {delta}   [GREEN|YELLOW|RED]
F -> T (Formal→Test)       {N}    {M}    {delta}   [GREEN|YELLOW|RED]
C -> F (Code→Formal)       {N}    {M}    {delta}   [GREEN|YELLOW|RED]
T -> C (Test→Code)         {N}    {M}    {delta}   [GREEN|YELLOW|RED]
F -> C (Formal→Code)       {N}    {M}    {delta}   [GREEN|YELLOW|RED]
──────────────────────────────────────────────────────────
Total                      {N}    {M}    {delta}
```

**IMPORTANT — Expand non-zero layers:** For any layer with residual > 0, display the full detail below the table. The residual number alone hides severity. For example, F→C residual=1 might mean "1 check failed with 7,086 individual divergences." Always show:

- **R→F**: List all uncovered requirement IDs
- **F→T**: Count of formal properties without test backing
- **T→C**: List failing test names and error summaries
- **C→F**: Table of each constant mismatch (name, formal value, config value)
- **F→C**: For each failing check: check_id, summary (including counts like "7086 divergences"), affected requirement IDs. Also list inconclusive checks separately.

Example F→C expansion:
```
F → C Detail:
  ✗ ci:conformance-traces — 7086 divergence(s) in 20199 traces
  ⚠ ci:liveness-fairness-lint — fairness declarations missing for 10 properties
```

If any gaps remain after convergence, append a summary of what couldn't be auto-fixed and why.

## Important Constraints

1. **bin/qgsd-solve.cjs is NOT modified** — it remains the diagnostic engine. This skill orchestrates remediation at the skill/script level.

2. **Convergence loop is at skill level** — when the skill calls diagnostic again in Step 4, it uses `--json --report-only` to get fresh data. The skill then decides whether to loop back to Step 3 or exit. The script's internal auto-close loop is bypassed.

3. **Error handling** — each remediation dispatch is wrapped in error handling. If a sub-skill or script fails, log the failure and continue to the next gap type. Do not let one failure abort the entire solve cycle.

4. **Ordering** — remediation order is strict because R→F must precede F→T (new formal specs create new invariants needing test backing). T→C fixes must happen before F→C verification (tests must pass before checking formal properties against code).

5. **Full skill arsenal** — the solver dispatches to the right skill for each gap type. It never stops at "manual review required" if a skill exists that can attempt the fix. The hierarchy is:
   - **close-formal-gaps** for missing formal models (R→F)
   - **formal-test-sync** for missing test backing (F→T)
   - **fix-tests** for failing tests (T→C)
   - **quick** for constant mismatches (C→F) and syntax/scope errors in formal models (F→C)
   - **debug** for conformance divergences and verification counterexamples (F→C)

6. **Cascade awareness** — fixing one layer often creates gaps in the next (e.g., new formal models → new F→T gaps → new stubs → new T→C gaps). The iteration loop handles this naturally. Expect the total to fluctuate between iterations before converging.

</process>
