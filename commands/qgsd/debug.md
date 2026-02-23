---
name: qgsd:debug
description: Debug loop with quorum consensus on next step. Feed failure context to 4 quorum workers — each identifies the single most likely root cause and next debugging step. Renders a NEXT STEP table. Call repeatedly: run test → fail → /qgsd:debug → apply step → run test again.
argument-hint: "[failure context: test output, error trace, or symptom description]"
allowed-tools:
  - Task
---

<objective>
Dispatch the full quorum debug process to a subagent. The main command stays clean — only the dispatch header and the final NEXT STEP table surface to the conversation context. All bundle assembly, quorum worker dispatch, result collection, artifact writing, and execution happen inside the subagent.
</objective>

<process>

**Step 1: Show dispatch header**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-DEBUG: Dispatching debug subagent...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Step 2: Spawn the quorum debug subagent**

Spawn ONE Task with the full failure context and process instructions embedded:

```
Task(
  subagent_type="general-purpose",
  description="Quorum debug orchestration",
  prompt="""
You are the QGSD quorum debug orchestrator. Run the full process below for this failure.

ARGUMENTS: $ARGUMENTS

---

## PROCESS

### Step A: Collect failure context

If ARGUMENTS is non-empty, use it as the initial failure description.

Discover test files:
  find . ( -name "*.test.js" -o -name "*.test.cjs" ) -not -path "*/node_modules/*" -not -path "*/.git/*"

If test files exist, run them:
  node --test $TEST_FILES 2>&1; echo "EXIT:$?"

Store as $TEST_OUTPUT and $EXIT_CODE. If exit code is 0 and ARGUMENTS is empty, stop and return:

  QUORUM-DEBUG: No failure detected — tests pass (exit 0).
  If you have a symptom not captured by tests, run: /qgsd:debug [describe the symptom]

### Step B: Assemble bundle

Compose $BUNDLE:
  FAILURE CONTEXT: $ARGUMENTS
  EXIT CODE: $EXIT_CODE (or "N/A — symptom only" if no test run)
  === TEST OUTPUT ===
  $TEST_OUTPUT (or "N/A" if not a test failure)

### Step C: Dispatch 4 parallel quorum workers

Worker prompt template (inline $BUNDLE verbatim in each):

  You are a debugging advisor for the QGSD project.

  <bundle>
  $BUNDLE
  </bundle>

  Given this failure, answer ONLY:

  root_cause: <the single most likely root cause in one sentence>
  next_step: <the single best next debugging action — be specific: what file to check, what to log, what to run>
  confidence: HIGH | MEDIUM | LOW

  Rules:
  - Do NOT suggest a fix. Suggest the next investigative step only.
  - Be specific: name the file, function, line range, or command to run.
  - If the bundle lacks enough context to diagnose, say so in root_cause and set confidence: LOW.

Dispatch all 4 workers as parallel Task calls:
- Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli__gemini with: [worker prompt with $BUNDLE inlined verbatim]")
- Task(subagent_type="general-purpose", prompt="Call mcp__opencode__opencode with: [worker prompt with $BUNDLE inlined verbatim]")
- Task(subagent_type="general-purpose", prompt="Call mcp__copilot-cli__ask with: [worker prompt with $BUNDLE inlined verbatim]")
- Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli__codex with: [worker prompt with $BUNDLE inlined verbatim]")

### Step D: Collect and parse responses

Parse each worker response for root_cause:, next_step:, confidence: lines.
If a worker errored or returned unparseable output, mark as UNAVAIL.

Consensus rules:
- 3+ workers agree on same root cause area → consensus root cause
- 3+ workers recommend same next step → consensus step
- Otherwise → list all unique recommendations; note lack of consensus

### Step E: Render NEXT STEP table

Return this output:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-DEBUG RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────┬──────────────┬─────────────────────────────────────────────┐
│ Model        │ Confidence   │ Next Step                                   │
├──────────────┼──────────────┼─────────────────────────────────────────────┤
│ Gemini       │ [confidence] │ [next_step]                                 │
│ OpenCode     │ [confidence] │ [next_step]                                 │
│ Copilot      │ [confidence] │ [next_step]                                 │
│ Codex        │ [confidence] │ [next_step]                                 │
├──────────────┼──────────────┼─────────────────────────────────────────────┤
│ CONSENSUS    │ [HIGH/MED/—] │ [consensus step or "No consensus — see above"]│
└──────────────┴──────────────┴─────────────────────────────────────────────┘

Root Cause Hypothesis (consensus): [one-sentence summary or "No consensus"]

If models give different next steps, list them all below the table with their root cause hypotheses.

### Step F: Save artifact

Write .planning/quick/quorum-debug-latest.md:

  # quorum-debug artifact
  date: [ISO timestamp]
  failure_context: $ARGUMENTS
  exit_code: $EXIT_CODE

  ## consensus
  root_cause: [consensus root cause or "no consensus"]
  next_step: [consensus next step or "no consensus"]

  ## worker responses
  [table as text]

  ## bundle
  [full $BUNDLE]

### Step G: Execute or escalate

IF consensus was reached:
  Execute the consensus next step using available tools (Bash, Read, Grep, etc.)
  Report what was done.
  Then return:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Consensus step executed. Run /qgsd:debug again to continue.
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IF no consensus:
  Return:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    No consensus — review recommendations above and apply the most relevant step.
    Then run /qgsd:debug again with updated output.
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
)
```

**Step 3: Report result**

Return the subagent's NEXT STEP table and conclusion to the user.

</process>
