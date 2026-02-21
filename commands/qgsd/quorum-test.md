---
name: qgsd:quorum-test
description: Run the test suite and submit the full execution bundle to quorum workers for independent quality review. Parallel workers evaluate whether tests genuinely pass and whether assertions are meaningful.
argument-hint: "[path/to/test.file.js]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
---

<objective>
Run the project test suite, assemble a full execution bundle, and dispatch parallel quorum workers to independently evaluate whether the tests genuinely pass and whether they are real tests.

This command extends QGSD quorum from *planning* (consensus on direction) to *verification* (consensus on test quality).
</objective>

<process>

**Step 1: Parse target**

If `$ARGUMENTS` is non-empty, use it as the test file path.
If `$ARGUMENTS` is empty, discover test files:

```bash
find . \( -name "*.test.js" -o -name "*.test.cjs" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*"
```

Store the list as `$TEST_FILES`. If no files found, stop: "No test files found."

**Step 2: Capture execution bundle**

```bash
node --version
```
Store as `$NODE_VERSION`.

```bash
node --test $TEST_FILES 2>&1
echo "EXIT:$?"
```
Store full output as `$TEST_OUTPUT`. Extract exit code from the `EXIT:N` line at the end.

Read the full source of every file in `$TEST_FILES`. Store as `$TEST_SOURCES` — a combined block with filename headers:

```
=== hooks/qgsd-stop.test.js ===
<full source>

=== hooks/config-loader.test.js ===
<full source>
```

**Step 3: Immediate BLOCK if exit code ≠ 0**

If exit code is non-zero, stop immediately and display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: BLOCK (test infrastructure failure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tests did not run cleanly (exit code: N).
Fix the infrastructure failure before requesting quorum review.

<relevant excerpt from $TEST_OUTPUT>
```

Do NOT invoke quorum workers. Stop here.

**Step 4: Assemble bundle**

Compose `$BUNDLE`:

```
NODE VERSION: $NODE_VERSION
TEST FILES: $TEST_FILES
EXIT CODE: 0

=== TEST OUTPUT ===
$TEST_OUTPUT

=== TEST SOURCES ===
$TEST_SOURCES
```

**Step 5: Dispatch parallel quorum workers**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: Dispatching workers...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Dispatch all four workers in a **single message** (parallel Task calls):

Worker prompt template for each:
```
You are a skeptical test reviewer for the QGSD project.

<bundle>
$BUNDLE
</bundle>

Evaluate this test execution bundle.
Return ONLY:

verdict: PASS | BLOCK | REVIEW-NEEDED
concerns:
  - <most-impactful concern first, or "none" if no concerns>
  - <second concern if applicable, or "none" if only one concern>

Your job is NOT to confirm the pass. Read the assertion code and ask: if someone changed the implementation in a meaningful way, would this test catch it? Look for swallowed exceptions, trivially true assertions, mocked internals that bypass real logic.
```

Dispatch:
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli__gemini with: [worker prompt with $BUNDLE substituted]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode__opencode with: [worker prompt with $BUNDLE substituted]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-cli__ask with: [worker prompt with $BUNDLE substituted]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli__review with: [worker prompt with $BUNDLE substituted]")`

Each subagent is responsible for calling its model and returning the structured verdict.

**Step 6: Collect verdicts and render table**

Parse each worker response for `verdict:` and `concerns:` lines.

If a worker errored or returned unparseable output, mark as `UNAVAIL`.

Determine consensus:
- All available models PASS → consensus `PASS`
- Any available model BLOCK → consensus `BLOCK`
- Mixed PASS/REVIEW → consensus `REVIEW-NEEDED`
- All UNAVAIL → stop: "All quorum models unavailable — cannot evaluate."

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────┬──────────────────┬─────────────────────────────────────┐
│ Model        │ Verdict          │ Concerns                            │
├──────────────┼──────────────────┼─────────────────────────────────────┤
│ Gemini       │ [verdict]        │ [first concern or —]                │
│ OpenCode     │ [verdict]        │ [first concern or —]                │
│ Copilot      │ [verdict]        │ [first concern or —]                │
│ Codex        │ [verdict]        │ [first concern or —]                │
├──────────────┼──────────────────┼─────────────────────────────────────┤
│ CONSENSUS    │ [consensus]      │ [N PASS, N BLOCK, N UNAVAIL]        │
└──────────────┴──────────────────┴─────────────────────────────────────┘
```

If any model has multiple concerns, list them below the table.

**Step 7: Save artifact**

Write `.planning/quick/quorum-test-latest.md`:

```markdown
# quorum-test artifact
date: [ISO timestamp]
files: $TEST_FILES
exit_code: 0

## verdict
[consensus verdict]

## worker verdicts
[table as text]

## execution bundle
[full $BUNDLE]
```

</process>
