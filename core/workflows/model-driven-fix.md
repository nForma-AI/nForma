<purpose>
Orchestrate the full model-driven fix cycle for a bug. Runs 7 sequential phases:
discovery, reproduction, refinement, constraint extraction, solution simulation,
constrained fix, and pre-verification. Composes existing tools (formal-scope-scan.cjs,
close-formal-gaps.md, model-constrained-fix.cjs, solution-simulation-loop.cjs,
refinement-loop.cjs, run-tlc.cjs/run-alloy.cjs) into a single end-to-end workflow
from bug description to verified fix with model-space simulation.
</purpose>

<process>

<step name="parse_arguments">
## Phase 0 — Parse Arguments

Extract from $ARGUMENTS:
- `BUG_DESC`: the main argument text (bug description) — **required**
- `--files`: comma-separated affected file paths (optional)
- `--formalism`: override formalism selection — tla, alloy, or prism (optional)
- `--verbose`: show full checker output throughout all phases (optional, default false)
- `--skip-fix`: stop after Phase 4 (constraint extraction), skip Phases 4.5-6 (optional)
- `--skip-simulation`: explicitly skip Phase 4.5 (solution simulation), proceed to Phase 5 (optional)
- `--fix-idea`: override fix idea for simulation (optional, default: use Phase 4 constraints)
- `--strict`: gate fix completion on ALL neighbor models passing in Phase 5b (optional, default false)

If `BUG_DESC` is empty, error: "Bug description is required. Usage: /nf:model-driven-fix 'description' [--files=...] [--formalism=...] [--verbose] [--skip-fix] [--skip-simulation] [--fix-idea='...'] [--strict]"

Set variables:
```bash
BUG_DESC="..."
FILES="${--files value or empty}"
FORMALISM="${--formalism value or empty}"
VERBOSE="${--verbose present: true, else false}"
SKIP_FIX="${--skip-fix present: true, else false}"
SKIP_SIMULATION="${--skip-simulation present: true, else false}"
FIX_IDEA="${--fix-idea value or empty}"
STRICT="${--strict present: true, else false}"
```
</step>

<step name="discovery">
## Phase 1 — Discovery

Find existing formal models that may cover the bug's affected code.

Display banner:
```
Phase 1 — Discovery
  Searching for formal models covering: {first 80 chars of BUG_DESC}...
```

Run model discovery:
```bash
node bin/formal-scope-scan.cjs --bug-mode --description "$BUG_DESC" ${FILES:+--files "$FILES"} --format json 2>/dev/null
```

Parse JSON output:
- If matches found (non-empty matches array):
  Display matched models table:
  ```
  Found {N} model(s) covering affected code:
    {model_path} ({formalism}) — covers {requirement_ids}
  ```
  Store `$EXISTING_MODELS` for Phase 2.
  Proceed to Phase 2.

- If no matches (empty matches array or command fails):
  Display: `No existing models cover this failure. Skipping to Phase 3 (Refinement).`
  Set `$EXISTING_MODELS` = empty.
  Skip Phase 2, proceed directly to Phase 3.

**Fail-open:** If formal-scope-scan.cjs errors or is not found, log warning and proceed to Phase 3.
</step>

<step name="reproduction">
## Phase 2 — Reproduction

Attempt to reproduce the bug using existing models discovered in Phase 1.

**Skip if** `$EXISTING_MODELS` is empty (no models found in Phase 1).

Display banner:
```
Phase 2 — Reproduction
  Running {N} model checker(s) to attempt bug reproduction...
```

Run checkers on existing models:
```bash
node bin/formal-scope-scan.cjs --bug-mode --run-checkers --description "$BUG_DESC" ${FILES:+--files "$FILES"} --format json 2>/dev/null
```

Parse results for each model:
- If any model's checker found a violation (model reproduced the bug):
  Display: `Model {name} reproduces the bug (invariant {X} violated)`
  Set `$REPRODUCING_MODEL` = path to the reproducing model.
  Set `$REPRODUCTION_STATUS` = "reproduced"
  **Skip Phase 3** — existing model already captures the failure.
  Proceed to Phase 4.

- If all models pass (none reproduced):
  Display: `Existing models are incomplete — they do not capture this failure. Proceeding to refinement.`
  Set `$REPRODUCTION_STATUS` = "not_reproduced"
  Proceed to Phase 3.

**Fail-open:** If checker execution fails, treat as "model inconclusive" and proceed to Phase 3.
</step>

<step name="refinement">
## Phase 3 — Refinement

Create or refine a formal model that captures the failure mode.

**Skip if** `$REPRODUCTION_STATUS` is "reproduced" (Phase 2 found a reproducing model).

Display banner:
```
Phase 3 — Refinement
  Creating model to capture: {first 80 chars of BUG_DESC}...
```

Invoke close-formal-gaps workflow with --bug-context:
```
/nf:close-formal-gaps --bug-context="$BUG_DESC" ${FORMALISM:+--formalism=$FORMALISM} ${VERBOSE:+--verbose} --batch
```

This triggers (via Plan 01 deliverables):
- Step 5: Spec generation biased by bug context (MRF-01)
- Step 6: Refinement loop with inverted verification (MRF-02)
- Step 6+ (Plan 03): Diagnostic feedback generation when model is INCOMPLETE (DX1-03)

**Diagnostic Injection for Refinement Iterations:**

When refinement-loop.cjs runs with diagnostic support:
- It accepts `--bug-trace-json <path>` pointing to the parsed bug trace ITF JSON from Phase 1
- On each INCOMPLETE outcome (before maxAttempts exhausted), it generates diagnostic feedback:
  - Compares model's final states with bug trace's final states
  - Produces mismatch_diff markdown and correction_proposals with evidence-based reasoning
  - Exposes diagnostic via onDiagnosticGenerated callback
- Refinement loop returns result with final_diagnostic field for not_reproduced case

**Quorum Dispatch Integration:**

When dispatching quorum workers for model refinement iterations:
- If refinement-loop returned diagnostic in iteration.diagnostic:
  - Stringify the diagnostic object as JSON
  - Pass to next quorum worker dispatch as: --review-context '<diagnostic-json>'
  - This ensures quorum workers see the "## Model Diagnostic Feedback" section
    with mismatch diff and correction proposals in their prompts (DX1-03 satisfied)

Parse the result:
- If a reproducing model was created (refinement-loop returned "reproduced"):
  Set `$REPRODUCING_MODEL` = path to the new model.
  Display: `Model created and bug reproduced after {N} attempt(s)`
  Proceed to Phase 4.

- If refinement exhausted (3 attempts, no reproduction):
  Display: `WARNING: Model remains incomplete after 3 refinement attempts — does not capture the failure`
  If `$result.final_diagnostic` is present:
    Display: `\n[Diagnostic Feedback]\n${final_diagnostic.mismatch_diff}\n\nProposals:\n${proposals formatted}`
  Set `$REPRODUCING_MODEL` = path to latest model (best effort).
  Proceed to Phase 4 with caveat.

If `$VERBOSE`, show full refinement iteration details including diagnostics.
Otherwise show summary verdicts only (per user decision).
</step>

<step name="constraint_extraction">
## Phase 4 — Constraint Extraction

Extract fix constraints from the reproducing (or best-effort) model.

Display banner:
```
Phase 4 — Constraint Extraction
  Extracting constraints from: {$REPRODUCING_MODEL}
```

Run constraint extraction:
```bash
node bin/model-constrained-fix.cjs --spec "$REPRODUCING_MODEL" --max-constraints 3 --format json 2>/dev/null
```

Parse JSON output. Store `$CONSTRAINTS` array.

Display extracted constraints:
```
Constraints from {model name} ({formalism}):
  1. {constraint 1 english text}
  2. {constraint 2 english text}
  3. {constraint 3 english text}
```

If `$SKIP_FIX` is true:
  Display:
  ```
  Constraints extracted. Stopping here (--skip-fix).

  To apply these constraints and verify a fix, re-run without --skip-fix:
    /nf:model-driven-fix "{BUG_DESC}" [--files=...]
  ```
  Exit workflow.

If constraint extraction fails or returns empty:
  Display: `WARNING: No constraints extracted from model. Proceeding with best-effort fix guidance.`
  Set `$CONSTRAINTS` to empty array.
  Proceed to Phase 4.5.
</step>

<step name="solution_simulation">
## Phase 4.5 — Solution Simulation

Simulate the proposed fix in model space before touching code.

**Skip if** `$SKIP_SIMULATION` is true (user explicitly opted out).
**Skip if** `$REPRODUCING_MODEL` is empty or inconclusive.

Display banner:
```
Phase 4.5 — Solution Simulation
  Simulating fix in model space: {first 80 chars of fix idea}...
```

**Step 1: Gather fix idea**

If constraints were extracted in Phase 4, use them as the fix idea input (join $CONSTRAINTS array into comma-separated text).
If `$FIX_IDEA` was provided via command-line, use it instead.
Otherwise, prompt user: "Describe your fix idea (natural language, constraints, or code sketch):"

Set `$FIX_IDEA` to the chosen fix idea text.

**Step 2: Run simulation loop**

Resolve neighbor models for regression testing:
```bash
MODEL_ID=$(basename "$REPRODUCING_MODEL" | sed 's/\.\(tla\|cfg\|als\|pm\)$//' | tr '[:upper:]' '[:lower:]')
NEIGHBORS_JSON=$(node bin/resolve-proximity-neighbors.cjs --model="$MODEL_ID" --format=json 2>/dev/null || echo '{"neighbors":[]}')
NEIGHBOR_PATHS=$(echo "$NEIGHBORS_JSON" | jq -r '.neighbors[].path' | tr '\n' ' ')
```

Create ITF bug trace JSON if not already present:
```bash
BUG_TRACE_PATH="$(mktemp -d -t nf-cycle2-simulations.XXXXXX)/bug-trace.itf"
# Extract or create bug trace from reproducing model diagnostics
```

Run solution simulation loop:
```bash
node bin/solution-simulation-loop.cjs \
  --fix-idea="$FIX_IDEA" \
  --bug-description="$BUG_DESC" \
  --reproducing-model="$REPRODUCING_MODEL" \
  --bug-trace="$BUG_TRACE_PATH" \
  --formalism="$FORMALISM" \
  ${VERBOSE:+--verbose}
```

Parse result:
- If converged (converged=true):
  Display: "Fix CONVERGED in model space. Proceeding to code fix (Phase 5)."
  Set `$SIMULATION_CONVERGED` = true
  Proceed to Phase 5 with high confidence.

- If not converged (max iterations exhausted):
  Display: Escalation reason and suggestions from simulation loop output.
  Prompt user: "Continue to code fix anyway? (y/n)"
  If yes: Proceed to Phase 5 with caveat.
  If no: Exit workflow.

- If paused (dependency unavailable):
  Display: Pause message.
  Exit workflow. User can resume later.

**Fail-CLOSED error handling (model-space gate is mandatory):**

The phase goal is "fix ideas iterate entirely in model space before any code is touched." Therefore:
- If solution-simulation-loop.cjs **is not found** (module missing): Display warning: "Phase 4.5 module not installed. Simulation cannot run." Prompt user: "Skip simulation and proceed to Phase 5? (y/n)". Only proceed if user explicitly confirms. Do NOT auto-continue.
- If solution-simulation-loop.cjs **errors during execution** (runtime error, crash): Display the error message and stack trace. Exit workflow — do NOT auto-continue to Phase 5. The user must investigate the error or explicitly restart with --skip-simulation flag.
- Rationale: A fail-open that silently skips simulation and proceeds directly to code changes contradicts the core invariant that fixes must be verified in model space first. The simulation gate must be mandatory when the module exists and is configured.
</step>

<step name="constrained_fix">
## Phase 5 — Constrained Fix

Apply constraints to guide the code fix, then verify against neighbor models.

### Phase 5a — Present Constraints

Display banner:
```
Phase 5a — Constrained Fix
  Applying {N} constraint(s) to guide fix
```

Present constraints as fix guidance:
```
[FIX CONSTRAINTS]
The following constraints were extracted from formal model {model name}:
- {constraint 1}
- {constraint 2}
- {constraint 3}

Apply a fix that:
1. Resolves the described bug: {BUG_DESC}
2. Does NOT violate any of the above constraints
3. Will pass formal model verification in Phase 6
```

**Simulation Status:**
- If `$SIMULATION_CONVERGED` is true, add: "This fix has been verified in model space (simulation converged). Apply with confidence."
- If simulation did not converge or was skipped, add: "WARNING: Fix was not verified in model space. Proceed with caution."

```
[END FIX CONSTRAINTS]
```

**Quorum Code-Fix Gate (autonomous):**

Dispatch the proposed code fix + extracted constraints to quorum for unanimous consensus:

Build quorum question:
```
Review this proposed code fix for bug: {BUG_DESC}
Constraints from formal model {model_name}:
{constraint list}
Simulation status: {converged/not converged/skipped}

Does this fix satisfy ALL extracted constraints without introducing regressions?
Vote APPROVE if the fix is sound. Vote BLOCK with specific objection if not.
```

Dispatch as parallel sibling nf-quorum-slot-worker Tasks (per R3.2):
- Build $DISPATCH_LIST from active slots
- Each slot gets the question + constraint context + affected file diffs
- mode: A, timeout per slot config

Synthesize results, deliberate up to 10 rounds per R3.3.

**Unanimous gate: 100% of valid external voters must vote APPROVE.**
- **APPROVED (unanimous)** -> Auto-apply the fix. Log "Quorum-approved code fix: [summary]". Proceed to Phase 5b.
- **BLOCKED (any BLOCK vote)** -> Quorum debates per standard protocol (slots see prior positions, iterate). Up to max deliberation rounds.
  - If consensus reached after debate -> apply outcome (APPROVE = auto-apply, BLOCK = escalate).
  - If debate exhausted with no consensus -> escalate to human as last resort. Present constraints, dissenting positions, and ask user to decide.

### Phase 5b — Cross-Model Regression Check

Display banner:
```
Phase 5b — Cross-Model Regression Check
  Resolving 2-hop proximity neighbors for: {$REPRODUCING_MODEL}
```

**Step 1: Extract model ID and resolve neighbors**

Extract model ID from `$REPRODUCING_MODEL` path:
- TLA+ (`.tla`/`.cfg`): config name without extension (e.g., `MCsafety` from `.planning/formal/tla/MCsafety.cfg`)
- Alloy (`.als`): spec name without extension (e.g., `quorum-votes` from `.planning/formal/alloy/quorum-votes.als`)
- PRISM (`.pm`): model name without extension

```bash
MODEL_ID=$(basename "$REPRODUCING_MODEL" | sed 's/\.\(tla\|cfg\|als\|pm\)$//' | tr '[:upper:]' '[:lower:]')
NEIGHBORS_JSON=$(node bin/resolve-proximity-neighbors.cjs --model="$MODEL_ID" --format=json 2>/dev/null)
```

Parse JSON output. Extract `neighbors` array and `warnings`.

**If neighbors is empty** (no proximity data or no neighbors found):
  Display: `No proximity neighbors found for ${MODEL_ID}. Skipping cross-model regression check.`
  Set `NEIGHBOR_MODELS_PASS=null` (inconclusive).
  Proceed to Phase 5c.

**If neighbors is non-empty:**
  Display:
  ```
  Found {N} proximity neighbor(s) for {MODEL_ID}:
    {neighbor_id_1} (hop: {distance})
    {neighbor_id_2} (hop: {distance})
    ...
  ```

**Step 2: Build scope list and run scoped verification**

```bash
SCOPE=$(node bin/resolve-proximity-neighbors.cjs --model="$MODEL_ID" --format=csv)
```

Run scoped formal verification on neighbor models:
```bash
node bin/run-formal-verify.cjs --scope="$SCOPE" --project-root="$(pwd)" 2>&1
```

Parse results. For each neighbor model:
- If checker passed: add to `passed_neighbors` array
- If checker failed: add to `regressions` array with violation details
- If checker timed out or errored: add to `regressions` with `result: "error"`

**Step 3: Compute summary**

```bash
MODEL_PASS=true  # The reproducing model is verified in Phase 6
NEIGHBOR_MODELS_PASS=$([ ${#REGRESSIONS[@]} -eq 0 ] && echo "true" || echo "false")
REGRESSION_COUNT=${#REGRESSIONS[@]}
```

**Step 4: Display summary table**

```
┌─────────────────────────────────────────────────────────┐
│ Cross-Model Regression Check                            │
├───────────────────────┬─────────────────────────────────┤
│ Primary model         │ {PASS/FAIL}                     │
│ Neighbor models       │ {PASS/FAIL/INCONCLUSIVE}        │
│ Regressions           │ {count}                         │
└───────────────────────┴─────────────────────────────────┘
```

**If regressions found:**
  Display each regression:
  ```
  WARNING: Regression in {model_id} ({formalism}): {violation summary}
  ```

  **If `$STRICT` is true:**
    Display:
    ```
    BLOCKED: --strict mode active. Fix cannot proceed until all neighbor model regressions are resolved.
    Regressions:
      - {model_id}: {violation}
    ```
    Fix is NOT declared done. User must resolve regressions and re-run.
    Exit workflow (do not proceed to Phase 6).

  **If `$STRICT` is false (default):**

    **Auto-Remediation via Quorum Consensus:**

    For each regression in $REGRESSIONS:
      Build quorum question:
      ```
      Regression detected in neighbor model {model_id} ({formalism}): {violation summary}
      Primary fix applied for: {BUG_DESC}
      Constraints: {constraint list}

      Propose a remediation that resolves this regression without reverting the primary fix.
      Vote APPROVE with proposed remediation if feasible. Vote BLOCK if regression requires manual investigation.
      ```

      Dispatch as parallel sibling nf-quorum-slot-worker Tasks.
      Synthesize with unanimous gate (100% APPROVE required).

      - **APPROVED (unanimous)** -> Auto-apply the proposed remediation. Log "Quorum-approved regression fix: {model_id}".
      - **BLOCKED or debate exhausted** -> Log warning: "Regression in {model_id} requires manual investigation". Continue to next regression.

    After all regressions processed, proceed to Phase 5c.

**If no regressions:**
  Display: `All {N} neighbor model(s) pass. No cross-model regressions detected.`
  Proceed to Phase 5c.

### Phase 5c — Persist Post-Fix Verification Results

Write `post_fix_verification` results to the bug-model-gaps.json entry for this bug.

```bash
node bin/persist-post-fix-verification.cjs \
  --bug-id="$BUG_ID" \
  --model-path="$REPRODUCING_MODEL" \
  --model-pass="$MODEL_PASS" \
  --neighbor-pass="$NEIGHBOR_MODELS_PASS" \
  --neighbor-count="$NEIGHBOR_COUNT" \
  --regressions="$REGRESSIONS_JSON" \
  --passed="$PASSED_JSON"
```

Proceed to Phase 6.
</step>

<step name="pre_verification">
## Phase 6 — Pre-Verification

Verify the fix resolves the failure by re-running the model.

Display banner:
```
Phase 6 — Pre-Verification
  Running model against fixed code: {$REPRODUCING_MODEL}
```

Run ONLY the new/refined model (per user decision: pre-verification scope limited to new model):

Determine formalism from model file extension:
- `.tla` → TLA+: `node bin/run-tlc.cjs "$REPRODUCING_MODEL"`
- `.als` → Alloy: `node bin/run-alloy.cjs "$REPRODUCING_MODEL"`

Parse result:
- If checker **PASSES** (no violations, exit code 0):
  The fix resolves the failure — model no longer finds the bug.
  Display:
  ```
  Pre-verification PASSED
  The formal model confirms the bug is resolved.
  Model: {$REPRODUCING_MODEL} — no violations found.
  ```

- If checker **FAILS** (violation found, non-zero exit):
  The bug is still present or the fix introduced a new issue.
  Display:
  ```
  Pre-verification FAILED
  Model still finds violation: {violation summary}

  Suggestions:
  - Review the fix against the constraints from Phase 4
  - Re-run /nf:model-driven-fix or apply additional changes
  ```

Cross-model regression testing runs in Phase 5b (neighbor verification).
This phase verifies only the primary model (the reproducing model from Phase 3).

**Fail-open:** If checker fails to run, warn and report as inconclusive.
</step>

</process>

<constraints>
- Phase 4.5 uses solution-simulation-loop.cjs to simulate fix in model space before code changes
- Phase 4.5 is fail-CLOSED: errors block progression to Phase 5 (user must investigate or explicitly --skip-simulation)
- Phase 4.5 can be explicitly skipped with --skip-simulation flag (user opt-out only, not silent)
- Phase 4.5 displays iteration progress table with per-gate pass/fail status and automatic escalation
- Phase 5b runs neighbor verification using resolve-proximity-neighbors.cjs and run-formal-verify.cjs --scope
- Default behavior is fail-open: regressions warn but do not block the fix
- --strict flag gates fix completion on all neighbor models passing
- Neighbor cap at 10 models (config-backed via .planning/config.json cross_model_max_neighbors)
- post_fix_verification results persisted to bug-model-gaps.json via persist-post-fix-verification.cjs in Phase 5c
- Run ONLY the primary model during pre-verification (Phase 6) — neighbor verification is Phase 5b
- Auto-select formalism based on bug type and module characteristics unless --formalism override provided
- Show summary verdicts by default, full model checker output via --verbose
- Each phase displays a banner with phase name before executing
- Fail-open on all tool errors except Phase 4.5 (log warning and continue where possible)
- Phase 3 delegates to close-formal-gaps.md for spec generation — do NOT duplicate that logic
- Phase 4 uses max 3 constraints to avoid cognitive overload (consistent with debug integration)
- NEVER modify existing formal models — Phase 3 creates new models only
</constraints>

<success_criteria>
- [ ] All 7 phases execute in sequence (0, 1-4, 4.5, 5, 6)
- [ ] Phase 1 discovers existing models via formal-scope-scan.cjs --bug-mode (or reports none)
- [ ] Phase 2 attempts reproduction with existing models via --run-checkers
- [ ] Phase 3 creates/refines model with bug context bias via close-formal-gaps --bug-context
- [ ] Phase 4 extracts constraints from reproducing model via model-constrained-fix.cjs
- [ ] Phase 4.5 simulates fix in model space with automatic escalation (solution-simulation-loop.cjs)
- [ ] Phase 4.5 errors block progression to Phase 5 (fail-closed)
- [ ] Phase 4.5 can be explicitly skipped with --skip-simulation flag
- [ ] Phase 5a presents constraints as fix guidance with simulation status caveat
- [ ] Phase 5b resolves 2-hop neighbors and runs scoped verification
- [ ] Phase 5b displays regression summary table
- [ ] Phase 5c persists post_fix_verification to bug-model-gaps.json
- [ ] --strict blocks fix when regressions detected
- [ ] Default mode (no --strict) warns but proceeds
- [ ] Phase 6 re-runs ONLY the primary model to verify fix
- [ ] --skip-fix stops after Phase 4
- [ ] --skip-simulation skips Phase 4.5 only
- [ ] --verbose shows full checker output throughout
- [ ] Fail-open on all tool errors (except Phase 4.5 which is fail-closed)
</success_criteria>
