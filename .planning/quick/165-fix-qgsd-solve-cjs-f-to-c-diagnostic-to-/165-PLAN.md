---
phase: quick-165
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
autonomous: true
requirements: [QUICK-140]
formal_artifacts: none

must_haves:
  truths:
    - "sweepFtoC() always runs run-formal-verify.cjs regardless of --report-only flag"
    - "f_to_c.residual reflects actual failure count from all 26+ checks, not stale CI-only subset"
    - "check-results.ndjson is freshly populated before the solver reads it"
    - "Report-only mode still prevents auto-close remediation but computes fresh diagnostic data"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "Fresh F→C diagnostic in all modes"
      contains: "run-formal-verify"
  key_links:
    - from: "bin/qgsd-solve.cjs"
      to: "bin/run-formal-verify.cjs"
      via: "sweepFtoC always runs verification"
      pattern: "run-formal-verify"
---

<objective>
Fix sweepFtoC() in bin/qgsd-solve.cjs to always run run-formal-verify.cjs — remove the report-only shortcut that reads stale check-results.ndjson.

Purpose: The solver's F→C layer currently reads cached ndjson in report-only mode. When the cache only has 4 CI-gated checks (from a partial/CI-only run), the solver reports f_to_c.residual=0 while 6+ individual alloy/tla/prism checks are actually failing. This prevents the /qgsd:solve skill from dispatching remediation.

Output: sweepFtoC() runs run-formal-verify.cjs in all modes (matching sweepTtoC behavior), so f_to_c.residual always reflects the real failure count.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/qgsd-solve.cjs
@bin/run-formal-verify.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove report-only shortcut from sweepFtoC()</name>
  <files>bin/qgsd-solve.cjs</files>
  <action>
In sweepFtoC() (around line 617), remove the entire `if (reportOnly) { ... }` block (lines 628-687). This block reads stale check-results.ndjson instead of running verification.

After removal, sweepFtoC() should always:
1. Check if run-formal-verify.cjs exists (existing check at line 620)
2. Run `bin/run-formal-verify.cjs` via spawnTool (existing code at line 690)
3. Parse the freshly populated check-results.ndjson (existing code at line 701-759)

This makes sweepFtoC() consistent with sweepTtoC() which always runs `node --test` regardless of report-only mode. The report-only flag correctly prevents auto-close remediation (line 1400) but should not prevent fresh data collection.

No other changes needed — the non-report-only code path already handles the full flow correctly.
  </action>
  <verify>
Run `node bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd) 2>/dev/null` and confirm:
- f_to_c.detail.total_checks shows 26+ (not 4)
- f_to_c.residual reflects actual failure count
- No regression in other layer residuals
  </verify>
  <done>
sweepFtoC() always runs run-formal-verify.cjs. The solver reports accurate f_to_c.residual from all formal checks, not stale CI-only cache data.
  </done>
</task>

</tasks>

<verification>
1. `node bin/qgsd-solve.cjs --json --report-only --project-root=$(pwd)` — f_to_c.detail.total_checks > 4
2. f_to_c.residual matches actual failing check count from check-results.ndjson
3. Other layer residuals unchanged
</verification>

<success_criteria>
- f_to_c.residual reflects actual formal verification failure count (all 26+ checks, not 4 CI-only)
- report-only mode still prevents auto-close but computes fresh diagnostic data
- /qgsd:solve skill can now see real F→C failures and dispatch remediation
</success_criteria>

<output>
After completion, create `.planning/quick/165-fix-qgsd-solve-cjs-f-to-c-diagnostic-to-/165-SUMMARY.md`
</output>
