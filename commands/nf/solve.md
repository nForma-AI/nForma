---
name: nf:solve
description: Orchestrator skill that dispatches diagnostic, remediation, and reporting sub-skills via Agent tool, managing the convergence loop and report-only gate
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose] [--targets=<path>] [--skip-observe]
allowed-tools:
  - Read
  - Bash
  - Agent
---

<objective>
Thin orchestrator for the nForma consistency solver. Dispatches to three sub-skills via Agent tool: solve-diagnose (Steps 0-1), solve-remediate (Steps 3a-3m), and solve-report (Steps 6-8). Retains the convergence loop (Steps 4-5), report-only gate (Step 2), and structured error handling.
</objective>

<execution_context>
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input. If a sub-skill fails, log the
failure and continue. The only valid reason to stop is:
all iterations exhausted, or total residual is zero.

RAM BUDGET: Never exceed 3 concurrent subagent Tasks at any point during
execution. Sub-skill Agent calls are sequential (diagnose -> remediate -> report).

@commands/nf/solve-diagnose.md
@commands/nf/solve-remediate.md
@commands/nf/solve-report.md
</execution_context>

<process>

## Phase 1: Diagnose

Dispatch Agent to run `solve-diagnose`:
- Pass all CLI flags: `--targets`, `--skip-observe`, `--json`, `--verbose`
- Read the compact JSON result from the Agent's output
- If `status == "error"`: log reason, exit gracefully
- If `status == "bail"` (zero residual): skip to Phase 3 (Report) with baseline as post_residual
- Store: `baseline_residual`, `open_debt`, `heatmap`, `issues`, `targets`

## Phase 2: Report-Only Gate

If `--report-only` flag was passed:
- Display the baseline residual table from diagnose output
- STOP -- do not proceed to remediation
- Exit with status based on whether residual is zero (0) or non-zero (1)

## Phase 3: Remediate (convergence loop)

Default `max_iterations = 5`. Override with `--max-iterations=N`.

For `iteration = 1` to `max_iterations`:

**3a. Dispatch remediation:**
Dispatch Agent to run `solve-remediate` with:
- `residual_vector` (baseline on first iteration, post_residual on subsequent)
- `open_debt`, `heatmap`, `targets`, `iteration` number
- Read remediation output JSON
- If `status == "bail"` or `"error"`: break loop, proceed to Phase 4

**3b. Re-diagnostic sweep (Step 4):**
```bash
POST=$(node ~/.claude/nf-bin/nf-solve.cjs --json --report-only --project-root=$(pwd))
```
If `~/.claude/nf-bin/nf-solve.cjs` does not exist, fall back to `bin/nf-solve.cjs`.
Parse `post_residual` from the JSON output.

**3c. Convergence check (Step 5):**
- If `post_residual.total == 0`: log convergence, break
- Compute `automatable_residual` = sum of r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, r_to_d, l1_to_l2, l2_to_l3, l3_to_tc (exclude d_to_c which is manual-only; include gate residuals)
- If `automatable_residual == 0` OR no automatable layer changed since last iteration: break
- Else: update `residual_vector = post_residual`, continue loop

**Cascade-aware convergence:** Do NOT use total residual for the loop condition. Fixing R->F creates F->T gaps (total goes UP), but the system is making progress. Use per-layer change detection: if ANY automatable layer changed (up or down), there is still work to do. Only stop when all automatable layers are stable or at zero.

**Debt resolution check:** After convergence check, resolve debt entries whose layers now show zero residual:
```javascript
const { transitionDebtEntries, matchDebtToResidual, summarizeDebtProgress } = require('./bin/solve-debt-bridge.cjs');
const postMatched = matchDebtToResidual(openDebt, post_residual);
const resolvedFPs = postMatched.matched
  .filter(m => post_residual[m.layer]?.residual === 0)
  .map(m => m.entry.fingerprint);
transitionDebtEntries('.planning/formal/debt.json', resolvedFPs, 'resolving', 'resolved');
const progress = summarizeDebtProgress('.planning/formal/debt.json');
```
Log: `"Debt: {resolvedFPs.length} entries resolved. Ledger: {progress.open} open, {progress.resolving} resolving, {progress.resolved} resolved"`

If openDebt entries remain in 'resolving' status, treat as automatable work remaining -- continue looping up to max iterations.

## Phase 4: Report

Dispatch Agent to run `solve-report` with:
- `baseline_residual`, `post_residual`, `iteration_count`
- `flags`: `{ verbose, json }`

## Important Constraints

1. **bin/nf-solve.cjs is NOT modified** -- it remains the diagnostic engine. This skill orchestrates remediation at the skill/script level.

2. **Convergence loop is at skill level** -- when the skill calls diagnostic again in Step 4, it uses `--json --report-only` to get fresh data. The skill then decides whether to loop or exit.

3. **Error handling** -- each sub-skill dispatch is wrapped in error handling. If a sub-skill fails, log the failure and continue to the next phase. Do not let one failure abort the entire solve cycle.

6. **Cascade awareness** -- fixing one layer often creates gaps in the next (e.g., new formal models -> new F->T gaps). The iteration loop handles this naturally. Expect the total to fluctuate between iterations before converging. Reverse discovery candidates that get approved also feed into the forward flow in subsequent iterations.

7. **Reverse flows are discovery-only** -- C->R, T->R, and D->R never auto-remediate. They surface candidates for human approval. Reverse residuals do NOT count toward the automatable total or affect the convergence check.

</process>
