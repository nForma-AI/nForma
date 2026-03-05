---
name: qgsd:solve
description: Orchestrator skill that migrates legacy .formal/ layouts, diagnoses consistency gaps, dispatches to remediation skills for each gap type, and converges via diagnose-remediate-rediagnose loop with before/after comparison
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
---

<objective>
Run the QGSD consistency solver as a full orchestrator. Sweeps 7 layer transitions (R->F, F->T, C->F, T->C, F->C, R->D, D->C), computes a residual vector showing gaps at each boundary, and automatically dispatches to the correct remediation skill/script for each gap type. Re-diagnoses after each remediation round and iterates until convergence or max iterations reached. Returns before/after residual comparison.
</objective>

<execution_context>
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input. If a sub-skill fails, log the
failure and continue to the next gap. The only valid reason to stop is:
all iterations exhausted, or total residual is zero.

This is a self-contained orchestrator skill. It runs the diagnostic engine (bin/qgsd-solve.cjs) and orchestrates higher-level remediation via sub-skills and scripts. No external quorum dispatch is needed — quorum enforcement, if required, is the responsibility of the sub-skills being called.

BULK REMEDIATION: For F->T and R->D gaps, the solve skill writes PLAN.md files
directly and dispatches qgsd-executor agents — it does NOT invoke
/qgsd:quick for bulk remediation. This avoids per-batch quorum overhead while
maintaining quality through the convergence loop's before/after verification.
The solve skill IS the planner for these mechanical remediation tasks.

RAM BUDGET: Never exceed 3 concurrent subagent Tasks at any point during
execution. Each Task subprocess consumes ~1GB RAM. With MCP servers and the
parent process, 3 parallel tasks keeps total usage under ~20GB. Dispatch in
sequential waves of 3, waiting for each wave to finish before the next.
</execution_context>

<process>

## Step 0: Legacy .formal/ Migration

Before running the diagnostic sweep, check for a legacy `.formal/` directory at the project root (next to `.planning/`). This is the OLD layout from before formal verification was consolidated under `.planning/formal/`.

Run the migration script using absolute paths (or fall back to CWD-relative):

```bash
MIGRATE=$(node ~/.claude/qgsd-bin/migrate-formal-dir.cjs --json --project-root=$(pwd) 2>&1)
```

If `~/.claude/qgsd-bin/migrate-formal-dir.cjs` does not exist, fall back to `bin/migrate-formal-dir.cjs` (CWD-relative).
If neither exists, skip this step silently — the migration script is optional for projects that never had a legacy layout.

Parse the JSON output:
- If `legacy_found` is `false`: log `"Step 0: No legacy .formal/ found — skipping migration"` and proceed to Step 1.
- If `legacy_found` is `true`: log the migration summary: `"Step 0: Migrated legacy .formal/ — {copied} files copied, {skipped} conflicts (canonical .planning/formal/ preserved)"`. The legacy `.formal/` directory is NOT auto-removed — the user can run `node bin/migrate-formal-dir.cjs --remove-legacy --project-root=$(pwd)` manually after verifying the migration.

**Important:** This step is fail-open. If the migration script errors or is not found, log the issue and proceed to Step 1. Migration failure must never block the diagnostic sweep.

## Step 1: Initial Diagnostic Sweep

Run the diagnostic solver using absolute paths (or fall back to CWD-relative):

```bash
BASELINE=$(node ~/.claude/qgsd-bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd))
```

If ~/.claude/qgsd-bin/qgsd-solve.cjs does not exist, fall back to bin/qgsd-solve.cjs (CWD-relative).
If neither exists, error with: "QGSD solve scripts not installed. Run `node bin/install.js --claude --global` from the QGSD repo."

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

Display the baseline residual in human-readable format:
```
Layer Transition         Baseline  Health
────────────────────────────────────────
R -> F (Req->Formal)        N      [status]
F -> T (Formal->Test)       N      [status]
C -> F (Code->Formal)       N      [status]
T -> C (Test->Code)         N      [status]
F -> C (Formal->Code)       N      [status]
R -> D (Req->Docs)          N      [status]
D -> C (Docs->Code)         N      [status]
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
/qgsd:close-formal-gaps --batch --ids=REQ-01,REQ-02,...
```

If the list has more than 10 IDs, dispatch:
```
/qgsd:close-formal-gaps --batch --all
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
node ~/.claude/qgsd-bin/formal-test-sync.cjs --project-root=$(pwd)
```

If ~/.claude/qgsd-bin/formal-test-sync.cjs does not exist, fall back to bin/formal-test-sync.cjs (CWD-relative).

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

**Phase 2 — Implement stubs via direct parallel executor dispatch:** Stubs alone do not close the gap — they contain `assert.fail('TODO')`. The solver dispatches `qgsd-executor` agents directly to implement real test logic — it does NOT use `/qgsd:quick` for bulk stub implementation.

1. **Load context:** Parse `.planning/formal/formal-test-sync-report.json` for each stub's `requirement_id`, `formal_properties[].model_file`, `formal_properties[].property`. Also verify recipe files exist at `.planning/formal/generated-stubs/{ID}.stub.recipe.json` — these contain pre-resolved context (requirement text, property definition, source files, import hints, test strategy).

2. **Group into batches** by category prefix (e.g., all `ACT-*`, all `CONF-*`), max 5 stubs per batch. **No cap per iteration** — process ALL stubs. The convergence loop handles failures.

3. **Write PLAN.md files directly** — The solve skill IS the planner for these mechanical tasks. For each batch, write a PLAN.md to `.planning/quick/solve-ft-batch-{iteration}-{B}/PLAN.md` with:
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

4. **Spawn executors in sequential waves of 3** — To avoid OOM on developer machines (each executor consumes ~1GB RAM), dispatch at most 3 parallel executors at a time. Wait for each wave to finish before starting the next:
   ```
   Wave 1: Task(subagent_type="qgsd-executor", description="F->T stubs batch 1"), batch 2, batch 3
   [wait for all 3 to complete]
   Wave 2: Task(subagent_type="qgsd-executor", description="F->T stubs batch 4"), batch 5, batch 6
   [wait for all 3 to complete]
   ... continue until all batches dispatched
   ```
   MAX_PARALLEL_EXECUTORS = 3. This is a hard limit — never exceed it regardless of batch count.

5. **Run tests once:** `node --test .planning/formal/generated-stubs/*.stub.test.js`. Log pass/fail counts. Failed stubs are handled by T->C in the next iteration.

6. Log: `"F->T phase 2: spawned {N} executors in waves of 3 for {M} stubs (no quorum overhead)"`

### 3c. T->C Gaps (residual_vector.t_to_c.residual > 0)

The T->C residual counts both failures and skipped tests. Extract detail:
- `detail.failed` — tests that ran and failed
- `detail.skipped` — tests marked skip (still count as unresolved gaps)
- `detail.todo` — tests marked todo (informational, do not inflate residual)

Dispatch the fix-tests skill:
```
/qgsd:fix-tests
```

This will discover and autonomously fix failing AND skipped tests. Skipped tests often indicate incomplete implementations or platform-specific guards that need resolution.

Log: `"Dispatching T->C remediation: fix-tests for {failed} failing + {skipped} skipped tests"`

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

First, run the formal verification using absolute paths to get fresh failure data:
```bash
node ~/.claude/qgsd-bin/run-formal-verify.cjs --project-root=$(pwd)
```

If ~/.claude/qgsd-bin/run-formal-verify.cjs does not exist, fall back to bin/run-formal-verify.cjs (CWD-relative).

Then parse `.planning/formal/check-results.ndjson` and classify each failure:

| Classification | Criteria | Dispatch |
|---------------|----------|----------|
| **Syntax error** | Summary contains "Syntax error", "parse error" | `/qgsd:quick Fix Alloy/TLA+ syntax error in {model_file}: {error_detail}` |
| **Scope error** | Summary contains "scope", "sig" | `/qgsd:quick Fix scope declaration in {model_file}: {error_detail}` |
| **Conformance divergence** | check_id contains "conformance" | `/qgsd:quick Fix conformance trace divergences in {model_file}: {error_detail}` |
| **Verification failure** | Counterexample found | `/qgsd:quick Fix formal verification counterexample in {check_id}: {summary}` |
| **Missing tool** | "not found", "not installed" | Log as infrastructure gap, skip |
| **Inconclusive** | result = "inconclusive" | Skip — not a failure |

Dispatch each fixable failure **sequentially** (one at a time) to the appropriate skill. Process syntax/scope errors first (they're usually quick fixes), then conformance/verification failures (require deeper investigation). Wait for each dispatch to complete before starting the next.

Log: `"F->C: {total} checks, {pass} pass, {fail} fail — dispatching {syntax_count} to quick, {debug_count} to debug, {skip_count} skipped"`

Each dispatch is independent — if one fails, log and continue to the next. Do NOT dispatch F->C fixes in parallel.

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

Then auto-remediate by dispatching a single `qgsd-executor` agent directly — it does NOT use `/qgsd:quick` for bulk doc generation.

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
   Task(subagent_type="qgsd-executor", description="R->D: generate doc entries for {N} requirements")
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

### 3h. Reverse Traceability Discovery (C→R + T→R + D→R)

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
  1  C→R      bin/check-provider-health.cjs          Provider health probe module
  2  C→R,T→R  bin/validate-traces.cjs + test/...     Trace validation module
  3  D→R      README.md:42                            "supports automatic OAuth rotation"
  ...

Accept: [a]ll / [n]one / comma-separated numbers (e.g. 1,3,5) / [s]kip this cycle
```

Wait for user input via AskUserQuestion. Route based on response:

- **Numbers or "all"**: For each accepted candidate, dispatch `/qgsd:add-requirement` with the candidate evidence as context. The add-requirement skill handles ID assignment, duplicate checks, and semantic conflict detection. Approved candidates enter the forward flow (R→F→T→C) in the next iteration.

- **"none"**: Write ALL candidates to `.planning/formal/acknowledged-not-required.json` so they are not resurfaced in future runs. Each entry:
  ```json
  {
    "file_or_claim": "<candidate file or claim text>",
    "source_scanners": ["C→R", "T→R"],
    "acknowledged_at": "<ISO timestamp>",
    "reason": "user-rejected"
  }
  ```

- **"skip"**: Do nothing — candidates will resurface in the next solve run. This is the default if the user does not respond.

Log: `"Reverse discovery: {N} candidates presented, {M} approved, {K} rejected, {J} skipped"`

## Step 4: Re-Diagnostic Sweep

After all remediations in Step 3 complete, run the diagnostic again using absolute paths:
```bash
POST=$(node ~/.claude/qgsd-bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd))
```

If ~/.claude/qgsd-bin/qgsd-solve.cjs does not exist, fall back to bin/qgsd-solve.cjs (CWD-relative).

Parse the result as `post_residual`.

## Step 5: Convergence Check

Compare the baseline total residual against the post-remediation total:

- If `post_residual.total == 0`: Report `"✓ All layers converged to zero. System is fully consistent."` and EXIT.
- If `post_residual.total < baseline_residual.total`: Report improvement `"✓ Improvement: {baseline} → {post} gaps remaining"` and continue to Step 6.
- If `post_residual.total >= baseline_residual.total`: Report stasis `"⚠ Residual did not decrease. {baseline} → {post}. Remaining gaps may need manual attention."` and continue to Step 6.

### Iteration Loop (if --max-iterations > 1)

If `--max-iterations=N` was passed and N > 1:
- Increment iteration counter
- Compute `automatable_residual` = r_to_f + f_to_t + c_to_f + t_to_c + f_to_c + r_to_d (exclude d_to_c which is manual-only)
- If iterations < max_iterations AND automatable_residual > 0 AND at least one automatable layer changed: loop back to Step 3
- If iterations >= max_iterations OR automatable_residual == 0 OR no automatable layer changed: proceed to Step 6

**IMPORTANT — Cascade-aware convergence:** Do NOT use total residual for the loop condition. Fixing R→F creates F→T gaps (total goes UP), but the system is making progress. Use per-layer change detection instead: if ANY automatable layer's residual changed (up or down) since the previous iteration, there is still work to do. Only stop when all automatable layers are stable (unchanged between iterations) or at zero.

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
R -> D (Req→Docs)          {N}    {M}    {delta}   [AUTO]
D -> C (Docs→Code)         {N}    {M}    {delta}   [MANUAL]
──────────────────────────────────────────────────────────
Total                      {N}    {M}    {delta}
```

**IMPORTANT — Expand non-zero layers:** For any layer with residual > 0, display the full detail below the table. The residual number alone hides severity. For example, F→C residual=1 might mean "1 check failed with 7,086 individual divergences." Always show:

- **R→F**: List all uncovered requirement IDs
- **F→T**: Count of formal properties without test backing
- **T→C**: Show counts with symbols (fail, skip, todo) and list failing test names with error summaries. Format: `N failed, N skipped, N todo (of M total)`
- **C→F**: Table of each constant mismatch (name, formal value, config value)
- **F→C**: For each failing check: check_id, summary (including counts like "7086 divergences"), affected requirement IDs. Also list inconclusive checks separately.
- **R→D**: List all undocumented requirement IDs
- **D→C**: Table of each broken claim (doc_file, line, type, value, reason)

Example F→C expansion:
```
F → C Detail:
  ✗ ci:conformance-traces — 7086 divergence(s) in 20199 traces
  ⚠ ci:liveness-fairness-lint — fairness declarations missing for 10 properties
```

Example T→C expansion:
```
T -> C Detail:
  Tests: 2 failed, 3 skipped, 1 todo (of 42 total)
```

If any gaps remain after convergence, append a summary of what couldn't be auto-fixed and why.

Note: R->D gaps are auto-remediated by generating developer doc entries in docs/dev/requirements-coverage.md. D->C gaps (stale file paths, CLI commands, dependencies) require manual review.

## Step 7: Full Formal Verification Detail Table

**ALWAYS display this table** — it shows every individual check from `run-formal-verify.cjs`, not just the solver-tracked layer residuals. The solver layer table (Step 6) can show all-green while real formal model failures hide underneath.

After the before/after table, run the full formal verification using absolute paths if not already run during Step 3e:
```bash
node ~/.claude/qgsd-bin/run-formal-verify.cjs --project-root=$(pwd)
```

If ~/.claude/qgsd-bin/run-formal-verify.cjs does not exist, fall back to bin/run-formal-verify.cjs (CWD-relative).

Parse `.planning/formal/check-results.ndjson` and display **every check** grouped by result:

```
Formal Verification Detail ({pass}/{total} passed):
─────────────────────────────────────────────────────────
CHECK                          RESULT     DETAIL
─────────────────────────────────────────────────────────
✓ check_id                     PASS       (optional note)
...
✗ check_id                     FAIL       summary of failure
...
⚠ check_id                     INCONC     reason for inconclusive
...
─────────────────────────────────────────────────────────
```

Rules for the detail column:
- **PASS**: Leave blank unless there's a notable caveat (e.g., "low-confidence — 0 traces", "empirical timing only")
- **FAIL**: Show the full summary from the check result (e.g., "7271 divergence(s) in 20651 traces", "MCMCPEnv model check failed", "tp_rate=0.49, unavail=0.45")
- **INCONCLUSIVE**: Show the reason (e.g., "fairness missing: PropertyName1, PropertyName2", "verifyta not installed")

Display checks in this order: PASS first (alphabetical), then FAIL (alphabetical), then INCONCLUSIVE (alphabetical). This puts failures and inconclusives at the bottom where they're visually prominent.

After the table, if there are any FAIL or INCONCLUSIVE checks, add a brief actionability note:
```
{fail_count} check(s) failing, {inconc_count} inconclusive.
Failing checks need investigation — use /qgsd:quick to dispatch fixes for syntax/scope errors or conformance divergences.
Inconclusive checks are not failures but indicate incomplete verification (usually missing fairness declarations or tools).
```

This table is mandatory even when the solver layer residuals are all zero — because formal model failures (Alloy, TLA+, PRISM) may exist outside the solver's tracked CI checks.

## Important Constraints

1. **bin/qgsd-solve.cjs is NOT modified** — it remains the diagnostic engine. This skill orchestrates remediation at the skill/script level.

2. **Convergence loop is at skill level** — when the skill calls diagnostic again in Step 4, it uses `--json --report-only` to get fresh data. The skill then decides whether to loop back to Step 3 or exit. The script's internal auto-close loop is bypassed.

3. **Error handling** — each remediation dispatch is wrapped in error handling. If a sub-skill or script fails, log the failure and continue to the next gap type. Do not let one failure abort the entire solve cycle.

4. **Ordering** — remediation order is strict because R→F must precede F→T (new formal specs create new invariants needing test backing). T→C fixes must happen before F→C verification (tests must pass before checking formal properties against code).

5. **Full skill arsenal** — the solver dispatches to the right skill for each gap type. It never stops at "stubs generated" or "manual review required" if a skill exists that can attempt the fix. The hierarchy is:
   - **close-formal-gaps --batch** for missing formal models (R->F), then **run model checkers** to verify them
   - **formal-test-sync** to generate stubs (F->T phase 1), then **direct parallel executor dispatch** to implement real test logic (F->T phase 2)
   - **fix-tests** for failing tests (T->C)
   - **quick** for constant mismatches (C->F), syntax/scope errors, conformance divergences (F->C)
   - **direct executor dispatch** for R->D documentation generation

6. **Cascade awareness** — fixing one layer often creates gaps in the next (e.g., new formal models → new F→T gaps → new stubs → new T→C gaps). The iteration loop handles this naturally. Expect the total to fluctuate between iterations before converging. Reverse discovery candidates that get approved also feed into the forward flow (R→F→T→C) in subsequent iterations.

7. **Reverse flows are discovery-only** — C→R, T→R, and D→R never auto-remediate. They surface candidates for human approval. The human gate prevents unbounded requirement expansion (if C→R auto-added requirements, those would trigger R→F→T→C, generating more code, triggering more C→R — an infinite loop). Reverse residuals do NOT count toward the automatable total or affect the convergence check in Step 5.

</process>
