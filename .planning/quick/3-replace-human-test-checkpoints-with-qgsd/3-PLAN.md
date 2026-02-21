---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/02-config-mcp-detection/02-04-PLAN.md
  - .planning/phases/01-hook-enforcement/01-05-PLAN.md
  - commands/qgsd/debug.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Existing human-verify checkpoints that verify test execution reference /qgsd:quorum-test in their how-to-verify steps"
    - "A /qgsd:debug command file exists at commands/qgsd/debug.md that replaces the existing gsd:debug command"
    - "The /qgsd:debug command dispatches the failure context to 4 parallel quorum workers asking for root cause + next step"
    - "The /qgsd:debug command renders a NEXT STEP recommendation table and saves an artifact"
    - "The debug command can be called repeatedly in a loop: fail → /qgsd:debug → apply step → run again"
  artifacts:
    - path: "commands/qgsd/debug.md"
      provides: "qgsd:debug command — quorum-augmented debug loop"
      contains: "mcp__gemini-cli__gemini"
    - path: ".planning/phases/02-config-mcp-detection/02-04-PLAN.md"
      provides: "Updated task 3 how-to-verify referencing /qgsd:quorum-test for test checks"
      contains: "/qgsd:quorum-test"
    - path: ".planning/phases/01-hook-enforcement/01-05-PLAN.md"
      provides: "Task 2 live integration checkpoint — note added for test verification"
      contains: "/qgsd:quorum-test"
  key_links:
    - from: "commands/qgsd/debug.md"
      to: "mcp__gemini-cli__gemini, mcp__opencode__opencode, mcp__copilot-cli__ask, mcp__codex-cli__review"
      via: "parallel Task workers — same pattern as quorum-test.md"
      pattern: "Task.*subagent_type.*general-purpose"
    - from: "commands/qgsd/debug.md"
      to: ".planning/quick/quorum-debug-latest.md"
      via: "Write artifact after consensus"
      pattern: "quorum-debug-latest"
---

<objective>
Replace human-run test checkpoints in existing phase plans with references to `/qgsd:quorum-test`, and create a new `/qgsd:debug` command that wraps the same 4-model quorum layer around the debug loop.

Purpose: Extend quorum coverage from planning (already enforced) and test verification (quorum-test) to debugging (quorum-debug), making every quality gate structurally multi-model.
Output: Updated plan files + new commands/qgsd/debug.md.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/quorum-test.md
@agents/gsd-debugger.md
@commands/qgsd/debug.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update human test checkpoints to reference /qgsd:quorum-test</name>
  <files>
    .planning/phases/02-config-mcp-detection/02-04-PLAN.md
    .planning/phases/01-hook-enforcement/01-05-PLAN.md
  </files>
  <action>
Find every `checkpoint:human-verify` task in the two completed phase plans that asks the human to manually run `node --test` or observe test output. Add a reference to `/qgsd:quorum-test` so that going forward these steps are automated through quorum.

**02-04-PLAN.md — Task 3 "Human verify — Phase 2 end-to-end":**
In the `<how-to-verify>` block, Check 1 and Check 2 currently say "Expected: all tests pass, no failures." Prepend a note before each of those checks:

Before Check 1 add:
```
**Automated via /qgsd:quorum-test:**
Run: /qgsd:quorum-test hooks/config-loader.test.js
Expected: CONSENSUS PASS from all 4 quorum workers.
(Manual fallback: node --test hooks/config-loader.test.js)
```

Before Check 2 add:
```
**Automated via /qgsd:quorum-test:**
Run: /qgsd:quorum-test hooks/qgsd-stop.test.js
Expected: CONSENSUS PASS from all 4 quorum workers.
(Manual fallback: node --test hooks/qgsd-stop.test.js)
```

Checks 3-6 (manual config + MCP detection + live session) are not test-runner checks — do NOT modify them.

**01-05-PLAN.md — Task 2 "Live integration verification":**
This is a genuine live-session verification (not a test-runner check) — Tests A/B/C/D require a running Claude Code session and cannot be replaced by quorum-test. However, if any future iteration adds unit tests for hook behavior, those can be verified with /qgsd:quorum-test.

Add a single comment line at the top of `<how-to-verify>` after the first sentence:
```
<!-- Unit test coverage for hook logic: use /qgsd:quorum-test hooks/qgsd-stop.test.js — this checkpoint verifies live session behavior only -->
```

Do not change any of the Tests A/B/C/D or the resume-signal.
  </action>
  <verify>
    grep -n "qgsd:quorum-test" .planning/phases/02-config-mcp-detection/02-04-PLAN.md
    # Expected: at least 2 matches (one per test file)

    grep -n "qgsd:quorum-test" .planning/phases/01-hook-enforcement/01-05-PLAN.md
    # Expected: 1 match (the comment line)
  </verify>
  <done>
    Both plan files mention /qgsd:quorum-test. The 02-04 plan's Check 1 and Check 2 now direct the human to run /qgsd:quorum-test first before the manual fallback. The 01-05 plan's live-session checkpoint is annotated with where quorum-test applies.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create /qgsd:debug command</name>
  <files>commands/qgsd/debug.md</files>
  <action>
IMPORTANT: The existing `commands/qgsd/debug.md` is the `gsd:debug` command (name: gsd:debug). This task OVERWRITES that file with the new `qgsd:debug` command that wraps the quorum layer around debugging. The underlying `agents/gsd-debugger.md` agent is NOT changed.

Create `commands/qgsd/debug.md` with the following content (write exactly):

```markdown
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

This command augments the existing gsd-debugger investigation loop with quorum consensus on direction — before the debugger spends context on a path, quorum votes on which path is most likely correct.

**Relationship to gsd:debug:**
- `/gsd:debug` spawns the gsd-debugger agent for autonomous multi-step investigation.
- `/qgsd:debug` is a quorum consultation step for a *specific failure snapshot*. Use it when: tests fail and you want a second opinion before diving in, you are stuck after 1-2 debugger passes, or you want quorum to triage a new bug before spawning the full debugger.
</objective>

<process>

**Step 1: Collect failure context**

If `$ARGUMENTS` is non-empty, use it as the initial failure description.

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

**Step 2: Read relevant source files**

Identify the files most likely implicated from `$ARGUMENTS` and/or `$TEST_OUTPUT`:
- Search for file paths mentioned in error traces
- Read those files (up to 3 most relevant) to include in bundle

Store as `$SOURCE_CONTEXT` — one block per file with filename header:
```
=== hooks/qgsd-stop.js ===
<relevant excerpt or full file if small>
```

If no files can be identified from the failure context, set `$SOURCE_CONTEXT` to "(no source files identified from failure context)".

**Step 3: Assemble bundle**

Compose `$BUNDLE`:

```
FAILURE CONTEXT: $ARGUMENTS

EXIT CODE: $EXIT_CODE (or "N/A — symptom only" if no test run)

=== TEST OUTPUT ===
$TEST_OUTPUT (or "N/A" if not a test failure)

=== SOURCE CONTEXT ===
$SOURCE_CONTEXT
```

**Step 4: Dispatch parallel quorum workers**

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
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli__gemini with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode__opencode with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-cli__ask with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli__review with the following prompt. Pass the full literal text of the bundle inline — do not summarize or truncate: [full worker prompt with $BUNDLE inlined verbatim]")`

**Step 5: Collect responses and determine consensus next step**

Parse each worker response for `root_cause:`, `next_step:`, `confidence:` lines.
If a worker errored or returned unparseable output, mark as `UNAVAIL`.

Determine consensus next step:
- If 3+ workers agree on the same root cause area → consensus root cause
- If 3+ workers recommend the same next step → consensus step
- Otherwise → list all unique recommendations; note lack of consensus

**Step 6: Render NEXT STEP table**

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

**Step 7: Save artifact**

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

**Step 8: Prompt for continuation**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply the consensus next step, then run /qgsd:debug again with updated output.
To start a full autonomous debug session: /gsd:debug [description]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>
```

Write that content verbatim to `commands/qgsd/debug.md`, replacing the existing `gsd:debug` content entirely.
  </action>
  <verify>
    grep "name: qgsd:debug" commands/qgsd/debug.md
    # Expected: matches

    grep "mcp__gemini-cli__gemini" commands/qgsd/debug.md
    # Expected: matches

    grep "quorum-debug-latest" commands/qgsd/debug.md
    # Expected: matches

    grep "mcp__codex-cli__review" commands/qgsd/debug.md
    grep "mcp__opencode__opencode" commands/qgsd/debug.md
    grep "mcp__copilot-cli__ask" commands/qgsd/debug.md
    # Expected: all match
  </verify>
  <done>
    commands/qgsd/debug.md is the new /qgsd:debug command. Name is qgsd:debug (not gsd:debug). Contains all 4 parallel worker dispatches, a NEXT STEP table renderer, artifact save to .planning/quick/quorum-debug-latest.md, and a loop continuation prompt.
  </done>
</task>

</tasks>

<verification>
After both tasks:
```bash
grep -c "qgsd:quorum-test" .planning/phases/02-config-mcp-detection/02-04-PLAN.md
# Expected: 2 (Check 1 and Check 2)

grep "qgsd:quorum-test" .planning/phases/01-hook-enforcement/01-05-PLAN.md
# Expected: 1 match (comment annotation)

grep "name: qgsd:debug" commands/qgsd/debug.md
# Expected: 1 match

grep -c "mcp__" commands/qgsd/debug.md
# Expected: 4 matches (gemini, opencode, copilot, codex)
```
</verification>

<success_criteria>
- Existing phase plan checkpoints that ran node --test now direct to /qgsd:quorum-test first
- Live-session integration checkpoint (01-05) is annotated — not changed, since it verifies hook firing in a real Claude Code session, not test output
- commands/qgsd/debug.md is /qgsd:debug (not gsd:debug) with 4-model parallel quorum dispatch
- Debug workers ask for root cause + next step (not a fix)
- Artifact saved to .planning/quick/quorum-debug-latest.md
- Loop continuation prompt shown after every run
</success_criteria>

<output>
After completion, create `.planning/quick/3-replace-human-test-checkpoints-with-qgsd/3-SUMMARY.md`
</output>
