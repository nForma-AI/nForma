---
name: nf:solve
description: Orchestrator skill that dispatches diagnostic, remediation, and reporting sub-skills via Agent tool, managing the convergence loop and report-only gate
argument-hint: [--report-only] [--max-iterations=N] [--json] [--verbose] [--targets=<path>] [--skip-observe] [--focus="<phrase>"]
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

Sub-skill files (do NOT @-include — they are loaded by Agent subprocesses):
- ~/.claude/commands/nf/solve-diagnose.md (Steps 0-1)
- ~/.claude/commands/nf/solve-classify.md (Haiku pre-classification)
- ~/.claude/commands/nf/solve-remediate.md (Steps 3a-3m)
- ~/.claude/commands/nf/solve-report.md (Steps 6-8)

Path resolution: Always use $HOME/.claude/commands/nf/ paths in Agent prompts.
Falls back to commands/nf/ (CWD-relative) only if the home path doesn't exist.
</execution_context>

<process>

## Flag Extraction

Parse all CLI flags from the user's invocation. Extract `--focus="<phrase>"` if present.
Store as `focusPhrase` variable (string or null) for forwarding to sub-skills and bin/nf-solve.cjs.
Initialize at the very start of the process block:
  - If args contain `--focus="X"` or `--focus=X`, set `focusPhrase = X`
  - Otherwise, set `focusPhrase = null`
Use `focusPhrase` in Phase 3b bash command and Phase 4 Agent call.

## Phase 1: Diagnose

```
Agent(
  subagent_type="general-purpose",
  description="solve: diagnostic sweep",
  prompt="First resolve the sub-skill path: try $HOME/.claude/commands/nf/solve-diagnose.md, fall back to commands/nf/solve-diagnose.md if not found. Read and follow it end-to-end.
CLI flags from orchestrator: {flags}
After completing all steps, output ONLY the JSON result object described in the output_contract section of solve-diagnose.md."
)
```

Parse the Agent's JSON output:
- If `status == "error"`: log reason, exit gracefully
- If `status == "bail"` (zero residual): skip to Phase 4 (Report) with baseline as post_residual
- Store: `baseline_residual`, `open_debt`, `heatmap`, `issues`, `targets`

## Phase 1b: Classify (Haiku pre-triage)

After diagnostic completes, pre-classify all sweep items using Haiku sub-agent.
This populates solve-classifications.json so reverse flow items (D→C, C→R, T→R, D→R)
have genuine/fp/review badges when viewed in the TUI.

```
Agent(
  subagent_type="general-purpose",
  description="solve: Haiku classification",
  prompt="First resolve the sub-skill path: try $HOME/.claude/commands/nf/solve-classify.md, fall back to commands/nf/solve-classify.md if not found. Read and follow it end-to-end.
CLI flags from orchestrator: {flags}
After completing all steps, output ONLY the JSON result object described in the output_contract section."
)
```

Parse the Agent's JSON output:
- If `status == "error"`: log warning but do NOT abort (classification is best-effort)
- Store: `classification_verdicts` for inclusion in final report

## Phase 2: Report-Only Gate

If `--report-only` flag was passed:
- Display the baseline residual table from diagnose output
- STOP -- do not proceed to remediation
- Exit with status based on whether residual is zero (0) or non-zero (1)

## Phase 3: Remediate (convergence loop)

Default `max_iterations = 5`. Override with `--max-iterations=N`.

For `iteration = 1` to `max_iterations`:

**3a. Dispatch remediation:**
```
Agent(
  subagent_type="general-purpose",
  description="solve: remediation iteration {N}",
  prompt="First resolve the sub-skill path: try $HOME/.claude/commands/nf/solve-remediate.md, fall back to commands/nf/solve-remediate.md if not found. Read and follow it end-to-end.
Input context (JSON):
{\"residual_vector\": ..., \"open_debt\": ..., \"heatmap\": ..., \"targets\": ..., \"iteration\": N}
After completing all remediation steps, output ONLY the JSON result object described in the output_contract section."
)
```
Parse remediation output JSON.
Extract `capped_layers` from `remediation_report.capped_layers` (default `[]`). Store for inclusion in the final solve output — this array lets users distinguish "residual remains because capped" from "residual remains because stuck" (CONV-03).
If `status == "bail"` or `"error"`: break loop, proceed to Phase 4.

**3b. Re-diagnostic sweep (Step 4):**
```bash
POST=$(node ~/.claude/nf-bin/nf-solve.cjs --json --report-only --fast --project-root=$(pwd)${focusPhrase:+ --focus="$focusPhrase"})
```
If `~/.claude/nf-bin/nf-solve.cjs` does not exist, fall back to `bin/nf-solve.cjs`.
Parse `post_residual` from the JSON output.

**3c. Convergence check (Step 5):**
- If `post_residual.total == 0`: log convergence, break
- Compute `automatable_residual` = sum of r_to_f, f_to_t, c_to_f, t_to_c, f_to_c, r_to_d, l1_to_l3, l3_to_tc (exclude d_to_c which is manual-only; include gate residuals)
- If `automatable_residual == 0` OR no automatable layer changed since last iteration: break
- **Cycle detection (CONV-01):** Layers exhibiting A-B-A-B oscillation patterns (detected by `bin/solve-cycle-detector.cjs`) are excluded from the "any automatable layer changed" condition. This prevents the loop from continuing solely because oscillating layers keep flip-flopping. The solver reports detected oscillating layers in its JSON output as `oscillating_layers`.
- Else: update `residual_vector = post_residual`, continue loop

**Cascade-aware convergence:** Do NOT use total residual for the loop condition. Fixing R->F creates F->T gaps (total goes UP), but the system is making progress. Use per-layer change detection: if ANY automatable layer changed (up or down), there is still work to do. Only stop when all automatable layers are stable or at zero.

**Debt resolution check:** After convergence check, resolve debt entries whose layers now show zero residual:
```javascript
const _nfBin = (n) => { const p = require('path').join(require('os').homedir(), '.claude/nf-bin', n); return require('fs').existsSync(p) ? p : './bin/' + n; };
const { transitionDebtEntries, matchDebtToResidual, summarizeDebtProgress } = require(_nfBin('solve-debt-bridge.cjs'));
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

```
Agent(
  subagent_type="general-purpose",
  description="solve: final report",
  prompt="First resolve the sub-skill path: try $HOME/.claude/commands/nf/solve-report.md, fall back to commands/nf/solve-report.md if not found. Read and follow it end-to-end.
Input context (JSON):
{\"baseline_residual\": ..., \"post_residual\": ..., \"iteration_count\": N, \"flags\": {\"verbose\": bool, \"json\": bool}, \"focus\": focusPhrase ? {\"phrase\": focusPhrase} : null}
Note: baseline_residual is the session-start snapshot. The report sub-skill independently re-snapshots at report time for baseline drift detection (CONV-04) via Step 6.2.
Display all tables and reports as described in the process section."
)
```

## Phase 5: Auto-Commit Artifacts

After reporting completes, stage and commit all solve artifacts so they don't accumulate as unstaged changes.

```bash
# Stage ALL solve-touched paths — modified, deleted, AND untracked
# Use git add -A with pathspecs to catch new files the solve created
git add -A .planning/formal/ 2>/dev/null
git add .planning/upstream-state.json docs/dev/requirements-coverage.md 2>/dev/null
# Also catch any bin/ or test/ files that solve sub-skills may have created/modified
git add -A bin/ test/ 2>/dev/null

# Check if there's anything to commit
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "chore(solve): update formal verification artifacts

Automated commit from /nf:solve — includes layer manifests, gate results,
evidence snapshots, model registry, and requirements coverage updates."
fi
```

This commit is non-blocking — if staging or committing fails (e.g., no changes, hook rejection), log and continue. The solve report has already been displayed.

**IMPORTANT:** The `git add -A` with pathspecs stages new (untracked), modified, AND deleted files within those directories. This ensures files created by remediation sub-skills (new Alloy models, test stubs, etc.) and files deleted during cleanup are all captured.

## Important Constraints

1. **bin/nf-solve.cjs is NOT modified** -- it remains the diagnostic engine. This skill orchestrates remediation at the skill/script level.

2. **Convergence loop is at skill level** -- when the skill calls diagnostic again in Step 4, it uses `--json --report-only` to get fresh data. The skill then decides whether to loop or exit.

3. **Error handling** -- each sub-skill dispatch is wrapped in error handling. If a sub-skill fails, log the failure and continue to the next phase. Do not let one failure abort the entire solve cycle.

6. **Cascade awareness** -- fixing one layer often creates gaps in the next (e.g., new formal models -> new F->T gaps). The iteration loop handles this naturally. Expect the total to fluctuate between iterations before converging. Reverse discovery candidates that get approved also feed into the forward flow in subsequent iterations.

7. **Reverse flows use quorum consensus** -- C->R, T->R, and D->R candidates are discovered autonomously then dispatched to quorum for unanimous consensus approval. On unanimous APPROVE, candidates auto-promote to requirements. On debate exhaustion without consensus, candidates are shelved to acknowledged-not-required.json. Reverse residuals do NOT count toward the automatable total or affect the convergence check.

</process>
