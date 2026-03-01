---
phase: quick-126
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/PROJECT.md
  - qgsd-core/workflows/plan-phase.md
  - qgsd-core/workflows/verify-phase.md
autonomous: true
requirements: [QUICK-126]

must_haves:
  truths:
    - "PROJECT.md contains an R9 rule that explicitly prohibits weakening spec objectives to match reality"
    - "R9 defines concrete 'weakening' criteria: relaxing thresholds, removing invariants, softening 'must' to 'should', reducing success criterion count"
    - "plan-phase.md planner prompt contains a binding_rule block enforcing R9 for plan creation"
    - "plan-phase.md checker prompt contains a binding_rule block enforcing R9 for plan verification"
    - "verify-phase.md contains a Step 0 baseline capture that reads ROADMAP success_criteria before loading PLAN must_haves"
    - "verify-phase.md Step 0 baseline capture includes a schema validation guard that halts on malformed success_criteria (parse error, non-array, empty strings)"
    - "verify-phase.md verifier has a binding_rule block enforcing R9 during goal-backward verification"
    - "verify-phase.md determine_status defines r9_deviation as WARNING-level with explicit downstream action (does not block, surfaces for human review)"
    - "R9 notes that generate-phase-spec.cjs truths must match ROADMAP criteria to prevent TLA+ PROPERTY weakness inheritance"
  artifacts:
    - path: ".planning/PROJECT.md"
      provides: "R9 binding rule definition with explicit weakening criteria"
      contains: "R9"
    - path: "qgsd-core/workflows/plan-phase.md"
      provides: "binding_rule blocks in planner and checker prompts"
      contains: "binding_rule"
    - path: "qgsd-core/workflows/verify-phase.md"
      provides: "Step 0 baseline capture and binding_rule block in verifier"
      contains: "baseline_capture"
  key_links:
    - from: "qgsd-core/workflows/plan-phase.md"
      to: ".planning/PROJECT.md"
      via: "Planner and checker binding_rule blocks reference R9 policy"
      pattern: "R9"
    - from: "qgsd-core/workflows/verify-phase.md"
      to: "ROADMAP.md success_criteria"
      via: "Step 0 reads ROADMAP success_criteria as immutable baseline before PLAN must_haves"
      pattern: "success_criteria.*immutable|baseline_capture"
    - from: ".planning/PROJECT.md"
      to: "bin/generate-phase-spec.cjs"
      via: "R9 notes truths fed to spec generation must match ROADMAP criteria"
      pattern: "generate-phase-spec"
---

<objective>
Add a binding rule (R9) to enforce that spec objectives are never weakened to match
reality, and wire this rule into the planner, checker, and verifier agent prompts.
Also add a pre-verification baseline capture step in verify-phase.md that reads
ROADMAP success_criteria before loading PLAN must_haves, detecting objective drift
at verification entry point.

Purpose: Prevent the "helpful weakening" anti-pattern where models suggest lowering
thresholds, removing invariants, or softening pass criteria to make failing code pass.
The fix must always be in the code, not in relaxing the spec's objectives.

Output: Updated PROJECT.md with R9 rule, updated plan-phase.md with binding_rule
blocks in planner and checker prompts, updated verify-phase.md with Step 0 baseline
capture and binding_rule block in verifier.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
@qgsd-core/workflows/plan-phase.md
@qgsd-core/workflows/verify-phase.md
@.planning/todos/pending/2026-03-01-enforce-spec-requirements-never-reduce-objectives-to-match-reality.md
@.planning/debates/2026-03-01-review-enforcement-plan-never-reduce-objectives.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add R9 binding rule to PROJECT.md with explicit weakening criteria</name>
  <files>.planning/PROJECT.md</files>
  <action>
Read `.planning/PROJECT.md`. Add a new section BEFORE the `## Key Decisions` table (after
the `## Constraints` section, around line 353). Insert a new section:

```markdown
## Binding Rules

### R9 — Spec Objectives Are Immutable During Verification

**Principle:** Spec structure must track reality, but spec objectives must never be weakened
to match reality's shortcomings.

**Two distinct concerns:**
1. **Spec models MUST accurately reflect the real system** — if the code has 5 states, the
   spec should model 5 states. An inaccurate model produces meaningless verification results.
2. **Target objectives/pass criteria MUST NOT be lowered** — if the spec says 100% stability
   is required and code achieves 80%, the fix is in the code, not in relaxing the spec.

**"Weakening" is explicitly defined as any of:**
- Relaxing numeric thresholds (e.g., 100% -> 80%, 3-round cap -> 5-round cap)
- Removing invariants or liveness properties from a spec
- Softening "must" to "should" or "shall" to "may" in success criteria
- Reducing the count of success criteria for a phase
- Changing FAIL verdicts to PASS without code changes
- Narrowing the scope of what a truth or property covers

**Enforcement points:**
- **Planner:** PLAN must_haves truths must be derived from ROADMAP success_criteria, not invented independently. Must not reduce scope.
- **Plan checker:** Checker must verify PLAN truths cover all ROADMAP success_criteria for the phase. Missing criteria = blocker.
- **Verifier:** Pre-verification baseline captures ROADMAP success_criteria as immutable reference. Deviations between PLAN must_haves and ROADMAP criteria are flagged before verification begins.
- **Spec generation:** `generate-phase-spec.cjs` reads truths from PLAN frontmatter. If truths are weakened relative to ROADMAP criteria, TLA+ PROPERTY stubs inherit the weakness. R9 requires truths to match ROADMAP criteria.

**Any proposed objective relaxation requires explicit user approval** with justification
documented in the Key Decisions table.
```

Do NOT modify any other section of PROJECT.md. The only change is the insertion of the
`## Binding Rules` section with the R9 subsection.
  </action>
  <verify>
1. `grep -c "R9" .planning/PROJECT.md` -- should be >= 3 (heading + enforcement points + references)
2. `grep -c "Weakening" .planning/PROJECT.md` -- should be >= 1
3. `grep -c "generate-phase-spec" .planning/PROJECT.md` -- should be >= 1
4. `grep -c "Binding Rules" .planning/PROJECT.md` -- should be 1
5. `grep -n "## Binding Rules" .planning/PROJECT.md` -- should appear before `## Key Decisions`
6. `grep -n "## Key Decisions" .planning/PROJECT.md` -- should still exist (not accidentally deleted)
  </verify>
  <done>
PROJECT.md contains an R9 binding rule section with:
- Clear principle distinguishing spec structure (must track reality) from spec objectives (immutable)
- Explicit definition of "weakening" with 6 concrete criteria
- Four enforcement points (planner, checker, verifier, spec generation)
- User approval requirement for any objective relaxation
  </done>
</task>

<task type="auto">
  <name>Task 2: Add binding_rule blocks to planner and checker prompts in plan-phase.md</name>
  <files>qgsd-core/workflows/plan-phase.md</files>
  <action>
Read `qgsd-core/workflows/plan-phase.md`. Make two targeted insertions:

**A. Planner prompt (Step 8, around line 252):**

Inside the planner prompt markdown block (between `<planning_context>` and `</downstream_consumer>`),
add a new block AFTER the closing `</planning_context>` tag and BEFORE `<downstream_consumer>`:

```markdown
<binding_rule id="R9">
PLAN must_haves truths MUST be derived from ROADMAP success_criteria for this phase.
You MUST NOT:
- Invent truths that are weaker than ROADMAP success_criteria
- Reduce the count of truths below the count of success_criteria
- Soften language ("must" -> "should", "all" -> "some")
- Narrow the scope of what a truth covers compared to its source criterion

If ROADMAP has no success_criteria for this phase, derive truths from the phase goal
using goal-backward methodology. The truths must be AT LEAST as strong as the goal implies.

Any truth that relaxes a ROADMAP success criterion is a plan defect, not an optimization.
</binding_rule>
```

**B. Checker prompt (Step 10, around line 466):**

Inside the checker prompt markdown block (between `</files_to_read>` and `</verification_context>`),
add a new block AFTER the "Project skills" line and BEFORE the closing `</verification_context>`:

```markdown
<binding_rule id="R9">
Verify that PLAN must_haves truths cover ALL ROADMAP success_criteria for this phase.
Flag as BLOCKER if:
- Any ROADMAP success criterion has no corresponding PLAN truth
- Any PLAN truth is weaker than its source ROADMAP criterion (relaxed threshold, narrowed scope, softened language)
- The count of PLAN truths is less than the count of ROADMAP success_criteria
- Any truth uses "should" where ROADMAP uses "must", or "some" where ROADMAP uses "all"

Objective relaxation is NEVER acceptable as a plan optimization. Missing or weakened
criteria = blocker, not warning.
</binding_rule>
```

Do NOT modify any other part of plan-phase.md. The only changes are the two binding_rule
block insertions inside existing prompt templates.
  </action>
  <verify>
1. `grep -c "binding_rule" qgsd-core/workflows/plan-phase.md` -- should be >= 4 (2 opening + 2 closing tags)
2. `grep -c "R9" qgsd-core/workflows/plan-phase.md` -- should be >= 2 (one per binding_rule)
3. `grep -n "binding_rule.*R9" qgsd-core/workflows/plan-phase.md` -- should show two distinct line numbers
4. Verify planner block placement: the first `binding_rule` should appear between `</planning_context>` and `<downstream_consumer>`
5. Verify checker block placement: the second `binding_rule` should appear inside the `<verification_context>` block
6. `grep -c "BLOCKER" qgsd-core/workflows/plan-phase.md` -- should be >= 1 (in checker rule)
  </verify>
  <done>
plan-phase.md contains two binding_rule blocks:
- Planner prompt: R9 rule requiring truths derived from ROADMAP success_criteria, prohibiting weakening
- Checker prompt: R9 rule requiring blocker-level flag when truths are missing or weaker than ROADMAP criteria
Both blocks are inside the existing prompt templates, not modifying surrounding workflow logic.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add Step 0 baseline capture and binding_rule to verify-phase.md</name>
  <files>qgsd-core/workflows/verify-phase.md</files>
  <action>
Read `qgsd-core/workflows/verify-phase.md`. Make two targeted insertions:

**A. New Step 0 — Baseline Capture (insert BEFORE the existing `<step name="load_context">`):**

Add a new step as the FIRST step in the `<process>` block, before `load_context`:

```xml
<step name="baseline_capture" priority="first">
**Step 0 — Capture ROADMAP Success Criteria as Immutable Baseline (R9)**

Before loading any PLAN must_haves, capture the ROADMAP success_criteria as the
immutable verification baseline. This prevents objective drift where PLAN truths
silently weaken ROADMAP criteria.

```bash
# Read ROADMAP success criteria for this phase
PHASE_DATA=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap get-phase "${PHASE_ARG}" --raw 2>/dev/null)
ROADMAP_CRITERIA=$(echo "$PHASE_DATA" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const sc = d.success_criteria || [];
  sc.forEach((c,i) => console.log('SC-' + (i+1) + ': ' + c));
  if (sc.length === 0) console.log('(no success_criteria in ROADMAP — will use PLAN must_haves as primary source)');
")
echo "$ROADMAP_CRITERIA"
```

Store `$ROADMAP_CRITERIA` as the baseline. This is the contract — it cannot be weakened.

**Schema validation guard (R9 robustness):**

If the ROADMAP phase entry exists but `success_criteria` is present and malformed (parse
error, non-array type, or array with empty/whitespace-only strings), flag immediately:
`ERROR (R9): ROADMAP success_criteria for phase "${PHASE_ARG}" exists but is malformed. Cannot establish baseline. Halting verification — fix ROADMAP before retrying.`
Exit the verification workflow at this point (do NOT fall through to "no criteria" path).
This prevents silent failures where corrupted ROADMAP data causes the baseline capture to
silently skip comparison, defeating the purpose of R9.

Only three states are valid:
1. `success_criteria` key absent or explicitly empty `[]` → no baseline, use PLAN must_haves
2. `success_criteria` is a well-formed non-empty array of strings → use as immutable baseline
3. Anything else (parse error, non-array, empty strings in array) → ERROR, halt

**After loading PLAN must_haves (in the establish_must_haves step), compare:**

If ROADMAP success_criteria exist (non-empty, validated):
1. Count ROADMAP criteria vs PLAN truths. If PLAN truths < ROADMAP criteria count, flag:
   `WARNING (R9): PLAN has fewer truths ({N}) than ROADMAP success_criteria ({M}). Possible objective reduction.`
2. For each ROADMAP criterion, check if a corresponding PLAN truth exists. If missing, flag:
   `WARNING (R9): ROADMAP criterion "{criterion}" has no matching PLAN truth. Verification may miss this objective.`
3. Include all R9 warnings in the VERIFICATION.md report under a dedicated `## R9 Baseline Comparison` section.

If ROADMAP success_criteria are empty, skip comparison — PLAN must_haves are the primary source (no baseline to compare against).
</step>
```

**B. Binding rule block in verifier (insert inside `<step name="establish_must_haves">`):**

At the TOP of the `establish_must_haves` step (after the opening `<step>` tag but before
"Option A"), add:

```markdown
<binding_rule id="R9">
ROADMAP success_criteria are the immutable contract. When both ROADMAP success_criteria
and PLAN must_haves exist:
- Success Criteria from ROADMAP override PLAN-level must_haves (this is already stated
  in Option B — R9 makes it explicit and mandatory)
- If PLAN truths are fewer or weaker than ROADMAP criteria, report as R9 deviation
- NEVER reduce verification scope to match what the code actually does
- If code fails a ROADMAP criterion, the verdict is FAILED — not "criterion was too strict"

Spec generation note: generate-phase-spec.cjs reads truths from PLAN frontmatter.
If PLAN truths have drifted from ROADMAP criteria, the generated TLA+ PROPERTY stubs
will inherit the weakness. Flag this in the R9 Baseline Comparison section.
</binding_rule>
```

Do NOT modify the existing step content in `establish_must_haves`. The binding_rule is
additive — it provides policy context to the verifier agent, not new logic steps.

**C. Update the `<step name="determine_status">` step:**

In the determine_status step, after the existing `**gaps_found:**` line, add a new bullet:

```markdown
**r9_deviation:** ROADMAP success_criteria exist AND (PLAN truths count < ROADMAP criteria count OR any ROADMAP criterion has no matching PLAN truth).

R9 deviation severity and downstream action:
- **Does NOT change the overall PASS/FAIL status** of the verification — the phase verdict is determined solely by gap analysis against must_haves truths.
- **DOES produce a dedicated `## R9 Baseline Comparison` section** in VERIFICATION.md with each deviation listed and its specific drift description.
- **DOES emit a WARNING-level notice** in the verification summary block (not a blocker, not silent).
- **Downstream effect:** The R9 deviation section is designed for human review at the end of verification. It does not block execution of subsequent phases, but it signals that the PLAN's scope may have drifted from the ROADMAP contract. The user can then choose to: (a) update the PLAN truths to re-align with ROADMAP, (b) update ROADMAP criteria with explicit justification in Key Decisions, or (c) acknowledge and proceed.
- **Rationale for WARNING (not blocker):** R9 deviations may be legitimate (e.g., ROADMAP criteria were split across multiple phases). Blocking execution would create false-positive halts. The WARNING ensures visibility without halting the workflow.
```
  </action>
  <verify>
1. `grep -c "baseline_capture" qgsd-core/workflows/verify-phase.md` -- should be >= 1
2. `grep -c "binding_rule" qgsd-core/workflows/verify-phase.md` -- should be >= 2 (opening + closing)
3. `grep -c "R9" qgsd-core/workflows/verify-phase.md` -- should be >= 4 (step 0 heading, binding_rule, baseline comparison, determine_status)
4. `grep -c "ROADMAP_CRITERIA" qgsd-core/workflows/verify-phase.md` -- should be >= 2 (capture + comparison)
5. `grep -c "success_criteria" qgsd-core/workflows/verify-phase.md` -- should be >= 3 (already has some + new additions)
6. `grep -c "generate-phase-spec" qgsd-core/workflows/verify-phase.md` -- should be >= 1 (in binding_rule)
7. `grep -n "baseline_capture" qgsd-core/workflows/verify-phase.md` -- should appear BEFORE `load_context`
8. `grep -c "r9_deviation" qgsd-core/workflows/verify-phase.md` -- should be >= 1
9. `grep -c "malformed" qgsd-core/workflows/verify-phase.md` -- should be >= 1 (schema validation guard)
10. `grep -c "Halting verification" qgsd-core/workflows/verify-phase.md` -- should be >= 1 (halt on malformed criteria)
11. `grep -c "WARNING-level" qgsd-core/workflows/verify-phase.md` -- should be >= 1 (r9_deviation severity)
  </verify>
  <done>
verify-phase.md contains:
- Step 0 baseline_capture that reads ROADMAP success_criteria BEFORE loading PLAN must_haves
- Schema validation guard in Step 0 that halts on malformed success_criteria (parse error, non-array, empty strings)
- Comparison logic that flags when PLAN truths are fewer or weaker than ROADMAP criteria
- binding_rule block in establish_must_haves enforcing R9 policy
- R9 deviation status in determine_status as WARNING-level with explicit downstream action (does not block execution, surfaces for human review with three resolution options)
- Note about generate-phase-spec.cjs truth-to-ROADMAP alignment
  </done>
</task>

</tasks>

<verification>
1. PROJECT.md has R9 binding rule with explicit weakening criteria (6 items)
2. plan-phase.md planner prompt has binding_rule requiring truths from ROADMAP success_criteria
3. plan-phase.md checker prompt has binding_rule flagging missing/weakened criteria as blockers
4. verify-phase.md Step 0 captures ROADMAP success_criteria before PLAN must_haves
5. verify-phase.md establish_must_haves has binding_rule enforcing immutability
6. verify-phase.md determine_status includes r9_deviation status
7. generate-phase-spec.cjs is referenced in both PROJECT.md R9 and verify-phase.md binding_rule
8. All three quorum-identified gaps are addressed:
   - Explicit "weakening" definition (opencode-1) -> R9 in PROJECT.md
   - Pre-verification baseline capture (claude-4) -> Step 0 in verify-phase.md
   - generate-phase-spec.cjs coverage (Claude) -> R9 enforcement points + verify-phase.md note
9. Step 0 schema validation guard halts on malformed ROADMAP success_criteria (R3.6 improvement: claude-4)
10. determine_status r9_deviation has explicit WARNING-level severity with documented downstream action (R3.6 improvement: claude-4)
</verification>

<success_criteria>
- R9 rule is defined in PROJECT.md with 6 explicit weakening criteria
- Planner and checker in plan-phase.md both have binding_rule blocks referencing R9
- Verifier in verify-phase.md reads ROADMAP success_criteria BEFORE PLAN must_haves
- Deviations between ROADMAP criteria and PLAN truths are flagged in VERIFICATION.md
- generate-phase-spec.cjs truth alignment is documented in R9 enforcement points
- Step 0 halts with ERROR on malformed ROADMAP success_criteria (prevents silent baseline skip)
- r9_deviation in determine_status is WARNING-level with explicit downstream action and rationale
- No existing workflow logic is broken — all changes are additive insertions
</success_criteria>

<output>
After completion, create `.planning/quick/126-enforce-spec-requirements-never-reduce-o/126-SUMMARY.md`
</output>
