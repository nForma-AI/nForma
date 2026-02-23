---
name: qgsd:debug
description: Debug loop with quorum consensus on next step. Feed failure context to 4 quorum workers — each identifies the single most likely root cause and next debugging step. Renders a NEXT STEP table. Call repeatedly: run test → fail → /qgsd:debug → apply step → run test again.
argument-hint: "[failure context: test output, error trace, or symptom description]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
---

<objective>
Take a failure context (test output, error trace, stack trace, or symptom description) and dispatch it to 4 parallel quorum workers. Each worker independently identifies the single most likely root cause and the single best next debugging step. Render a clean NEXT STEP recommendation table.

This command augments the existing qgsd-debugger investigation loop with quorum consensus on direction — before the debugger spends context on a path, quorum votes on which path is most likely correct.

**Relationship to gsd:debug:**
- `/qgsd:debug` spawns the qgsd-debugger agent for autonomous multi-step investigation.
- `/qgsd:debug` is a quorum consultation step for a *specific failure snapshot*. Use it when: tests fail and you want a second opinion before diving in, you are stuck after 1-2 debugger passes, or you want quorum to triage a new bug before spawning the full debugger.
</objective>

<process>

**Step 1: Collect failure context**

If $ARGUMENTS is non-empty, use it as the initial failure description.

Gather the execution bundle:

```bash
# Capture recent test output if available
find . \( -name "*.test.js" -o -name "*.test.cjs" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*"
```

Store discovered test files as `$TEST_FILES`.

If test files exist, run them to capture fresh output:
```bash
node --test $TEST_FILES 2>&1
echo "EXIT:$?"
```
Store as `$TEST_OUTPUT`. Extract exit code.

If exit code is 0 (all tests pass), stop and display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-DEBUG: No failure detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tests pass (exit code: 0). Nothing to debug.
If you have a symptom not captured by tests, run:
  /qgsd:debug [describe the symptom]
```

**Step 2: Assemble bundle**

Compose `$BUNDLE`:

```
FAILURE CONTEXT: $ARGUMENTS

EXIT CODE: $EXIT_CODE (or "N/A — symptom only" if no test run)

=== TEST OUTPUT ===
$TEST_OUTPUT (or "N/A" if not a test failure)
```

Workers have full repo access and will read whatever source files they need independently.

**Step 3: Dispatch parallel quorum workers**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-DEBUG: Dispatching workers...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Worker prompt template:
```
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
```

Dispatch all four workers as parallel Task calls (Task subagents are isolated — a failing Task does not propagate to sibling Tasks):
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli-1__gemini with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode-1__opencode with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-1__ask with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli-1__review with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`

**Step 4: Collect responses and determine consensus next step**

Parse each worker response for `root_cause:`, `next_step:`, `confidence:` lines.
If a worker errored or returned unparseable output, mark as `UNAVAIL`.

Determine consensus next step:
- If 3+ workers agree on the same root cause area → consensus root cause
- If 3+ workers recommend the same next step → consensus step
- Otherwise → list all unique recommendations; note lack of consensus

**Step 5: Render NEXT STEP table**

Display:

```
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
```

If models give different next steps, list them all below the table with their root cause hypotheses.

**Step 6: Save artifact**

Write `.planning/quick/quorum-debug-latest.md`:

```markdown
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
```

**Step 7: Execute or escalate**

IF consensus was reached (Step 4):
  Execute the consensus next step autonomously using available tools (Bash, Read, Grep, etc.)
  Display what was done.
  Then display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Consensus step executed. Run /qgsd:debug again to continue.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```

IF no consensus:
  Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  No consensus — review recommendations above and apply the most relevant step.
  Then run /qgsd:debug again with updated output.
  To start a full autonomous debug session: /qgsd:debug [description]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```

</process>
