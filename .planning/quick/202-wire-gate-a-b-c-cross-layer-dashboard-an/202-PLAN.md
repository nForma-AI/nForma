---
phase: quick-202
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/solve.md
autonomous: true
requirements: [GATE-01, GATE-02, GATE-03, RSN-01, INTG-04]
formal_artifacts: none

must_haves:
  truths:
    - "Gate A/B/C residuals > 0 trigger remediation dispatch in solve.md Step 3"
    - "hazard-model.cjs is run before gate checks to ensure L3 reasoning artifacts are fresh"
    - "cross-layer-dashboard.cjs is run after remediation to display aggregated alignment summary"
    - "Remediation for gate failures dispatches targeted /nf:quick fixes (default mode, no --full flag)"
    - "Max 3 remediation dispatches per gate per solve cycle prevents runaway loops"
    - "genuine_violation classifications are never auto-remediated via /nf:quick dispatch"
  artifacts:
    - path: "commands/nf/solve.md"
      provides: "Gate A/B/C remediation steps, hazard-model pre-step, cross-layer-dashboard post-step"
      contains: "gate-a-grounding"
  key_links:
    - from: "commands/nf/solve.md"
      to: "bin/gate-a-grounding.cjs"
      via: "remediation dispatch reading l1_to_l2 detail"
      pattern: "gate-a-grounding"
    - from: "commands/nf/solve.md"
      to: "bin/hazard-model.cjs"
      via: "pre-gate refresh step"
      pattern: "hazard-model"
    - from: "commands/nf/solve.md"
      to: "bin/cross-layer-dashboard.cjs"
      via: "post-remediation summary"
      pattern: "cross-layer-dashboard"
    - from: "commands/nf/solve.md"
      to: "bin/test-recipe-gen.cjs"
      via: "Step 3m test recipe regeneration before gate-c re-check"
      pattern: "test-recipe-gen"
---

<objective>
Wire gate-a/b/c remediation, hazard-model refresh, and cross-layer-dashboard summary into the /nf:solve workflow (commands/nf/solve.md) so that layer alignment gaps are actively remediated rather than just displayed.

Purpose: Currently nf-solve.cjs computes gate residuals and solve.md displays them in the table, but there are no remediation steps for gate failures. The 5 scripts (gate-a, gate-b, gate-c, cross-layer-dashboard, hazard-model) exist and work -- they just need to be wired into the solve orchestration flow as sub-steps.

Output: Updated solve.md with 3 new sub-sections in Step 3 (hazard-model pre-step, gate remediation steps) and a cross-layer-dashboard call in Step 6.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/solve.md
@bin/gate-a-grounding.cjs (first 30 lines -- interface: --json flag, outputs grounding_score, unexplained_counts with instrumentation_bug/model_gap/genuine_violation)
@bin/gate-b-abstraction.cjs (first 30 lines -- interface: --json flag, outputs gate_b_score, orphaned_entries)
@bin/gate-c-validation.cjs (first 30 lines -- interface: --json flag, outputs gate_c_score, unvalidated_entries)
@bin/cross-layer-dashboard.cjs (first 30 lines -- interface: --cached/--json flags, aggregates L1 coverage + gates A/B/C)
@bin/hazard-model.cjs (first 30 lines -- interface: --json flag, outputs hazard-model.json with FMEA RPN scores)
@bin/test-recipe-gen.cjs (first 20 lines -- interface: regenerates test recipes from L3 failure modes)
@bin/nf-solve.cjs (grep for orphaned_count, unvalidated_count -- to confirm detail field names used in residual_vector)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add gate remediation and cross-layer wiring to solve.md</name>
  <files>commands/nf/solve.md</files>
  <action>
Edit commands/nf/solve.md to add the following new sub-sections. The existing step numbering (3a through 3i) must be preserved; add the new steps after 3i.

**Important: Field name mapping between gate scripts and nf-solve.cjs detail objects**

The gate scripts emit different field names than what nf-solve.cjs stores in `residual_vector.*.detail`:
- gate-b-abstraction.cjs emits `orphaned_entries` -> nf-solve.cjs maps to `orphaned_count` in detail
- gate-c-validation.cjs emits `unvalidated_entries` -> nf-solve.cjs maps to `unvalidated_count` in detail

Before wiring, the executor MUST verify the actual field names by running:
`grep -n 'orphaned_count\|unvalidated_count\|orphaned_entries\|unvalidated_entries' bin/nf-solve.cjs`

The steps below reference `orphaned_count` and `unvalidated_count` (the nf-solve.cjs detail object field names, since solve.md reads from the diagnostic residual_vector). If nf-solve.cjs has changed these mappings, update the step text accordingly.

**Important: Max remediation dispatch guard**

Each gate step (3k, 3l, 3m) MUST enforce a maximum of 3 `/nf:quick` dispatches per gate per solve cycle. This prevents runaway remediation loops when gate residuals never converge to zero (e.g., a structural issue that quick fixes cannot resolve). Track dispatch count per gate using a simple counter. If the counter reaches 3, log a warning and skip further dispatches for that gate: `"Gate {X}: max remediation dispatches (3) reached this cycle — skipping further auto-fixes. Manual investigation required."` This guard applies across all iterations within a single solve cycle (not per-iteration).

**1. Add Step 3j: Hazard Model Refresh (before gate remediation)**

Insert after Step 3i (Reverse Traceability Discovery). This ensures L3 reasoning artifacts (hazard-model.json) are fresh before gate checks evaluate them.

```
### 3j. Hazard Model Refresh (pre-gate)

Before remediating gate failures, refresh the L3 hazard model so gate checks evaluate current data:

\`\`\`bash
node bin/hazard-model.cjs --json
\`\`\`

Parse the JSON output. Log: `"Hazard model: {total_hazards} hazards scored, {high_rpn_count} high-RPN (>100)"`

If hazard-model.cjs is not found or fails, skip silently and continue to gate remediation (fail-open). The hazard model is an input to Gate B (L2->L3 traceability) — stale hazard data produces false gate failures.
```

**2. Add Step 3k: Gate A Remediation (L1->L2 alignment)**

```
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
| **genuine_violation** | > 0 | Log as critical: `"Gate A: {N} genuine invariant violations require investigation"` — do NOT auto-remediate (these indicate real bugs, not fixable by /nf:quick dispatch) |

All `/nf:quick` dispatches use default mode (no `--full` flag) to avoid unnecessary overhead during automated remediation. Dispatch instrumentation_bug and model_gap fixes sequentially. Wait for each to complete before the next. Each dispatch increments the Gate A counter.

Log: `"Gate A: grounding_score={score}, {inst_bug} instrumentation bugs, {model_gap} model gaps, {genuine} genuine violations"`
```

**3. Add Step 3l: Gate B Remediation (L2->L3 traceability)**

```
### 3l. Gate B Remediation (residual_vector.l2_to_l3.residual > 0)

Gate B verifies every L3 reasoning artifact has valid derived_from links to L2 semantics sources. Orphaned hazards (L3 entries with broken/missing derived_from) inflate the residual.

**Max dispatches: 3 per solve cycle.** Track a counter for Gate B dispatches. If the counter reaches 3, log `"Gate B: max remediation dispatches (3) reached this cycle — skipping further auto-fixes"` and skip to Step 3m.

Extract detail from `residual_vector.l2_to_l3.detail`:
- `orphaned_count` — L3 entries with no valid L2 back-link (mapped from gate-b-abstraction.cjs `orphaned_entries`)

If `orphaned_count > 0`:
\`\`\`
/nf:quick Fix {N} orphaned L3 reasoning entries identified by Gate B — add or repair derived_from links in .planning/formal/reasoning/ files to reference valid L2 semantics sources
\`\`\`

If `gate_b_score < 1.0` but `orphaned_count == 0`, the gap is due to low coverage rather than broken links. Dispatch:
\`\`\`
/nf:quick Improve Gate B L2->L3 traceability coverage — generate derived_from annotations for L3 entries missing semantic back-links (gate_b_score={score})
\`\`\`

All `/nf:quick` dispatches use default mode (no `--full` flag). Each dispatch increments the Gate B counter.

Log: `"Gate B: gate_b_score={score}, {orphaned_count} orphaned entries"`
```

**4. Add Step 3m: Gate C Remediation (L3->Test Recipe coverage)**

```
### 3m. Gate C Remediation (residual_vector.l3_to_tc.residual > 0)

Gate C verifies every L3 failure mode maps to at least one test recipe. Unvalidated failure modes lack test coverage.

**Max dispatches: 3 per solve cycle.** Track a counter for Gate C dispatches. If the counter reaches 3, log `"Gate C: max remediation dispatches (3) reached this cycle — skipping further auto-fixes"` and skip to Step 5.

Extract detail from `residual_vector.l3_to_tc.detail`:
- `unvalidated_count` — failure modes with no test recipe (mapped from gate-c-validation.cjs `unvalidated_entries`)
- `total_failure_modes` — total L3 failure modes

First, regenerate test recipes to ensure freshness:
\`\`\`bash
node bin/test-recipe-gen.cjs
\`\`\`

If unvalidated_count is still > 0 after regeneration, re-run gate-c-validation.cjs to get the updated gap list:
\`\`\`bash
node bin/gate-c-validation.cjs --json
\`\`\`

If gate-c-validation.cjs is not found or fails, skip the re-check and use the original unvalidated_count from the diagnostic (fail-open — consistent with Step 3j pattern).

**Important:** The gate-c re-run here is a local freshness check only. It does NOT update the `residual_vector` used by the convergence loop in Step 5. The residual_vector is only updated at the top of the next iteration when nf-solve.cjs runs a full re-diagnostic sweep. This is by design — each iteration gets a consistent snapshot from the diagnostic engine rather than piecemeal updates from individual gate scripts.

If the re-check confirms unvalidated failures remain, dispatch:
\`\`\`
/nf:quick Generate test recipes for {N} uncovered L3 failure modes identified by Gate C — add entries to .planning/formal/test-recipes/test-recipes.json mapping each failure mode to concrete test steps
\`\`\`

All `/nf:quick` dispatches use default mode (no `--full` flag). Each dispatch increments the Gate C counter.

Log: `"Gate C: gate_c_score={score}, {unvalidated_count}/{total_failure_modes} failure modes lack test recipes"`
```

**5. Add cross-layer-dashboard call in Step 6 (Before/After Summary)**

In Step 6, AFTER the before/after comparison table is displayed and BEFORE the "If any gaps remain" paragraph, add:

```
**Cross-Layer Alignment Dashboard:**

After displaying the before/after table, run the cross-layer dashboard for an aggregated alignment view:

\`\`\`bash
node bin/cross-layer-dashboard.cjs --cached
\`\`\`

Use `--cached` because gate scripts were already run during this solve cycle. Display the dashboard output as-is — it aggregates L1 coverage, Gate A, Gate B, and Gate C scores into a single terminal view showing overall cross-layer health.

If cross-layer-dashboard.cjs is not found, skip silently (fail-open).
```

**6. Update Step 5 convergence check**

In Step 5's iteration loop, update the `automatable_residual` computation to include gate residuals:

Change the automatable_residual formula to:
`automatable_residual = r_to_f + f_to_t + c_to_f + t_to_c + f_to_c + r_to_d + l1_to_l2 + l2_to_l3 + l3_to_tc`

This ensures gate remediation is included in the convergence loop — if gate residuals change between iterations, the solver continues iterating. Note: it is the re-diagnostic sweep (re-running nf-solve.cjs at the top of each iteration) that refreshes gate residuals, NOT the gate scripts themselves. The gate scripts are only called during the initial diagnostic; subsequent iterations re-run nf-solve.cjs which invokes them internally.

**7. Update Important Constraints section**

Add constraint 8:

```
8. **Layer alignment remediation** — Gate A/B/C failures are remediated via `/nf:quick` dispatch (default mode, no `--full` flag) after the hazard model is refreshed (Step 3j). The full dependency chain is: hazard-model refresh (3j) -> Gate A (3k) -> Gate B (3l) -> test-recipe-gen (in 3m) -> Gate C (3m). This ordering ensures: (a) L3 artifacts are fresh before gates evaluate them, (b) Gate A (L1->L2) fixes propagate before Gate B (L2->L3) checks traceability, (c) test recipes are regenerated before Gate C (L3->TC) evaluates coverage. Each gate is capped at 3 remediation dispatches per solve cycle to prevent runaway loops if residuals never converge.
```
  </action>
  <verify>
Verify the updated solve.md contains:
1. `grep -c "hazard-model" commands/nf/solve.md` returns >= 2 (step 3j + constraint 8)
2. `grep -c "gate-a-grounding" commands/nf/solve.md` returns >= 1 (step 3k)
3. `grep -c "gate-b" commands/nf/solve.md` returns >= 1 (step 3l reference)
4. `grep -c "gate-c-validation" commands/nf/solve.md` returns >= 1 (step 3m reference)
5. `grep -c "cross-layer-dashboard" commands/nf/solve.md` returns >= 1 (step 6 addition)
6. `grep "3j\." commands/nf/solve.md` confirms hazard model step exists
7. `grep "3k\." commands/nf/solve.md` confirms gate A step exists
8. `grep "3l\." commands/nf/solve.md` confirms gate B step exists
9. `grep "3m\." commands/nf/solve.md` confirms gate C step exists
10. `grep "test-recipe-gen" commands/nf/solve.md` confirms test recipe regeneration is referenced in step 3m
11. `grep "fail-open" commands/nf/solve.md` returns >= 2 (step 3j + step 3m)
12. `grep "no.*--full" commands/nf/solve.md` returns >= 1 (default mode documented)
13. `grep -c "max remediation dispatches" commands/nf/solve.md` returns >= 3 (one per gate step 3k, 3l, 3m)
14. `grep "genuine_violation" commands/nf/solve.md | grep -v "nf:quick"` returns matches (genuine_violation lines exist) AND `grep "genuine_violation" commands/nf/solve.md | grep "nf:quick"` returns NO matches (genuine_violation is never paired with /nf:quick dispatch)
15. `grep "does NOT update the residual_vector" commands/nf/solve.md` returns >= 1 (gate-c re-run clarification)
16. `grep "test-recipe-gen.*Gate C" commands/nf/solve.md` OR `grep "3m.*test-recipe" commands/nf/solve.md` confirms dependency chain ordering in constraint 8
  </verify>
  <done>
solve.md contains Steps 3j-3m (hazard-model refresh, Gate A/B/C remediation dispatch), cross-layer-dashboard call in Step 6, updated convergence formula including gate residuals with clarification that nf-solve.cjs re-runs refresh the residuals, and constraint 8 documenting the full dependency chain ordering (hazard-model -> Gate A -> Gate B -> test-recipe-gen -> Gate C). Each gate step enforces a max of 3 remediation dispatches per solve cycle to prevent runaway loops. genuine_violation entries are explicitly excluded from /nf:quick dispatch (logged only). The gate-c re-run in Step 3m is documented as a local freshness check that does NOT update the residual_vector until the next full nf-solve.cjs re-diagnostic sweep. All 5 bin scripts plus test-recipe-gen.cjs are wired into the orchestration flow. Fail-open handling covers hazard-model (3j) and gate-c re-run (3m). Field name mappings documented with executor verification instructions.
  </done>
</task>

</tasks>

<verification>
- solve.md parses correctly as a valid workflow file (YAML frontmatter intact)
- All 6 scripts referenced: gate-a-grounding.cjs, gate-b-abstraction.cjs, gate-c-validation.cjs, cross-layer-dashboard.cjs, hazard-model.cjs, test-recipe-gen.cjs
- Steps 3j-3m follow the existing step pattern (condition check, detail extraction, dispatch, logging)
- Remediation ordering preserved: hazard-model (3j) -> Gate A (3k) -> Gate B (3l) -> test-recipe-gen (in 3m) -> Gate C (3m)
- Genuine violations (Gate A) are NOT auto-remediated (logged only, never paired with /nf:quick)
- cross-layer-dashboard uses --cached flag (gates already ran this cycle)
- Fail-open pattern maintained for missing scripts (3j hazard-model, 3m gate-c re-run)
- All /nf:quick dispatches use default mode (no --full flag) to minimize overhead
- Field name mapping documented: orphaned_entries -> orphaned_count, unvalidated_entries -> unvalidated_count
- Convergence formula comment clarifies nf-solve.cjs re-diagnostic refreshes gate residuals
- Max 3 remediation dispatches per gate per solve cycle enforced in steps 3k, 3l, 3m
- Gate C re-run explicitly documented as NOT updating residual_vector (next iteration handles it)
</verification>

<success_criteria>
- Running `/nf:solve` with gate residuals > 0 will now dispatch remediation for Gate A instrumentation bugs and model gaps, Gate B orphaned entries, and Gate C unvalidated failure modes
- The cross-layer dashboard appears in Step 6 output after the before/after table
- The hazard model is refreshed before gate remediation to avoid stale data
- Convergence loop includes gate residuals so improvements trigger re-evaluation
- Remediation dispatches use default /nf:quick mode without --full overhead
- Gate C step regenerates test recipes via test-recipe-gen.cjs before re-checking
- No gate can dispatch more than 3 remediation /nf:quick calls per solve cycle
- genuine_violation lines never trigger /nf:quick dispatch (safety guarantee)
- Gate C re-run is a local check only; residual_vector updates deferred to next iteration's re-diagnostic
</success_criteria>

<output>
After completion, create `.planning/quick/202-wire-gate-a-b-c-cross-layer-dashboard-an/202-SUMMARY.md`
</output>
