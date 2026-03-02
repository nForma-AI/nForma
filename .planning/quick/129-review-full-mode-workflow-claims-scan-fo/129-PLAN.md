---
phase: quick-129
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md
autonomous: true
requirements: [QUICK-FULL-AUDIT]
formal_artifacts: none

must_haves:
  truths:
    - "Each --full mode claim from commands/qgsd/quick.md is verified as present (or absent) in qgsd-core/workflows/quick.md"
    - "Each --full mode claim from commands/qgsd/quick.md is verified as present (or absent) in the installed ~/.claude/qgsd/workflows/quick.md"
    - "Quorum steps in --full mode respect EventualConsensus liveness (fail-open path exists for unavailable slots)"
    - "SUMMARY.md lists pass/fail status per claim with grep evidence"
  artifacts:
    - path: ".planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md"
      provides: "Audit results: pass/fail per --full mode claim with evidence lines"
      min_lines: 40
  key_links:
    - from: "commands/qgsd/quick.md objective --full claims"
      to: "qgsd-core/workflows/quick.md steps 4.5, 5.5, 6, 6.5, 6.5.1"
      via: "grep pattern match"
      pattern: "FORMAL_SPEC_CONTEXT|formal_artifacts|Step 4.5|Step 6.5.1"
---

<objective>
Audit the --full mode workflow claims stated in `commands/qgsd/quick.md` against the actual implementation in `qgsd-core/workflows/quick.md` and the installed copy at `~/.claude/qgsd/workflows/quick.md`.

Purpose: Quick-128 added formal/ integration to --full mode but its verification status is "Pending". This audit produces a definitive pass/fail verdict for each documented claim so the status can be updated to "Verified" or flagged for gap closure.

Output: 129-SUMMARY.md with per-claim audit results, grep evidence, and overall verdict.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/128-upgrade-quick-full-mode-formal-integrati/128-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit --full mode workflow claims and produce SUMMARY.md</name>
  <files>.planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md</files>
  <action>
Perform a grep-based audit of the --full mode claims. The claims are stated in `commands/qgsd/quick.md` (the `**--full flag:**` block under `<objective>`). Verify each claim against `qgsd-core/workflows/quick.md` (source) and `~/.claude/qgsd/workflows/quick.md` (installed copy).

**Claims to audit (from commands/qgsd/quick.md):**

1. Plan-checking (max 2 iterations): Step 5.5 must exist with an iteration cap of 2.
   - Grep: `grep -n "max 2\|iteration_count\|Max iterations" qgsd-core/workflows/quick.md`

2. Formal scope scan (step 4.5): Discovers `formal/spec/*/invariants.md` before planner spawns.
   - Grep: `grep -n "Step 4.5\|formal/spec\|FORMAL_SPEC_CONTEXT" qgsd-core/workflows/quick.md`

3. Plan frontmatter must declare `formal_artifacts:`: Planner prompt includes this requirement.
   - Grep: `grep -n "formal_artifacts" qgsd-core/workflows/quick.md`

4. Executor commits formal/ files atomically when `formal_artifacts` non-empty:
   - Grep: `grep -n "formal_artifacts.*update\|formal_artifacts.*create\|Formal.*files.*commit\|include.*formal" qgsd-core/workflows/quick.md`

5. Verifier checks invariant compliance and formal artifact syntax:
   - Grep: `grep -n "invariant\|formal.*syntax\|TLA\+\|Alloy\|PRISM" qgsd-core/workflows/quick.md`

6. Quorum reviews VERIFICATION.md after passing (can downgrade to "Needs Review"):
   - Grep: `grep -n "Step 6.5.1\|Quorum review.*VERIFICATION\|Needs Review\|downgrade" qgsd-core/workflows/quick.md`

**EventualConsensus liveness check (from quorum/invariants.md):**
The EventualConsensus property requires that quorum eventually reaches DECIDED. The fail-open policy must cover all quorum steps in --full mode. Check that every quorum dispatch block in --full mode has a fail-open clause.
- Grep: `grep -n "UNAVAIL\|fail.open\|unavailable\|Quorum unavailable" qgsd-core/workflows/quick.md`

**Installed copy sync check:**
Verify that the installed `~/.claude/qgsd/workflows/quick.md` matches the source for the critical formal integration markers.
- Grep: `grep -c "FORMAL_SPEC_CONTEXT\|Step 4.5\|Step 6.5.1\|formal_artifacts" ~/.claude/qgsd/workflows/quick.md`
- Compare count against same grep on `qgsd-core/workflows/quick.md`

For each claim, record:
- Status: PASS / FAIL / PARTIAL
- Evidence: the grep output lines (line numbers + content)
- Notes: any discrepancy or gap observed

Write `129-SUMMARY.md` with the standard summary frontmatter plus a `## Audit Results` section that lists each claim as a table row with status and evidence, followed by an `## Overall Verdict` section (PASS / NEEDS-GAP-CLOSURE) and `## Liveness Compliance` section covering EventualConsensus.

If any claim is FAIL or PARTIAL, list it under `## Gaps` with the specific fix needed.
  </action>
  <verify>
    1. `129-SUMMARY.md` exists at `.planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md`
    2. `grep -c "PASS\|FAIL\|PARTIAL" .planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md` returns 6+ (one per claim)
    3. `grep "Overall Verdict" .planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md` returns a result
    4. `grep "Liveness Compliance\|EventualConsensus" .planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md` returns a result
  </verify>
  <done>
    SUMMARY.md contains a pass/fail verdict for all 6 --full mode claims plus a liveness compliance section, backed by grep evidence lines. Overall verdict is stated (PASS or NEEDS-GAP-CLOSURE).
  </done>
</task>

</tasks>

<verification>
- SUMMARY.md exists and is >= 40 lines
- All 6 claims assessed with evidence
- EventualConsensus liveness compliance documented
- Installed copy sync result documented
- Overall verdict present
</verification>

<success_criteria>
Audit complete: every --full mode claim from `commands/qgsd/quick.md` has a pass/fail verdict with grep evidence in `129-SUMMARY.md`. Quick-128 status can be upgraded from "Pending" to "Verified" (or a gap closure plan can be created if any claims are FAIL/PARTIAL).
</success_criteria>

<output>
After completion, create `.planning/quick/129-review-full-mode-workflow-claims-scan-fo/129-SUMMARY.md` (this is the primary artifact of this plan — the SUMMARY.md IS the deliverable, not a post-completion report).
</output>
