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
Run the diagnostic phase of the nForma consistency solver. This sub-skill handles Steps 0-1: legacy migration, config audit, observe target loading, inline observe refresh, debt load, initial diagnostic sweep, git churn heatmap analysis, and issue classification. Returns a compact JSON result for the orchestrator to use in remediation and convergence decisions.

This is an internal-only sub-skill dispatched by the nf:solve orchestrator via Agent tool prompts. It is NOT user-invocable.
</objective>

<execution_context>
PATH RESOLUTION: All `require('./bin/...')` paths must resolve portably: try `$HOME/.claude/nf-bin/` first, fall back to `./bin/`. Use this helper at the top of any node -e snippet:
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
  "reason": null | "zero_residual" | "diagnostic_script_failed" | "...",
  "baseline_residual": { /* full residual_vector from nf-solve.cjs */ },
  "open_debt": [ /* array from readOpenDebt */ ],
  "heatmap": { /* from git-heatmap.cjs */ },
  "issues": { /* from issue-classifier.cjs */ },
  "targets": null | { /* from observe-solve-pipe.cjs */ }
}
```

When `status` is `"bail"` (e.g., zero residual -- nothing to remediate), the orchestrator skips remediation and goes straight to reporting. When `status` is `"error"`, the orchestrator logs the reason and exits gracefully.
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

Execute observe's core data-gathering steps programmatically (NOT by invoking the full `/nf:observe` skill which prompts the user). Instead, run the observe pipeline directly:

```javascript
const { loadObserveConfig } = require(_nfBin('observe-config.cjs'));
const { registerHandler, dispatchAll } = require(_nfBin('observe-registry.cjs'));
const { handleGitHub, handleSentry, handleSentryFeedback, handleBash, handleInternal, handleUpstream, handleDeps } = require(_nfBin('observe-handlers.cjs'));
const { writeObservationsToDebt } = require(_nfBin('observe-debt-writer.cjs'));

// Register all handlers
registerHandler('github', handleGitHub);
registerHandler('sentry', handleSentry);
registerHandler('sentry_feedback', handleSentryFeedback);
registerHandler('bash', handleBash);
registerHandler('internal', handleInternal);
registerHandler('upstream', handleUpstream);
registerHandler('deps', handleDeps);

const config = loadObserveConfig();
// Inject internal source unconditionally
if (!config.sources.find(s => s.type === 'internal')) {
  config.sources.push({ type: 'internal', label: 'Internal Work', issue_type: 'issue' });
}

const results = await dispatchAll(config.sources, {});
// Handle pending_mcp results same as observe Step 4b

const allObservations = results.filter(r => r.status === 'ok').flatMap(r => r.issues || []);
const { written, updated } = writeObservationsToDebt(allObservations);
```

Log: `"Step 0d: Observe refresh complete — {written} new, {updated} updated debt entries"`

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
node bin/git-heatmap.cjs --json 2>/dev/null || true
```

Produces a ranked list of files by commit frequency and recency-weighted churn. Files at the top of the heatmap are likely candidates for the current issue. Feed heatmap results into the diagnostic context for targeted investigation.

### Issue Classification (operational priority ranking)

Run the issue classifier to rank operational issues by severity from telemetry data:

```bash
node bin/issue-classifier.cjs --json 2>/dev/null || true
```

Parse the JSON output. If issues are found, log: `"Issue classifier: {count} operational issues ranked — {critical} critical, {warning} warnings"`

The classifier reads from telemetry data (produced by telemetry-collector.cjs) and surfaces issues that may affect solve cycle reliability. Critical issues should be flagged in the diagnostic output but do NOT block remediation (fail-open).

</process>
