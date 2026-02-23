---
phase: quick-69
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/fix-tests.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "The top-level fix-tests agent never reads test or source files inline — all file reads happen inside sub-agents"
    - "Batch categorization (Step 6d) is delegated to a Task sub-agent that returns a JSON verdict array"
    - "Real-bug quorum investigation (Step 6h.1) is delegated to a Task sub-agent that returns the consensus hypothesis"
    - "The top-level agent only handles state management, CLI tool invocations, and sub-agent orchestration"
    - "After editing the source, the installed copy at ~/.claude/qgsd/ is synchronized via node bin/install.js"
  artifacts:
    - path: "get-shit-done/workflows/fix-tests.md"
      provides: "Updated fix-tests workflow with sub-agent delegation for categorization and real-bug investigation"
      contains: "Task(categorize"
  key_links:
    - from: "fix-tests.md Step 6d"
      to: "categorization sub-agent"
      via: "Task() call returning JSON verdict array"
      pattern: "Task.*categorize"
    - from: "fix-tests.md Step 6h.1"
      to: "real-bug investigation sub-agent"
      via: "Task() call returning consensus hypothesis"
      pattern: "Task.*real.bug"
---

<objective>
Refactor fix-tests.md so that the top-level orchestrator agent offloads context-heavy work to sub-agents via Task() calls. Currently, Step 6d (batch categorization) and Step 6h.1 (real-bug quorum investigation) both run inline in the top-level agent's context window — reading files, reasoning over failure output, and accumulating token usage across every batch in every iteration. For large test suites this exhausts the top-level context long before the loop completes.

Purpose: Preserve the top-level agent's context budget for orchestration. Every file read and AI reasoning step should happen inside a disposable sub-agent that returns only the structured result the orchestrator needs.

Output: Updated get-shit-done/workflows/fix-tests.md with two sections rewritten to use Task() delegation, plus install sync.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@get-shit-done/workflows/fix-tests.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite Step 6d to delegate batch categorization to a sub-agent</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Replace the entire inline "Context assembly for each confirmed failure" block through the end of "Git pickaxe enrichment for adapt failures" in Step 6d with a Task() delegation pattern.

The new Step 6d must:

1. Skip already-classified failures using the same resume-safety check (this remains inline — it is a state read, not a file read).

2. If there are any unclassified confirmed_failures, spawn a SINGLE Task sub-agent for the entire batch's unclassified failures:

```
Task(
  prompt="You are a test failure categorizer. Classify each failing test below into exactly one of 5 categories and return ONLY a JSON array.

## Failures to classify

{for each unclassified failure in confirmed_failures:}
File: {result.file}
Error summary:
{result.error_summary}
---

## Classification rules

| Category | Classify when |
|----------|--------------|
| valid-skip | Test was already skipped/pending in test file source; tests a removed/deprecated feature; checks process.env.CI to skip itself |
| adapt | Failure caused by a real code change that mutated asserted behavior; error_summary shows assertion mismatch clearly traceable to a code change; no environment dependency |
| isolate | Fails only due to environment/ordering dependency; error shows missing env var, port conflict, race condition, or depends on another test's side effects |
| real-bug | Failure reveals a genuine defect requiring developer judgment; stack trace shows panic/crash/wrong logic not explainable by environment or code change |
| fixture | Fails because a fixture file, test data, snapshot, or generated mock is stale/missing/mismatched |

If uncertain: classify as real-bug (conservative).

## Instructions

For each failure:
1. Read the test file: Read({result.file})
2. Extract source file paths from error_summary matching pattern: at .* \\((src|lib|app)/ or File \"(src|lib|app)/
   — take first 2 unique non-node_modules, non-test paths
3. Read each source path (skip if does not exist)
4. Compute context_score: +1 if test file non-empty, +1 if at least 1 source file read, +1 if error_summary non-empty (range 0-3)
5. If context_score < 2: category = \"deferred\", add to low_context list
6. Classify using the rules above
7. For adapt verdicts: extract describe() or primary import identifier (<=60 chars), run:
   git -C $(git rev-parse --show-toplevel 2>/dev/null) log -S\"<identifier>\" --oneline --diff-filter=M -- src/ lib/ app/ 2>/dev/null | head -10
   If empty, run broader: git log -S\"<identifier>\" --oneline -10 2>/dev/null
   Set pickaxe_context = { identifier, commits: [...], command_run: \"...\" }

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    \"file\": \"path/to/test.test.js\",
    \"category\": \"<valid-skip|adapt|isolate|real-bug|fixture|deferred>\",
    \"confidence\": \"high|medium|low\",
    \"context_score\": 0,
    \"reason\": \"one sentence\",
    \"error_type\": \"<assertion_mismatch|import_error|snapshot_mismatch|fixture_missing|env_missing|port_conflict|timeout|unknown>\",
    \"pickaxe_context\": null
  }
]
",
  description="Categorize batch {B+1} failures ({count} tests)"
)
```

3. Parse the returned JSON array as the verdict list. If the Task returns malformed JSON or errors out: treat ALL failures in this batch as deferred (low_context) and continue — never block the loop on a categorization failure.

4. Process verdicts:
   - For each verdict where category == "deferred": add file to state.deferred_tests AND state.deferred_report.low_context
   - For all other verdicts: append to state.categorization_verdicts, append file to matching state.results_by_category array

5. Save state after processing verdicts (same save-state call as before).

The note at the end of 6d ("Note on dispatch: Adapt/fixture/isolate dispatch happens in Step 6h") remains unchanged.

Also remove the "Context assembly for each confirmed failure" sub-section entirely — the sub-agent handles all file reads. Remove the "5-category classification (inline Claude reasoning...)" sub-section — the sub-agent handles reasoning. Remove the "Git pickaxe enrichment for adapt failures (CATG-02)" sub-section — the sub-agent handles pickaxe. The only inline logic that remains in 6d is: the Phase 20 stub detection, the sort of batch results into passed/flaky/confirmed, the resume-safety dedup check, the Task dispatch, the verdict parsing, and the state save.

Keep Step 6d.1 (ddmin enrichment) unchanged — it is already CLI-only and does not accumulate file reads in top-level context.
  </action>
  <verify>
    grep -n "Task(" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md | grep -i categoriz
    grep -n "Context assembly for each confirmed failure" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md && echo "ERROR: inline classification still present" || echo "OK: inline classification removed"
  </verify>
  <done>
    Step 6d no longer contains inline file reads or inline AI classification. It contains a Task() call that receives failure data and returns a JSON verdict array. The old "Context assembly", "5-category classification", and "Git pickaxe enrichment" sub-sections are gone, replaced by the sub-agent dispatch + JSON parse pattern.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite Step 6h.1 to delegate real-bug investigation to a sub-agent</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Replace the inline quorum investigation loop in Step 6h.1 (Steps A through D) with a Task() delegation. The investigation bundle assembly, Claude hypothesis, quorum calls, and consensus synthesis all happen inside the sub-agent — the top-level agent receives only the consensus hypothesis string.

The new Step 6h.1 must:

1. Collect real-bug verdicts for this batch (same dedup check — unchanged).

2. If no real-bug verdicts: skip entirely (unchanged).

3. For each real-bug verdict, process SEQUENTIALLY (one Task at a time):

   a. Spawn investigation Task:
   ```
   Task(
     prompt="You are investigating a real-bug test failure to produce a fix hypothesis.

## Failure details

Test file: {verdict.file}
Classification reason: {verdict.reason}
Error type: {verdict.error_type}
Context score: {verdict.context_score}

Error / failure output:
{verdict.error_summary — full, not truncated}

## Instructions

1. Read the test file: Read({verdict.file})
2. Extract first 100 lines of test content for context
3. Extract docstring/describe context: first describe(), it(), or test() block header plus leading block comment (up to 10 lines)
4. Assemble an investigation bundle from the above

5. State your own fix hypothesis (1-3 sentences: root cause + specific, concrete fix recommendation naming specific functions/variables/code paths visible in the context). This is Round 1 / Claude hypothesis.

6. Query quorum models SEQUENTIALLY to get their hypotheses. Use this prompt template for each model:

   QGSD fix-tests — Real-bug Investigation

   [paste investigation bundle]

   You are reviewing a test failure classified as a real bug. Your task: deliberate on the most likely fix hypothesis.

   Claude's hypothesis: [your hypothesis from step 5]

   Do you agree with Claude's hypothesis, or do you have a different or more specific fix hypothesis? Give:
   - hypothesis: [1-2 sentence specific, actionable fix hypothesis]
   - confidence: high | medium | low
   - reasoning: [1-3 sentences grounded in the failure output and test context]

   Query order (sequential, NEVER parallel):
   1. mcp__codex-cli-1__review
   2. mcp__gemini-cli-1__gemini
   3. mcp__opencode-1__opencode
   4. mcp__copilot-1__ask
   Then any available claude-mcp instances.
   Handle UNAVAILABLE: note and skip.

7. Synthesize consensus hypothesis:
   - If majority (>50% of available models) agree on a specific fix direction → use that
   - If split: pick the hypothesis with the most concrete, evidence-grounded reasoning
   - If only you responded: your hypothesis IS the consensus

8. Return ONLY a single JSON object (no markdown, no explanation):
{
  \"consensus_hypothesis\": \"<one paragraph specific actionable fix hypothesis>\",
  \"model_count\": <number of models that responded>,
  \"confidence\": \"high|medium|low\"
}
",
     description="Investigate real-bug: {verdict.file}"
   )
   ```

   b. Parse the returned JSON. Extract `consensus_hypothesis`. If malformed or Task errors: use fallback `"Quorum investigation failed — review {verdict.file} manually: {verdict.reason}"` as the consensus.

   c. Store `$CONSENSUS_HYPOTHESIS` from the returned JSON.

   d. Continue with Steps E and F unchanged (append to deferred_report, save state, build and dispatch /qgsd:quick fix task using the consensus hypothesis).

Remove the inline Steps A through D (investigation bundle assembly, Claude hypothesis, sequential quorum calls, consensus synthesis). These are now entirely inside the investigation sub-agent. Steps E and F (state append + fix task dispatch) remain inline in the top-level orchestrator, since they are state management, not file reads or AI reasoning.

The "WAIT: Do not move to the next real-bug verdict until this Task has returned" instruction moves to apply to the investigation Task, not just the fix dispatch Task — both are sequential.
  </action>
  <verify>
    grep -n "Step A — Assemble investigation context" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md && echo "ERROR: inline investigation still present" || echo "OK: inline investigation removed"
    grep -n "Task(" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md | grep -i "real.bug\|invest"
  </verify>
  <done>
    Step 6h.1 no longer contains inline Steps A-D (file reads, Claude hypothesis, quorum calls, consensus synthesis). It contains a Task() call for investigation that returns a JSON consensus, followed by the unchanged Steps E and F for state management and fix dispatch.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync installed copy</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
After both edits above are confirmed correct, run the install sync to push the updated source to the installed copy at ~/.claude/qgsd/:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

Verify the installed copy matches the source by checking that the Task delegation pattern appears in the installed file:

```bash
grep -c "Task(" ~/.claude/qgsd/workflows/fix-tests.md
```

Should return 4 or more (existing Task calls in 6h + new Task calls in 6d and 6h.1).
  </action>
  <verify>
    node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global && grep -c "Task(" ~/.claude/qgsd/workflows/fix-tests.md
  </verify>
  <done>
    Install completes without errors. ~/.claude/qgsd/workflows/fix-tests.md contains the updated sub-agent delegation pattern. grep -c "Task(" returns >= 4.
  </done>
</task>

</tasks>

<verification>
1. grep -n "Context assembly for each confirmed failure" get-shit-done/workflows/fix-tests.md — should return nothing (removed)
2. grep -n "Step A — Assemble investigation context" get-shit-done/workflows/fix-tests.md — should return nothing (removed)
3. grep -n "Task(" get-shit-done/workflows/fix-tests.md — should show Task calls in 6d, 6h, 6h.1
4. node bin/install.js --claude --global — exits 0
5. grep -c "Task(" ~/.claude/qgsd/workflows/fix-tests.md — returns >= 4
</verification>

<success_criteria>
- The top-level fix-tests orchestrator no longer reads test files or source files inline
- Step 6d dispatches a Task sub-agent for categorization and receives back a JSON verdict array
- Step 6h.1 dispatches a Task sub-agent for real-bug investigation and receives back a JSON consensus hypothesis
- Steps E and F of 6h.1 (state management and fix dispatch) remain in the top-level orchestrator
- The installed copy at ~/.claude/qgsd/workflows/fix-tests.md is synchronized
- All existing behavior (ddmin, pickaxe, dispatch, resume safety, state management) is preserved — only the execution location changes from inline to sub-agent
</success_criteria>

<output>
After completion, create .planning/quick/69-qgsd-fix-tests-must-use-more-sub-agents-/69-SUMMARY.md
</output>
