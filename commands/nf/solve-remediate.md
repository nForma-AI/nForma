---
name: nf:solve-remediate
description: Remediation phase sub-skill for nf:solve — dispatches all 13 layer remediation steps (3a-3m) in strict dependency order with Agent-per-layer isolation
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
---

<objective>
Run the remediation phase of the nForma consistency solver. This sub-skill handles Steps 3a-3m: all 13 layer remediation dispatches in strict dependency order. Each gap type with residual > 0 is dispatched as its own Agent call to prevent context accumulation across remediation steps.

This is an internal-only sub-skill dispatched by the nf:solve orchestrator via Agent tool prompts. It is NOT user-invocable.
</objective>

<execution_context>
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input. If a sub-skill fails, log the
failure and continue to the next gap. The only valid reason to stop is:
all gap types exhausted.

RAM BUDGET: Never exceed 3 concurrent subagent Tasks at any point during
execution. Each Task subprocess consumes ~1GB RAM. With MCP servers and the
parent process, 3 parallel tasks keeps total usage under ~20GB. Dispatch in
sequential waves of 3, waiting for each wave to finish before the next.
</execution_context>

<input_contract>
The orchestrator passes a JSON object (as part of the Agent prompt or via a temp file):

```json
{
  "residual_vector": { /* from diagnostic sweep */ },
  "open_debt": [ /* from debt load */ ],
  "heatmap": { /* from heatmap analysis */ },
  "targets": null | { /* observe targets */ },
  "iteration": 1
}
```
</input_contract>

<output_contract>
At the end of execution, emit a compact JSON result:

```json
{
  "status": "ok" | "bail" | "error",
  "reason": null | "convergence_stall" | "all_layers_skipped" | "...",
  "remediation_report": {
    "dispatched": [ /* list of { layer, skill, status } */ ],
    "skipped": [ /* layers with 0 residual */ ],
    "failed": [ /* dispatches that errored */ ]
  }
}
```

When `status` is `"bail"` (e.g., all layers skipped or convergence stall detected), the orchestrator breaks the loop early. When `status` is `"error"`, the orchestrator logs the reason and exits gracefully.
</output_contract>

<process>

## Remediation Dispatch Pattern

For each gap type with residual > 0, dispatch an Agent call to handle that specific remediation. Each Agent call receives only the relevant residual detail and returns a compact status. This prevents context accumulation across the 13 remediation steps.

Track dispatched, skipped, and failed lists for the output report.

## Step 3: Remediation Dispatch (Ordered by Dependency)

**Important:** Dispatch remediation in this strict order because R->F coverage is a prerequisite for F->T test stubs. New formal specs create new invariants needing test backing.

For each gap type with `residual > 0`, dispatch in this exact order:

Additionally, after layer-based remediation dispatch, check if any openDebt entries were matched to this layer via `matchDebtToResidual()`. For matched entries, transition their status to 'resolving':

```javascript
const { transitionDebtEntries } = require('./bin/solve-debt-bridge.cjs');
const matched = matchDebtToResidual(openDebt, residualVector);
const resolvingFPs = matched.matched.map(m => m.entry.fingerprint);
transitionDebtEntries('.planning/formal/debt.json', resolvingFPs, 'open', 'resolving');
transitionDebtEntries('.planning/formal/debt.json', resolvingFPs, 'acknowledged', 'resolving');
```

Log: `"Debt: {resolvingFPs.length} entries transitioned to 'resolving'"`

### 3a. R->F Gaps (residual_vector.r_to_f.residual > 0)

Extract the list of uncovered requirement IDs from `residual_vector.r_to_f.detail.uncovered_requirements`.

If the list has 10 or fewer IDs, dispatch:
```
/nf:close-formal-gaps --batch --ids=REQ-01,REQ-02,...
```

If the list has more than 10 IDs, dispatch:
```
/nf:close-formal-gaps --batch --all
```

Log: `"Dispatching R->F remediation: close-formal-gaps for {N} uncovered requirements"`

Wait for the skill to complete. If it fails, log the failure and continue to the next gap type.

**IMPORTANT — Verify generated models:** After close-formal-gaps completes, run the model checkers on every newly created model:
- **TLA+**: `java -cp <tla2tools.jar> tlc2.TLC -config <MC*.cfg> <*.tla> -workers 1` in `.planning/formal/tla/`
- **Alloy**: `java -jar <alloy.jar> exec --output - --type text --quiet <*.als>` in `.planning/formal/alloy/`

If a model fails verification (syntax error, counterexample, scope error), fix it immediately and re-run. Up to 3 fix attempts per model. Models that pass are confirmed; models that fail after 3 attempts are logged as needing manual review.

Find tool JARs at: `.planning/formal/tla/tla2tools.jar` (or `~/.claude/.planning/formal/tla/tla2tools.jar`) and `.planning/formal/alloy/org.alloytools.alloy.dist.jar` (or `~/.claude/.planning/formal/alloy/org.alloytools.alloy.dist.jar`).

### 3b. F->T Gaps (residual_vector.f_to_t.residual > 0)

**Phase 1 — Generate stubs:** Run the formal-test-sync script to generate test stubs and update traceability sidecars:
```bash
node ~/.claude/nf-bin/formal-test-sync.cjs --project-root=$(pwd)
```

If ~/.claude/nf-bin/formal-test-sync.cjs does not exist, fall back to bin/formal-test-sync.cjs (CWD-relative).

Log: `"F->T phase 1: formal-test-sync generated {N} stubs"`

**Phase 1b — Validate recipes:** After stubs are generated, count recipe files and check completeness:
```bash
node -e "
const fs = require('fs');
const dir = '.planning/formal/generated-stubs';
const recipes = fs.readdirSync(dir).filter(f => f.endsWith('.stub.recipe.json'));
const incomplete = recipes.filter(f => {
  const r = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  return !r.source_files.length || !r.formal_property.definition;
});
console.log('[solve] Recipes: ' + recipes.length + ' total, ' + incomplete.length + ' incomplete');
"
```
Incomplete recipes (missing source_files or definition) produce lower-quality tests but do NOT block dispatch.

**Phase 2 — Implement stubs via direct parallel executor dispatch:** Stubs alone do not close the gap — they contain `assert.fail('TODO')`. The solver dispatches `nf-executor` agents directly to implement real test logic — it does NOT use `/nf:quick` for bulk stub implementation.

1. **Load context:** Parse `.planning/formal/formal-test-sync-report.json` for each stub's `requirement_id`, `formal_properties[].model_file`, `formal_properties[].property`. Also verify recipe files exist at `.planning/formal/generated-stubs/{ID}.stub.recipe.json` — these contain pre-resolved context (requirement text, property definition, source files, import hints, test strategy).

2. **Group into batches** by category prefix (e.g., all `ACT-*`, all `CONF-*`), max 5 stubs per batch. **No cap per iteration** — process ALL stubs. The convergence loop handles failures.

3. **Cleanup stale batches** — Before scaffolding, remove leftover directories from prior incomplete solve runs:
   ```bash
   for dir in .planning/quick/solve-ft-batch-*/; do
     if [ -d "$dir" ] && [ ! -f "$dir/SUMMARY.md" ] && [ ! -f "$dir/*-SUMMARY.md" ]; then
       rm -rf "$dir"
     fi
   done
   ```
   Log: `"F->T cleanup: removed {N} stale batch directories from prior run"`

4. **Scaffold and execute in just-in-time waves of 3** — To avoid orphan directories when sessions end mid-execution, do NOT write all PLAN.md files upfront. Instead, for each wave, write only that wave's PLAN.md files immediately before dispatching executors.

   MAX_PARALLEL_EXECUTORS = 3. This is a hard limit — never exceed it regardless of batch count.

   For each wave of up to 3 batches:

   **4a. Write PLAN.md files for THIS wave only.** The solve skill IS the planner for these mechanical tasks. For each batch in the wave, write a PLAN.md to `.planning/quick/solve-ft-batch-{iteration}-{B}/PLAN.md` with:
   - YAML frontmatter: `autonomous: true`, `requirements: [IDs]`, `files_modified: [stub paths]`
   - Objective: implement stubs by reading formal model + requirement text + finding source module
   - Task block per batch with `<action>/<verify>/<done>` fields
   - Each task specifies: stub file path, formal model path, property name, requirement text

   PLAN.md template for each batch:
   ```markdown
   ---
   phase: solve-ft-batch-{iteration}-{B}
   plan: 01
   type: execute
   wave: 1
   depends_on: []
   files_modified:
     - .planning/formal/generated-stubs/{ID1}.stub.test.js
     - .planning/formal/generated-stubs/{ID2}.stub.test.js
   autonomous: true
   requirements: [{ID1}, {ID2}]
   formal_artifacts: none
   ---

   <objective>
   Implement {N} test stubs for {category} requirements.

   For each stub, read its recipe JSON for pre-resolved context, then replace
   assert.fail('TODO') with real test logic using node:test + node:assert/strict.

   Formal context:
   - {ID1}: model={model_file} property={property_name} text="{requirement text}"
     recipe=.planning/formal/generated-stubs/{ID1}.stub.recipe.json
   - {ID2}: ...
   </objective>

   <tasks>
   <task type="auto">
     <name>Implement stubs: {ID1}, {ID2}, ... {IDn}</name>
     <files>.planning/formal/generated-stubs/{ID1}.stub.test.js, ...</files>
     <action>
   For each stub:
   1. Read .planning/formal/generated-stubs/{ID}.stub.recipe.json
   2. Read the stub file (.stub.test.js)
   3. Use recipe.formal_property.definition as the property under test
   4. Import from recipe.import_hint (adjust relative path if needed)
   5. Follow recipe.test_strategy:
      - structural: assert function/export exists with correct signature
      - behavioral: call function with known input, assert output matches formal property
      - constant: assert code constant === formal value from property definition
   6. If recipe.source_files is empty, use Grep to find the implementing module
   7. Replace assert.fail('TODO') with real test logic using node:test + node:assert/strict
     </action>
     <verify>node --test .planning/formal/generated-stubs/{ID1}.stub.test.js</verify>
     <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
   </task>
   </tasks>
   ```

   **4b. Dispatch executors for THIS wave.** Spawn all executors in the wave as parallel sibling Tasks:
   ```
   Wave 1: write 3 PLAN.md files -> Task(subagent_type="nf-executor", description="F->T stubs batch 1"), batch 2, batch 3
   [wait for all 3 to complete]
   Wave 2: write 3 PLAN.md files -> Task(subagent_type="nf-executor", description="F->T stubs batch 4"), batch 5, batch 6
   [wait for all 3 to complete]
   ... continue until all batches dispatched
   ```

   **Why just-in-time:** If a session ends mid-execution, only the current wave's directories exist as orphans (max 3), not the full batch set. Incomplete batches can be resumed via `/nf:resume-quick --pattern=solve-ft-batch-*`.

5. **Run tests once:** `node --test .planning/formal/generated-stubs/*.stub.test.js`. Log pass/fail counts. Failed stubs are handled by T->C in the next iteration.

6. Log: `"F->T phase 2: spawned {N} executors in waves of 3 for {M} stubs (no quorum overhead)"`

### 3c. T->C Gaps (residual_vector.t_to_c.residual > 0)

The T->C residual counts both failures and skipped tests. Extract detail:
- `detail.failed` — tests that ran and failed
- `detail.skipped` — tests marked skip (still count as unresolved gaps)
- `detail.todo` — tests marked todo (informational, do not inflate residual)

Dispatch the fix-tests skill:
```
/nf:fix-tests
```

This will discover and autonomously fix failing AND skipped tests. Skipped tests often indicate incomplete implementations or platform-specific guards that need resolution.

Log: `"Dispatching T->C remediation: fix-tests for {failed} failing + {skipped} skipped tests"`

If it fails, log the failure and continue.

### 3d. C->F Gaps (residual_vector.c_to_f.residual > 0)

Constant mismatches between code and formal specs. Display the mismatch table, then dispatch `/nf:quick` to align them:

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
/nf:quick Fix C->F constant mismatches: update formal specs OR code config to align these values: {mismatch_summary}
```

If the mismatch has `intentional_divergence: true`, skip it and log as intentional.

### 3e. F->C Gaps (residual_vector.f_to_c.residual > 0)

First, run the formal verification using absolute paths to get fresh failure data:
```bash
node ~/.claude/nf-bin/run-formal-verify.cjs --project-root=$(pwd)
```

If ~/.claude/nf-bin/run-formal-verify.cjs does not exist, fall back to bin/run-formal-verify.cjs (CWD-relative).

Then parse `.planning/formal/check-results.ndjson` and classify each failure:

| Classification | Criteria | Dispatch |
|---------------|----------|----------|
| **Syntax error** | Summary contains "Syntax error", "parse error" | `/nf:quick Fix Alloy/TLA+ syntax error in {model_file}: {error_detail}` |
| **Scope error** | Summary contains "scope", "sig" | `/nf:quick Fix scope declaration in {model_file}: {error_detail}` |
| **Conformance divergence** | check_id contains "conformance" | `/nf:quick Fix conformance trace divergences in {model_file}: {error_detail}` |
| **Verification failure** | Counterexample found | `/nf:quick Fix formal verification counterexample in {check_id}: {summary}` |
| **Missing tool** | "not found", "not installed" | Log as infrastructure gap, skip |
| **Inconclusive** | result = "inconclusive" | Skip — not a failure |

Dispatch each fixable failure **sequentially** (one at a time) to the appropriate skill. Process syntax/scope errors first (they're usually quick fixes), then conformance/verification failures (require deeper investigation). Wait for each dispatch to complete before starting the next.

Log: `"F->C: {total} checks, {pass} pass, {fail} fail — dispatching {syntax_count} to quick, {debug_count} to debug, {skip_count} skipped"`

Each dispatch is independent — if one fails, log and continue to the next. Do NOT dispatch F->C fixes in parallel.

**F->C Root-Cause Attribution:** After dispatching all F->C fixes, run `attribute-trace-divergence.cjs` to provide actionable root causes for any conformance divergences:

```bash
ATTR=$(node ~/.claude/nf-bin/attribute-trace-divergence.cjs --output-json 2>/dev/null || node bin/attribute-trace-divergence.cjs --output-json 2>/dev/null || echo '[]')
```

If the script returns non-empty JSON, log each attribution's `recommendation` field. These attributions help the next iteration target the right layer (spec-bug vs impl-bug) when dispatching fixes. Fail-open: if the script is not found or errors, skip silently.

**F->C Trace Corpus Context:** Also run `trace-corpus-stats.cjs` to provide session/action/transition context for the divergences:

```bash
node ~/.claude/nf-bin/trace-corpus-stats.cjs --json 2>/dev/null || node bin/trace-corpus-stats.cjs --json 2>/dev/null || true
```

This writes `.planning/formal/evidence/trace-corpus-stats.json` which enriches subsequent analysis. Fail-open: if the script is not found or errors, skip silently.

### 3f. R->D Gaps (residual_vector.r_to_d.residual > 0)

Requirements that shipped but are not mentioned in developer docs (docs/dev/).
User docs (docs/) are human-controlled and are never auto-modified.

Display the undocumented requirement IDs from `residual_vector.r_to_d.detail.undocumented_requirements`:

```
R->D: {N} requirement(s) undocumented in developer docs:
  - REQ-01
  - REQ-02
  ...
```

Then auto-remediate by dispatching a single `nf-executor` agent directly — it does NOT use `/nf:quick` for bulk doc generation.

1. Read `.planning/formal/requirements.json` to get the text/description for each undocumented requirement ID.
2. For each undocumented ID, identify the most relevant source file(s) by grepping the codebase for the requirement ID and its key terms (use Grep tool).
3. **Write ONE PLAN.md** to `.planning/quick/solve-rd-{iteration}/PLAN.md` covering all undocumented requirements (up to 100). The plan has multiple `<task>` blocks (one per group of ~15 IDs) for natural checkpointing. Each task specifies: requirement IDs, requirement text, relevant source files, and the output format for `docs/dev/requirements-coverage.md`.

   Each task block's action should instruct the executor to append sections following this format:
   ```
   ## {REQ-ID}: {requirement title or first 80 chars of text}

   **Requirement:** {full requirement text}

   **Implementation:** {1-3 sentence summary of how the codebase satisfies this requirement, citing specific files/functions}

   **Source files:** {comma-separated list of relevant source files}
   ```

   Do NOT modify docs/ (user docs). Only write to docs/dev/requirements-coverage.md.

4. **Spawn ONE executor:**
   ```
   Task(subagent_type="nf-executor", description="R->D: generate doc entries for {N} requirements")
   ```
   Wait for it to complete. If it fails, log the failure and continue.

Log: `"R->D: spawned 1 executor for {N} requirements (no quorum overhead)"`

### 3g. D->C Gaps (residual_vector.d_to_c.residual > 0)

Stale structural claims in documentation — file paths, CLI commands, or dependencies referenced in docs that no longer exist in the codebase. This is a manual-review-only gap.

Display the broken claims table from `residual_vector.d_to_c.detail.broken_claims`:

```
D->C: {N} stale structural claim(s) in docs:
  Doc File              Line  Type         Value                    Reason
  ──────────────────────────────────────────────────────────────────────────
  README.md             42    file_path    bin/old-script.cjs       file not found
  docs/setup.md         15    cli_command  node bin/missing.cjs     script not found
  docs/deps.md          8     dependency   old-package              not in package.json
```

Log: `"D->C: {N} stale structural claim(s) in docs — manual review required"`

Do NOT dispatch any skill — this is informational only.

### 3h. Git Heatmap Risk Prioritization (G->H)

The diagnostic sweep includes a `git_heatmap` section that identifies **uncovered hot zones** — files with high churn, bugfix frequency, or oscillating numerical constants that lack formal model coverage.

Extract from diagnostic output:
- `residual_vector.git_heatmap.detail.uncovered_hot_zones` — ranked list of files with `priority`, `signals` (churn, bugfix, numerical), and coverage gaps
- `residual_vector.git_heatmap.detail.total_hot_zones` — count of uncovered hot zones

**This is NOT informational-only — it drives formal model prioritization.**

When `total_hot_zones > 0`:
1. Take the top 5 hot zones by priority score
2. For each hot zone file, check if it already has a formal model in `.planning/formal/` (TLA+, Alloy, or PRISM spec referencing the file)
3. For any hot zone file WITHOUT a formal model, dispatch `/nf:close-formal-gaps` with `--target=<file>` to generate an exhaustive formal spec. The `--exhaustive` flag should be passed for files in the top 3 — these are the highest-risk files and warrant thorough state-space modeling rather than lightweight property stubs.
4. For hot zone files WITH existing formal models that have `signals` including `"numerical"` (oscillating constants), dispatch `/nf:quick` to verify the model's constants match current code values — these are drift-prone by definition.

**After formal modeling, refresh proposed metrics:**

Run `analyze-assumptions.cjs` to extract metric proposals from all formal models (including any newly generated ones):
```bash
node ~/.claude/nf-bin/analyze-assumptions.cjs --json --project-root=$(pwd)
```
If `~/.claude/nf-bin/analyze-assumptions.cjs` does not exist, fall back to `bin/analyze-assumptions.cjs`.

This writes `.planning/formal/evidence/proposed-metrics.json` — a structured list of metrics that formal models say should exist in the codebase. Each entry includes `metric_name`, `metric_type`, `tier`, `source_model`, and `instrumentation_snippet`. The `nf:observe` internal handler reads this file and surfaces unimplemented metrics as drifts.

**Why automated:** Unlike reverse discovery (C->R, T->R, D->R) which could cause infinite expansion loops, heatmap-driven formalization is bounded — it only targets files that already exist in the codebase and have demonstrated instability through git history. The formal models it generates enter the existing F->T->C forward flow naturally. The proposed metrics pipeline is also bounded — it only proposes metrics for assumptions that already exist in formal models.

Log: `"Heatmap: {N} hot zones, {M} targeted for formal modeling, {K} already covered, {P} metrics proposed"`

### 3i. Reverse Traceability Discovery (C->R + T->R + D->R)

This step surfaces implementation artifacts that have no requirement backing. Unlike forward layers (which auto-remediate), reverse layers use a **two-step pattern**: autonomous discovery followed by human approval.

**Phase 1 — Discovery (autonomous):**

Extract reverse residuals from the diagnostic sweep (already computed in Step 1):
- `residual_vector.c_to_r.detail.untraced_modules` — source files in bin/ and hooks/ with no requirement tracing
- `residual_vector.t_to_r.detail.orphan_tests` — test files with no @req annotation or formal-test-sync mapping
- `residual_vector.d_to_r.detail.unbacked_claims` — doc capability claims without requirement backing

The diagnostic engine runs `assembleReverseCandidates()` automatically, which:
1. Merges candidates from all 3 scanners
2. Deduplicates (e.g., if test/foo.test.cjs and bin/foo.cjs are both untraced, merge into 1 candidate)
3. Filters out .planning/ files, generated stubs, and node_modules paths
4. Removes candidates present in `.planning/formal/acknowledged-not-required.json`
5. Caps at 200 candidates maximum

If `assembled_candidates.candidates` is empty after dedup + filtering: Log `"Reverse discovery: 0 candidates after dedup/filtering"` and skip Phase 2.

**Phase 2 — Human Approval (interactive):**

Present the deduplicated candidate list to the user:

```
Discovered {N} candidate requirement(s) from reverse traceability:

  #  Source    Evidence                              Candidate
  ─────────────────────────────────────────────────────────────────
  1  C->R      bin/check-provider-health.cjs          Provider health probe module
  2  C->R,T->R  bin/validate-traces.cjs + test/...     Trace validation module
  3  D->R      README.md:42                            "supports automatic OAuth rotation"
  ...

Accept: [a]ll / [n]one / comma-separated numbers (e.g. 1,3,5) / [s]kip this cycle
```

Wait for user input via AskUserQuestion. Route based on response:

- **Numbers or "all"**: For each accepted candidate, dispatch `/nf:add-requirement` with the candidate evidence as context. The add-requirement skill handles ID assignment, duplicate checks, and semantic conflict detection. Approved candidates enter the forward flow (R->F->T->C) in the next iteration.

- **"none"**: Write ALL candidates to `.planning/formal/acknowledged-not-required.json` so they are not resurfaced in future runs. Each entry:
  ```json
  {
    "file_or_claim": "<candidate file or claim text>",
    "source_scanners": ["C->R", "T->R"],
    "acknowledged_at": "<ISO timestamp>",
    "reason": "user-rejected"
  }
  ```

- **"skip"**: Do nothing — candidates will resurface in the next solve run. This is the default if the user does not respond.

Log: `"Reverse discovery: {N} candidates presented, {M} approved, {K} rejected, {J} skipped"`

### 3j. Hazard Model Refresh (pre-gate)

Before remediating gate failures, refresh the L3 hazard model so gate checks evaluate current data:

```bash
node bin/hazard-model.cjs --json
```

Parse the JSON output. Log: `"Hazard model: {total_hazards} hazards scored, {high_rpn_count} high-RPN (>100)"`

If hazard-model.cjs is not found or fails, skip silently and continue to gate remediation (fail-open). The hazard model is an input to Gate B (L2->L3 traceability) — stale hazard data produces false gate failures.

### 3k. Gate A Remediation (residual_vector.l1_to_l2.residual > 0)

Gate A measures grounding alignment between L1 evidence (conformance traces) and L2 semantics. The diagnostic engine already computed the residual via gate-a-grounding.cjs.

**Max dispatches: 3 per solve cycle.** Track a counter for Gate A dispatches. If the counter reaches 3, log `"Gate A: max remediation dispatches (3) reached this cycle — skipping further auto-fixes"` and skip to Step 3l.

Extract detail from `residual_vector.l1_to_l2.detail`:
- `unexplained_breakdown.instrumentation_bug` — actions not in event-vocabulary.json
- `unexplained_breakdown.model_gap` — actions in vocabulary but XState replay fails
- `unexplained_breakdown.genuine_violation` — model_gap events violating declared invariants

Remediation strategy by classification:

| Classification | Count Field | Dispatch |
|---------------|-------------|----------|
| **instrumentation_bug** | > 0 | `/nf:quick Add missing action mappings to .planning/formal/evidence/event-vocabulary.json for {N} unmapped trace actions from Gate A` |
| **model_gap** | > 0 | `/nf:quick Fix {N} XState model gaps identified by Gate A grounding check — update observed FSM or conformance trace annotations` |
| **genuine_violation** | > 0 | Log as critical: `"Gate A: {N} genuine invariant violations require investigation"` — do NOT auto-remediate (these indicate real bugs requiring manual investigation, not automated dispatch) |

All `/nf:quick` dispatches use default mode (no `--full` flag) to avoid unnecessary overhead during automated remediation. Dispatch instrumentation_bug and model_gap fixes sequentially. Wait for each to complete before the next. Each dispatch increments the Gate A counter.

Log: `"Gate A: grounding_score={score}, {inst_bug} instrumentation bugs, {model_gap} model gaps, {genuine} genuine violations"`

### 3l. Gate B Remediation (residual_vector.l2_to_l3.residual > 0)

Gate B verifies every L3 reasoning artifact has valid derived_from links to L2 semantics sources. Orphaned hazards (L3 entries with broken/missing derived_from) inflate the residual.

**Max dispatches: 3 per solve cycle.** Track a counter for Gate B dispatches. If the counter reaches 3, log `"Gate B: max remediation dispatches (3) reached this cycle — skipping further auto-fixes"` and skip to Step 3m.

Extract detail from `residual_vector.l2_to_l3.detail`:
- `orphaned_count` — L3 entries with no valid L2 back-link (mapped from gate-b-abstraction.cjs `orphaned_entries`)

If `orphaned_count > 0`:
```
/nf:quick Fix {N} orphaned L3 reasoning entries identified by Gate B — add or repair derived_from links in .planning/formal/reasoning/ files to reference valid L2 semantics sources
```

If `gate_b_score < 1.0` but `orphaned_count == 0`, the gap is due to low coverage rather than broken links. Dispatch:
```
/nf:quick Improve Gate B L2->L3 traceability coverage — generate derived_from annotations for L3 entries missing semantic back-links (gate_b_score={score})
```

All `/nf:quick` dispatches use default mode (no `--full` flag). Each dispatch increments the Gate B counter.

Log: `"Gate B: gate_b_score={score}, {orphaned_count} orphaned entries"`

### 3m. Gate C Remediation (residual_vector.l3_to_tc.residual > 0)

Gate C verifies every L3 failure mode maps to at least one test recipe. Unvalidated failure modes lack test coverage.

**Max dispatches: 3 per solve cycle.** Track a counter for Gate C dispatches. If the counter reaches 3, log `"Gate C: max remediation dispatches (3) reached this cycle — skipping further auto-fixes"` and skip.

Extract detail from `residual_vector.l3_to_tc.detail`:
- `unvalidated_count` — failure modes with no test recipe (mapped from gate-c-validation.cjs `unvalidated_entries`)
- `total_failure_modes` — total L3 failure modes

First, regenerate test recipes to ensure freshness:
```bash
node bin/test-recipe-gen.cjs
```

If unvalidated_count is still > 0 after regeneration, re-run gate-c-validation.cjs to get the updated gap list:
```bash
node bin/gate-c-validation.cjs --json
```

If gate-c-validation.cjs is not found or fails, skip the re-check and use the original unvalidated_count from the diagnostic (fail-open — consistent with Step 3j pattern).

**Important:** The gate-c re-run here is a local freshness check only. It does NOT update the `residual_vector` used by the convergence loop in Step 5. The residual_vector is only updated at the top of the next iteration when nf-solve.cjs runs a full re-diagnostic sweep. This is by design — each iteration gets a consistent snapshot from the diagnostic engine rather than piecemeal updates from individual gate scripts.

If the re-check confirms unvalidated failures remain, dispatch:
```
/nf:quick Generate test recipes for {N} uncovered L3 failure modes identified by Gate C — add entries to .planning/formal/test-recipes/test-recipes.json mapping each failure mode to concrete test steps
```

All `/nf:quick` dispatches use default mode (no `--full` flag). Each dispatch increments the Gate C counter.

Log: `"Gate C: gate_c_score={score}, {unvalidated_count}/{total_failure_modes} failure modes lack test recipes"`

## Important Constraints

4. **Ordering** — remediation order is strict because R->F must precede F->T (new formal specs create new invariants needing test backing). T->C fixes must happen before F->C verification (tests must pass before checking formal properties against code).

5. **Full skill arsenal** — the solver dispatches to the right skill for each gap type. It never stops at "stubs generated" or "manual review required" if a skill exists that can attempt the fix. The hierarchy is:
   - **close-formal-gaps --batch** for missing formal models (R->F), then **run model checkers** to verify them
   - **formal-test-sync** to generate stubs (F->T phase 1), then **direct parallel executor dispatch** to implement real test logic (F->T phase 2)
   - **fix-tests** for failing tests (T->C)
   - **quick** for constant mismatches (C->F), syntax/scope errors, conformance divergences (F->C)
   - **direct executor dispatch** for R->D documentation generation

8. **Layer alignment remediation** — Gate A/B/C failures are remediated via `/nf:quick` dispatch (default mode, no `--full` flag) after the hazard model is refreshed (Step 3j). The full dependency chain is: hazard-model refresh (3j) -> Gate A (3k) -> Gate B (3l) -> test-recipe-gen (in 3m) -> Gate C (3m). This ordering ensures: (a) L3 artifacts are fresh before gates evaluate them, (b) Gate A (L1->L2) fixes propagate before Gate B (L2->L3) checks traceability, (c) test recipes are regenerated before Gate C (L3->TC) evaluates coverage. Each gate is capped at 3 remediation dispatches per solve cycle to prevent runaway loops if residuals never converge.

</process>
