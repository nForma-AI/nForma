---
phase: quick-336
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/classify-tlc-failure.cjs
  - bin/classify-tlc-failure.test.cjs
  - commands/nf/solve-remediate.md
  - bin/write-check-result.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-336]

must_haves:
  truths:
    - "classifyTlcFailure correctly classifies deadlock TLC output as 'deadlock'"
    - "classifyTlcFailure correctly classifies SANY semantic errors as 'sany_semantic'"
    - "classifyTlcFailure correctly classifies temporal property violations with stuttering as 'fairness_gap'"
    - "classifyTlcFailure returns 'invariant_violation', 'syntax_error', or 'unknown' for remaining cases"
    - "solve-remediate.md F->C section dispatches deadlock/sany_semantic/fairness_gap to targeted fix templates"
    - "write-check-result.cjs accepts optional failure_class field without breaking existing callers"
  artifacts:
    - path: "bin/classify-tlc-failure.cjs"
      provides: "TLC failure classifier with 6-class enum"
      exports: ["classifyTlcFailure", "FAILURE_CLASSES"]
    - path: "bin/classify-tlc-failure.test.cjs"
      provides: "Test coverage for all 6 failure classes"
      min_lines: 80
    - path: "commands/nf/solve-remediate.md"
      provides: "Updated F->C dispatch table with targeted fix templates"
      contains: "classify-tlc-failure"
    - path: "bin/write-check-result.cjs"
      provides: "Optional failure_class field in check result schema"
      contains: "failure_class"
  key_links:
    - from: "bin/classify-tlc-failure.cjs"
      to: "commands/nf/solve-remediate.md"
      via: "F->C dispatch calls classifier before routing"
      pattern: "classify-tlc-failure"
    - from: "bin/classify-tlc-failure.cjs"
      to: "bin/write-check-result.cjs"
      via: "reads check-results.ndjson entries that write-check-result produces"
      pattern: "summary.*metadata"
    - from: "commands/nf/solve-remediate.md"
      to: "deadlock fix template"
      via: "pattern-matched dispatch for Done stuttering step"
      pattern: "Done.*stuttering"
---

<objective>
Create a TLC failure classifier (bin/classify-tlc-failure.cjs) with 3 pattern-matched detectors for deadlock, SANY semantic errors, and fairness gaps. Wire it into solve-remediate.md's F->C dispatch so these common failures get auto-fix templates instead of generic LLM dispatch. Add optional failure_class field to write-check-result.cjs schema.

Purpose: Eliminates LLM reasoning overhead for the 3 most common TLC failure patterns by providing deterministic, template-driven fixes directly in the remediation layer.
Output: New classifier module, updated F->C dispatch in solve-remediate.md, extended check result schema.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/write-check-result.cjs
@commands/nf/solve-remediate.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create TLC failure classifier with tests</name>
  <files>bin/classify-tlc-failure.cjs, bin/classify-tlc-failure.test.cjs</files>
  <action>
Create bin/classify-tlc-failure.cjs exporting `classifyTlcFailure(entry)` and `FAILURE_CLASSES`.

The function accepts a check-results.ndjson entry object (with fields: tool, formalism, result, summary, metadata, check_id, surface, property, triage_tags) and returns a string enum from FAILURE_CLASSES.

**FAILURE_CLASSES** = ["deadlock", "sany_semantic", "fairness_gap", "invariant_violation", "syntax_error", "unknown"]

**Classification logic (ordered, first match wins):**

1. **deadlock** - Match when:
   - `summary` contains "Deadlock reached" (case-insensitive), OR
   - `summary` contains "deadlock" AND `result` is "fail"
   - Return: `"deadlock"`

2. **sany_semantic** - Match when:
   - `summary` contains "Semantic error" (case-insensitive), OR
   - `summary` contains "multiply-defined symbol" OR "multiply defined", OR
   - `metadata.error_type === "semantic"` if metadata exists
   - Return: `"sany_semantic"`

3. **fairness_gap** - Match when:
   - `summary` contains "Temporal properties were violated" (case-insensitive), OR
   - (`summary` contains "temporal" OR "liveness") AND (`summary` contains "stuttering" OR `metadata.trace_type === "stuttering"`), OR
   - `property` contains "Liveness" AND `result` is "fail" AND `summary` contains "stuttering"
   - Return: `"fairness_gap"`

4. **syntax_error** - Match when:
   - `summary` contains "Syntax error" OR "parse error" (case-insensitive), OR
   - `result` is "error" AND `summary` contains "SANY" AND NOT matching sany_semantic above
   - Return: `"syntax_error"`

5. **invariant_violation** - Match when:
   - `result` is "fail" AND `summary` contains "Invariant" (case-insensitive), OR
   - `result` is "fail" AND `summary` contains "counterexample" AND not matching above classes
   - Return: `"invariant_violation"`

6. **unknown** - Default fallback for anything not matching above.

**Defensive coding:**
- Handle null/undefined entry gracefully (return "unknown")
- Handle missing/null summary, metadata fields (treat as empty string/object)
- Use `'use strict'` header per project convention
- Export via `module.exports = { classifyTlcFailure, FAILURE_CLASSES }`

**Test file (bin/classify-tlc-failure.test.cjs):**

Use `node:test` and `node:assert/strict` per project convention (see bin/attribute-trace-divergence.test.cjs for pattern).

Write tests covering all 6 classes with realistic TLC output samples:

1. deadlock: entry with summary "Error: Deadlock reached. No successor states."
2. sany_semantic: entry with summary "Semantic error: multiply-defined symbol 'X' at line 42"
3. fairness_gap: entry with summary "Temporal properties were violated. Stuttering detected in trace."
4. invariant_violation: entry with summary "Invariant TypeInvariant is violated. Counterexample found." result="fail"
5. syntax_error: entry with summary "Syntax error at line 10: unexpected token"
6. unknown: entry with summary "Some unrecognized output" result="warn"
7. null/undefined entry returns "unknown"
8. entry with missing summary returns "unknown" (unless other fields match)
9. deadlock with metadata.trace also classified correctly
10. fairness_gap via property field: property="FallbackLiveness" result="fail" summary contains "stuttering"
  </action>
  <verify>
Run: `node --test bin/classify-tlc-failure.test.cjs`
All tests pass. Confirm at least 10 test cases covering all 6 failure classes.
  </verify>
  <done>
bin/classify-tlc-failure.cjs exports classifyTlcFailure that correctly classifies all 6 TLC failure types.
bin/classify-tlc-failure.test.cjs has 10+ passing tests with realistic TLC output samples.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update F->C dispatch table and write-check-result schema</name>
  <files>commands/nf/solve-remediate.md, bin/write-check-result.cjs</files>
  <action>
**Part A: Update solve-remediate.md F->C section (lines 414-429)**

Replace the current classification table (lines 416-423) and dispatch instructions (lines 425-429) with an updated version that:

1. Adds a step BEFORE the classification table instructing to run the classifier:
```markdown
Then parse `.planning/formal/check-results.ndjson` and for each entry with `result` of "fail" or "error", classify using `classifyTlcFailure` from `bin/classify-tlc-failure.cjs`:

```bash
FAILURE_CLASS=$(node -e "const {classifyTlcFailure}=require('./bin/classify-tlc-failure.cjs'); const e=JSON.parse(process.argv[1]); console.log(classifyTlcFailure(e))" "$ENTRY_JSON")
```
```

2. Replace the classification table with an expanded version adding the 3 targeted dispatches:

| Classification | failure_class | Dispatch |
|---------------|--------------|----------|
| **Deadlock** | `deadlock` | Auto-fix: Add `Done == phase \in {terminal_states} /\ UNCHANGED vars` stuttering step to the spec. Identify terminal state(s) from the spec's state enum/set. Add `Done` to the `Next` disjunction (`Next == ... \/ Done`). If `Done` already exists, check that it covers all `UNCHANGED vars`. |
| **SANY semantic error** | `sany_semantic` | Auto-fix: Parse the "multiply-defined symbol 'X'" from summary. Find the second binding of `X` (typically in fairness quantifiers like `\A X \in ...`). Rename it to `X_fair` or `Xd` to avoid collision. Verify the rename does not break other references. |
| **Fairness gap** | `fairness_gap` | Auto-fix: Parse the violated temporal property name from summary. Identify the action that is enabled but never fires from the counterexample trace (the stuttering action). Add `WF_vars(ActionName)` to the `Spec` definition's fairness conjunction. If the Spec already has fairness, append with `/\`. |
| **Syntax error** | `syntax_error` | `/nf:quick Fix Alloy/TLA+ syntax error in {model_file}: {error_detail}` |
| **Scope error** | Summary contains "scope", "sig" | `/nf:quick Fix scope declaration in {model_file}: {error_detail}` |
| **Conformance divergence** | check_id contains "conformance" | `/nf:quick Fix conformance trace divergences in {model_file}: {error_detail}` |
| **Invariant violation** | `invariant_violation` | `/nf:quick Fix formal verification counterexample in {check_id}: {summary}` |
| **Missing tool** | "not found", "not installed" in summary | Log as infrastructure gap, skip |
| **Inconclusive** | result = "inconclusive" | Skip -- not a failure |

3. Update the dispatch ordering text to note that deadlock/sany_semantic/fairness_gap are auto-fixed first (no LLM dispatch needed), then syntax/scope errors via /nf:quick, then conformance/verification failures last.

4. Keep all existing text after the dispatch section unchanged (the Root-Cause Attribution, Trace Corpus Context paragraphs at lines 431-445).

**Part B: Add optional failure_class to write-check-result.cjs**

In bin/write-check-result.cjs:

1. After the `requirement_ids` validation block (around line 82), add validation for optional `failure_class`:
```javascript
// failure_class: optional TLC failure classification
if (entry.failure_class !== undefined) {
  const VALID_FAILURE_CLASSES = ['deadlock', 'sany_semantic', 'fairness_gap', 'invariant_violation', 'syntax_error', 'unknown'];
  if (!VALID_FAILURE_CLASSES.includes(entry.failure_class)) {
    throw new Error('[write-check-result] failure_class must be one of: ' + VALID_FAILURE_CLASSES.join(', ') + ' (got: ' + entry.failure_class + ')');
  }
}
```

2. In the `record` object construction (around line 84-97), add `failure_class` conditionally:
```javascript
if (entry.failure_class !== undefined) {
  record.failure_class = entry.failure_class;
}
```

This is non-breaking: existing callers that do not pass failure_class continue to work unchanged. The field only appears in the NDJSON output when explicitly set.

Do NOT import FAILURE_CLASSES from classify-tlc-failure.cjs -- keep the validation list inline to avoid circular dependency risk and keep write-check-result.cjs self-contained.
  </action>
  <verify>
1. `grep 'classifyTlcFailure' commands/nf/solve-remediate.md` confirms classifier is referenced in dispatch
2. `grep 'Done.*stuttering' commands/nf/solve-remediate.md` confirms deadlock auto-fix template
3. `grep 'WF_vars' commands/nf/solve-remediate.md` confirms fairness gap auto-fix template
4. `grep 'multiply-defined' commands/nf/solve-remediate.md` confirms SANY semantic auto-fix template
5. `grep 'failure_class' bin/write-check-result.cjs` confirms the optional field was added
6. Run existing write-check-result tests to confirm non-breaking: `node --test bin/write-check-result.test.cjs 2>/dev/null || echo "no existing tests"` (if tests exist, they must pass)
7. `node --test bin/write-check-result.test.cjs` passes (confirms write-check-result.cjs loads without require errors)
  </verify>
  <done>
solve-remediate.md F->C section dispatches deadlock/sany_semantic/fairness_gap to targeted auto-fix templates with specific instructions (Done stuttering step, variable rename, WF_vars addition). Invariant violations still route to generic /nf:quick. write-check-result.cjs accepts optional failure_class field without breaking any existing callers.
  </done>
</task>

</tasks>

<verification>
- `node --test bin/classify-tlc-failure.test.cjs` passes all tests (10+ cases covering 6 classes)
- solve-remediate.md F->C section references bin/classify-tlc-failure.cjs for classification
- Three targeted auto-fix templates present: deadlock (Done stuttering), sany_semantic (rename), fairness_gap (WF_vars)
- write-check-result.cjs failure_class field is optional and non-breaking
- No circular dependencies between classify-tlc-failure.cjs and write-check-result.cjs
</verification>

<success_criteria>
- Classifier correctly identifies all 6 TLC failure classes with pattern matching
- F->C remediation dispatches 3 common failures to deterministic fix templates
- Remaining failure types (invariant_violation, syntax_error) continue routing to /nf:quick
- Check result schema extended non-breakingly with optional failure_class
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/336-implement-3-targeted-tla-failure-classif/336-SUMMARY.md`
</output>
