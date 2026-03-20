---
name: nf:solve-diagnose
description: Diagnostic phase sub-skill for nf:solve — runs legacy migration, config audit, observe refresh, debt load, initial diagnostic sweep, git churn heatmap, and issue classification
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Run the diagnostic phase of the nForma consistency solver. This sub-skill handles Steps 0-1: legacy migration, config audit, observe target loading, inline observe refresh, debt load, hypothesis measurement, initial diagnostic sweep, git churn heatmap analysis, and issue classification. Returns a compact JSON result for the orchestrator to use in remediation and convergence decisions.

This is an internal-only sub-skill dispatched by the nf:solve orchestrator via Agent tool prompts. It is NOT user-invocable.
</objective>

<execution_context>
PATH RESOLUTION: All bare `./bin/` require paths must resolve portably: try `$HOME/.claude/nf-bin/` first, fall back to `./bin/`. Use this helper at the top of any node -e snippet:
```javascript
const _nfBin = (n) => { const p = require('path').join(require('os').homedir(), '.claude/nf-bin', n); return require('fs').existsSync(p) ? p : './bin/' + n; };
```
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input. If a sub-step fails, log the
failure and continue to the next step. The only valid reason to stop is:
a fatal error that prevents any diagnostic output.

This sub-skill accepts the same CLI flags as the orchestrator:
- `--targets=<path>` — scope remediation to observe targets
- `--skip-observe` — skip inline observe refresh
- `--json` — JSON output mode
- `--verbose` — verbose output
- `--focus="<phrase>"` -- scope diagnostics to requirements matching the focus topic
</execution_context>

<input_contract>
The orchestrator passes CLI flags as part of the Agent prompt. No structured JSON input is required — this sub-skill reads from disk and CLI flags.
</input_contract>

<output_contract>
At the end of execution, emit a compact JSON result to stdout:

```json
{
  "status": "ok" | "bail" | "error",
  "reason": null | "zero_residual" | "diagnostic_script_failed" | "diagnosis_blocked_by_quorum" | "diagnosis_escalated" | "...",
  "root_cause_verdict": "APPROVED" | "BLOCKED" | "ESCALATED" | "SKIPPED_NO_HYPOTHESES" | "QUORUM_UNAVAILABLE",
  "baseline_residual": { /* full residual_vector from nf-solve.cjs */ },
  "open_debt": [ /* array from readOpenDebt */ ],
  "heatmap": { "top_files": [ /* top 20 from summary output */ ], "full_path": ".planning/formal/evidence/git-heatmap.json" },
  "issues": { /* from issue-classifier.cjs */ },
  "fsm_candidates": [], /* implicit FSM candidates from heatmap scan */
  "targets": null | { /* from observe-solve-pipe.cjs */ },
  "hypothesis_measurements": null | { /* from hypothesis-measure.cjs — tier-1 assumption verdicts */ }
}
```

When `status` is `"bail"` (e.g., zero residual -- nothing to remediate), the orchestrator skips remediation and goes straight to reporting. When `status` is `"error"`, the orchestrator logs the reason and exits gracefully. When `root_cause_verdict` is `"BLOCKED"` or `"ESCALATED"`, the status is `"bail"` and remediation does not proceed.
</output_contract>

<process>

## Step 0: Legacy .formal/ Migration

Before running the diagnostic sweep, check for a legacy `.formal/` directory at the project root (next to `.planning/`). This is the OLD layout from before formal verification was consolidated under `.planning/formal/`.

Run the migration script using absolute paths (or fall back to CWD-relative):

```bash
MIGRATE=$(node ~/.claude/nf-bin/migrate-formal-dir.cjs --json --project-root=$(pwd) 2>&1)
```

If `~/.claude/nf-bin/migrate-formal-dir.cjs` does not exist, fall back to `bin/migrate-formal-dir.cjs` (CWD-relative).
If neither exists, skip this step silently — the migration script is optional for projects that never had a legacy layout.

Parse the JSON output:
- If `legacy_found` is `false`: log `"Step 0: No legacy .formal/ found — skipping migration"` and proceed to Step 1.
- If `legacy_found` is `true`: log the migration summary: `"Step 0: Migrated legacy .formal/ — {copied} files copied, {skipped} conflicts (canonical .planning/formal/ preserved)"`. The legacy `.formal/` directory is NOT auto-removed — the user can run `node bin/migrate-formal-dir.cjs --remove-legacy --project-root=$(pwd)` manually after verifying the migration.

**Important:** This step is fail-open. If the migration script errors or is not found, log the issue and proceed to Step 1. Migration failure must never block the diagnostic sweep.

### Step 0b: Config Audit

Run the config audit script to detect silent misconfigurations:

```bash
AUDIT=$(node ~/.claude/nf-bin/config-audit.cjs --json --project-root=$(pwd) 2>/dev/null)
```

If `~/.claude/nf-bin/config-audit.cjs` does not exist, fall back to `bin/config-audit.cjs` (CWD-relative).
If neither exists, skip this step silently.

Parse the JSON output:
- If `warnings` array is non-empty: log each warning to stderr as `"Step 0b: CONFIG WARNING: {warning}"`. These are non-blocking but visible in the solve output.
- If `missing` array is non-empty: log `"Step 0b: {missing.length} provider slots have no agent_config entry"`.

**Important:** This step is fail-open. Config audit failure must never block the diagnostic sweep.

### Step 0c: Load Observe Targets (optional)

If `--targets=<path>` flag was passed:

1. Read the targets manifest:
   ```javascript
   const { readTargetsManifest } = require(_nfBin('observe-solve-pipe.cjs'));
   const targets = readTargetsManifest(targetsPath);
   ```

2. If targets is null or empty, log: `"Step 0c: No valid targets manifest at {path} -- falling back to full sweep"` and proceed normally.

3. If targets is valid, log:
   ```
   Step 0c: Loaded {targets.targets.length} observe target(s) -- scoping remediation
   ```

4. Store targets in solve context. During remediation dispatch, when targets are loaded:
   - Include target titles and severity in the remediation context string passed to sub-skills
   - Add a "Prioritized from /nf:observe" note to the solve output header
   - The targets do NOT restrict which layer transitions are checked (full sweep still runs), but they add focused context so remediation sub-skills know which specific issues the user wants addressed

**Important:** This step is fail-open. If the targets file is missing or malformed, solve proceeds with its normal full sweep.

### Step 0d: Inline Observe Refresh + Debt Load

Run observe inline to get fresh data BEFORE the diagnostic sweep. This ensures debt.json reflects the latest state.

If `--skip-observe` flag was passed, skip the inline observe refresh and go directly to debt load. This is useful when observe was just run manually.

**Observe refresh** (unless `--skip-observe`):

Log: `"Step 0d: Running inline observe to refresh debt ledger..."`

Use the shared observe pipeline (`bin/observe-pipeline.cjs`) — the same pipeline that `/nf:observe` uses for its data-gathering steps. This ensures handler registration, internal source injection, and debt writing stay in sync between both consumers.

```javascript
const { refreshDebtLedger } = require(_nfBin('observe-pipeline.cjs'));
const { written, updated, sourceCount } = await refreshDebtLedger();
```

Log: `"Step 0d: Observe refresh complete — {written} new, {updated} updated debt entries (from {sourceCount} sources)"`

**Debt load** (always runs):

Load open debt for the solve loop:

```javascript
const { readOpenDebt, matchDebtToResidual } = require(_nfBin('solve-debt-bridge.cjs'));
const { entries: openDebt } = readOpenDebt('.planning/formal/debt.json');
```

Log: `"Step 0d: {openDebt.length} open/acknowledged debt entries loaded"`

Store `openDebt` in solve context for use in remediation and convergence checks.

If `--targets=<path>` was provided in Step 0c AND targets loaded successfully, filter `openDebt` to only entries whose fingerprint matches a target's fingerprint. This scopes debt-driven remediation to the user's selection.

**Important:** This step is fail-open. If observe config is missing, handlers fail, or debt read fails, log the issue and proceed to Step 1 with an empty openDebt array.

### Step 0e: Hypothesis Measurement Collection

Measure formal model assumptions against actual observed data to detect violated hypotheses.

Run the hypothesis measurement collector:

```bash
node ~/.claude/nf-bin/hypothesis-measure.cjs --json --project-root=$(pwd) 2>/dev/null
```

If `~/.claude/nf-bin/hypothesis-measure.cjs` does not exist, fall back to `bin/hypothesis-measure.cjs` (CWD-relative).
If neither exists, skip this step silently.

Parse the JSON output:
- If `verdicts.VIOLATED > 0`: log `"Step 0e: {VIOLATED} hypothesis violation(s) detected out of {total_measured} tier-1 assumptions -- flagged for remediation"`
- If `verdicts.VIOLATED === 0`: log `"Step 0e: All {total_measured} tier-1 assumptions confirmed or unmeasurable"`

Store the measurement result in solve context. The h_to_m residual layer in nf-solve.cjs will pick up `hypothesis-measurements.json` during the diagnostic sweep.

**Important:** This step is fail-open. If the measurement script errors or is not found, log the issue and proceed to Step 1. Hypothesis measurement failure must never block the diagnostic sweep.

### Step 0f: Root Cause Quorum Vote (ROOT-02)

After hypothesis measurement (Step 0e), dispatch a quorum vote on the root cause diagnosis before proceeding to the diagnostic sweep. This prevents incorrect root causes from cascading through remediation layers.

**Skip condition:** If Step 0e produced no hypothesis measurements (hypothesis_measurements is null or empty), skip this step:
```
Log: "Step 0f: No hypothesis measurements — skipping quorum vote (nothing to gate)"
```
Set `root_cause_verdict = "SKIPPED_NO_HYPOTHESES"` and proceed to Step 1.

**Quorum preflight:**

```bash
PREFLIGHT=$(node "$HOME/.claude/nf-bin/quorum-preflight.cjs" --all)
```

Parse PREFLIGHT JSON to get `$MAX_QUORUM_SIZE` and active slot names from `team` keys.

Compute fan-out: `FAN_OUT_COUNT = 3` (medium risk). `$DISPATCH_LIST` = first `FAN_OUT_COUNT - 1` slot names from team keys.

**Build diagnostic context for voters:**

Create a compact diagnostic summary from the hypothesis measurement results (Step 0e output). Include:
- hypothesis_measurements verdicts (VIOLATED/CONFIRMED/UNMEASURABLE counts)
- Top violated hypotheses (if any) with their assumption text and measurement data
- The baseline residual vector summary (if available from a prior run)

Write this context to `.planning/solve/diagnose-hypothesis-log.json` (create directory if needed).

**Dispatch quorum workers:**

For each slot in `$DISPATCH_LIST`, dispatch a parallel `nf-quorum-slot-worker` Task:

```yaml
slot: <slotName>
round: 1
timeout_ms: 30000
repo_dir: <absolute path to project root>
mode: A
question: "Review the hypothesis measurement results and diagnostic context below. Is the root cause diagnosis sound, complete, and ready for the diagnostic sweep and subsequent remediation? Vote APPROVE if the diagnosis is actionable and sufficient. Vote BLOCK if the diagnosis is incomplete, contradictory, or likely to lead remediation astray."
artifact_path: ".planning/solve/diagnose-hypothesis-log.json"
review_context: "This is a diagnosis gate (ROOT-02). Evaluate whether the identified root causes from hypothesis measurement are sufficient and accurate. BLOCK is absolute — any BLOCK prevents the diagnostic sweep from running."
request_improvements: false
```

Dispatch as parallel sibling `nf-quorum-slot-worker` Tasks with `model="haiku", max_turns=100`.

**Evaluate consensus per CE-1/CE-2/CE-3:**
- CE-1: Claude's position is advisory only (not counted in vote tally)
- CE-2: Any BLOCK from a valid (non-UNAVAIL) external voter prevents consensus (BLOCK is absolute)
- CE-3: Consensus = 100% of valid external voters agree (unanimity)

Deliberate up to 10 rounds per R3.3 if votes are split.

**Route on verdict:**

- **APPROVED:** Log `"Step 0f: Root cause diagnosis APPROVED by quorum — proceeding to diagnostic sweep"`. Set `root_cause_verdict = "APPROVED"`. Proceed to Step 1.

- **BLOCKED:** Log `"Step 0f: Root cause diagnosis BLOCKED by quorum — halting remediation"`. Set `root_cause_verdict = "BLOCKED"`. Set `status = "bail"` and `reason = "diagnosis_blocked_by_quorum"`. Return the output_contract immediately — do NOT proceed to Step 1. The orchestrator will handle the blocked diagnosis (log and exit gracefully).

- **ESCALATED:** Log `"Step 0f: Root cause diagnosis ESCALATED — requires human review"`. Set `root_cause_verdict = "ESCALATED"`. Set `status = "bail"` and `reason = "diagnosis_escalated"`. Return the output_contract immediately.

**Fail-open:** If quorum preflight fails (no slots available), or all slots return UNAVAIL, log: `"Step 0f: Quorum unavailable — proceeding without consensus (fail-open)"`. Set `root_cause_verdict = "QUORUM_UNAVAILABLE"`. Proceed to Step 1.

## Step 1: Initial Diagnostic Sweep

Run the diagnostic solver using absolute paths (or fall back to CWD-relative):

```bash
BASELINE=$(node ~/.claude/nf-bin/nf-solve.cjs --json --report-only --project-root=$(pwd))
```

If ~/.claude/nf-bin/nf-solve.cjs does not exist, fall back to bin/nf-solve.cjs (CWD-relative).
If neither exists, error with: "nForma solve scripts not installed. Run `node bin/install.js --claude --global` from the nForma repo."

Parse the JSON output to extract the `residual_vector` object. Key fields:
- `residual_vector.r_to_f.residual` — count of requirements lacking formal coverage
- `residual_vector.f_to_t.residual` — count of formal invariants lacking test backing
- `residual_vector.c_to_f.residual` — count of constant mismatches (Code vs Formal)
- `residual_vector.t_to_c.residual` — count of failing unit tests
- `residual_vector.f_to_c.residual` — count of failing formal checks
- `residual_vector.r_to_d.residual` — count of requirements not documented in developer docs
- `residual_vector.d_to_c.residual` — count of stale structural claims in docs
- `residual_vector.total` — total residual across all layers

Store the parsed baseline residual as `baseline_residual` for the before/after comparison at the end.

Display the baseline residual in human-readable format (unified table):
```
Layer Transition             Residual  Health
─────────────────────────────────────────────
R -> F (Req->Formal)             N    [status]
F -> T (Formal->Test)            N    [status]
C -> F (Code->Formal)            N    [status]
T -> C (Test->Code)              N    [status]
F -> C (Formal->Code)            N    [status]
R -> D (Req->Docs)               N    [status]
D -> C (Docs->Code)              N    [status]
P -> F (Prod->Formal)            N    [status]
  Forward subtotal:              N
─ Reverse Discovery (human-gated) ─────────
C -> R (Code->Req)               N    [status]
T -> R (Test->Req)               N    [status]
D -> R (Docs->Req)               N    [status]
  Discovery subtotal:            N
─ Layer Alignment (cross-layer gates) ─────
L1 -> L2 (Gate A)                N    [status]
L2 -> L3 (Gate B)                N    [status]
L3 -> TC (Gate C)                N    [status]
  Alignment subtotal:            N
═════════════════════════════════════════════
Grand total:                     N
```

Health status: GREEN (0), YELLOW (1-3), RED (4+), or UNKNOWN (error).

### Git Churn Heatmap

Run git heatmap analysis to identify files with high recent churn:

```bash
node bin/git-heatmap.cjs 2>/dev/null || true
```

This refreshes `git-heatmap.json` on disk (full data for machine consumers) and prints a human-readable summary (~3KB). Do NOT use `--json` here — the full JSON output is ~3MB and will overflow the agent context. Other scripts can read the on-disk file directly.

### Issue Classification (operational priority ranking)

Run the issue classifier to rank operational issues by severity from telemetry data:

```bash
node bin/issue-classifier.cjs --json 2>/dev/null || true
```

Parse the JSON output. If issues are found, log: `"Issue classifier: {count} operational issues ranked — {critical} critical, {warning} warnings"`

The classifier reads from telemetry data (produced by telemetry-collector.cjs) and surfaces issues that may affect solve cycle reliability. Critical issues should be flagged in the diagnostic output but do NOT block remediation (fail-open).

### Implicit State Machine Detection

Scan the top files from the git churn heatmap (up to top 10 by churn score) for implicit state machine patterns.

**File source:** The heatmap command (`node bin/git-heatmap.cjs`) already ran above and printed a human-readable summary. Use Grep on each file path extracted from the on-disk artifact at `.planning/formal/evidence/git-heatmap.json` using the field path `uncovered_hot_zones[].file` (sorted by `priority` descending, take first 10 code files). Do NOT read the full JSON into agent context — use a shell command to extract the file list, filtering to code files only and excluding non-source paths:
```bash
jq -r '[.uncovered_hot_zones[] | select(.file | test("\\.(js|ts|cjs|mjs|py|go|rb|java|cs|rs)$")) | select(.file | test("^\\.planning/|^dist/|^node_modules/") | not)] | sort_by(.priority // 0) | reverse | .[].file' .planning/formal/evidence/git-heatmap.json | head -10
```

**Heuristic A — Multi-flag boolean cluster:**
For each file, search for boolean variable declarations or assignments (lines matching `(bool|boolean|let|var|const)\s+\w+(Pending|Active|Done|Started|Running|Stopped|Failed|Ready|Busy|Locked|Open|Closed|Enabled|Disabled)\s*[=:]`). If 3 or more such flags appear in the same file, record it as an FSM candidate with reason `"multi-flag-boolean"`.

**Heuristic B — Enum-like string state variable (heuristic — may produce false positives; intended for candidate surfacing only, not proof):**
For each file, search for patterns where string literals appear in 3 or more conditional comparisons (e.g., `if.*===\s*['"][A-Z_]+['"]` or `case\s+['"][A-Z_]+['"]:`). If 3+ such patterns appear in the file, flag it as an FSM candidate with reason `"enum-string-state"`. Note: a grep count of string literals cannot prove single-variable usage — this heuristic flags files as FSM candidates with possible false positives.

Both heuristics are **fail-open**: if the heatmap file is missing, if grep errors, or if a target file does not exist, skip silently and proceed.

Log results:
- If 0 candidates found: `"Step 1 FSM scan: No implicit state machine patterns detected in top ${N} heatmap files"`
- If candidates found: `"Step 1 FSM scan: {count} implicit FSM candidate(s) detected — recommend extraction + fsm-to-tla.cjs --scaffold-config"`
  For each candidate, log: `"  {file}: {reason} (flags: {matched_names_or_values})"`

Store the candidates array as `fsm_candidates` in the solve context.

</process>
