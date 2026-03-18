<purpose>
Orchestrate the full model-driven fix cycle for a bug. Runs 6 sequential phases:
discovery, reproduction, refinement, constraint extraction, constrained fix, and
pre-verification. Composes existing tools (formal-scope-scan.cjs, close-formal-gaps.md,
model-constrained-fix.cjs, refinement-loop.cjs, run-tlc.cjs/run-alloy.cjs) into a
single end-to-end workflow from bug description to verified fix.
</purpose>

<process>

<step name="parse_arguments">
## Phase 0 — Parse Arguments

Extract from $ARGUMENTS:
- `BUG_DESC`: the main argument text (bug description) — **required**
- `--files`: comma-separated affected file paths (optional)
- `--formalism`: override formalism selection — tla, alloy, or prism (optional)
- `--verbose`: show full checker output throughout all phases (optional, default false)
- `--skip-fix`: stop after Phase 4 (constraint extraction), skip Phases 5-6 (optional)
- `--strict`: gate fix completion on ALL neighbor models passing in Phase 5b (optional, default false)

If `BUG_DESC` is empty, error: "Bug description is required. Usage: /nf:model-driven-fix 'description' [--files=...] [--formalism=...] [--verbose] [--skip-fix] [--strict]"

Set variables:
```bash
BUG_DESC="..."
FILES="${--files value or empty}"
FORMALISM="${--formalism value or empty}"
VERBOSE="${--verbose present: true, else false}"
SKIP_FIX="${--skip-fix present: true, else false}"
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

Parse the result:
- If a reproducing model was created (refinement-loop returned "reproduced"):
  Set `$REPRODUCING_MODEL` = path to the new model.
  Display: `Model created and bug reproduced after {N} attempt(s)`
  Proceed to Phase 4.

- If refinement exhausted (3 attempts, no reproduction):
  Display: `WARNING: Model remains incomplete after 3 refinement attempts — does not capture the failure`
  Set `$REPRODUCING_MODEL` = path to latest model (best effort).
  Proceed to Phase 4 with caveat.

If `$VERBOSE`, show full refinement iteration details.
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
  Proceed to Phase 5.
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
[END FIX CONSTRAINTS]
```

This phase presents the constraints and waits for the fix to be applied.
The fix may be applied manually by the developer or by another workflow (e.g., /nf:debug).

After presenting constraints, prompt the user:
```
Fix constraints above. After applying the fix, type "done" to proceed to neighbor verification.
```

When user confirms (or in --auto mode, after fix is applied):
  Proceed to Phase 5b.

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
    Display:
    ```
    Regressions detected but proceeding (fail-open mode).
    Re-run with --strict to gate fix completion on all neighbor models passing.
    ```
    Proceed to Phase 5c.

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
- Phase 5b runs neighbor verification using resolve-proximity-neighbors.cjs and run-formal-verify.cjs --scope
- Default behavior is fail-open: regressions warn but do not block the fix
- --strict flag gates fix completion on all neighbor models passing
- Neighbor cap at 10 models (config-backed via .planning/config.json cross_model_max_neighbors)
- post_fix_verification results persisted to bug-model-gaps.json via persist-post-fix-verification.cjs in Phase 5c
- Run ONLY the primary model during pre-verification (Phase 6) — neighbor verification is Phase 5b
- Auto-select formalism based on bug type and module characteristics unless --formalism override provided
- Show summary verdicts by default, full model checker output via --verbose
- Each phase displays a banner with phase name before executing
- Fail-open on all tool errors: log warning and continue to next phase where possible
- Phase 3 delegates to close-formal-gaps.md for spec generation — do NOT duplicate that logic
- Phase 4 uses max 3 constraints to avoid cognitive overload (consistent with debug integration)
- NEVER modify existing formal models — Phase 3 creates new models only
</constraints>

<success_criteria>
- [ ] All 6 phases execute in sequence
- [ ] Phase 1 discovers existing models via formal-scope-scan.cjs --bug-mode (or reports none)
- [ ] Phase 2 attempts reproduction with existing models via --run-checkers
- [ ] Phase 3 creates/refines model with bug context bias via close-formal-gaps --bug-context
- [ ] Phase 4 extracts constraints from reproducing model via model-constrained-fix.cjs
- [ ] Phase 5a presents constraints as fix guidance
- [ ] Phase 5b resolves 2-hop neighbors and runs scoped verification
- [ ] Phase 5b displays regression summary table
- [ ] Phase 5c persists post_fix_verification to bug-model-gaps.json
- [ ] --strict blocks fix when regressions detected
- [ ] Default mode (no --strict) warns but proceeds
- [ ] Phase 6 re-runs ONLY the primary model to verify fix
- [ ] --skip-fix stops after Phase 4
- [ ] --verbose shows full checker output throughout
- [ ] Fail-open on all tool errors
</success_criteria>
