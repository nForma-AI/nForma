# `qgsd:quorum-test` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `/qgsd:quorum-test` command — runs the test suite, assembles a full execution bundle, dispatches parallel quorum workers, and renders a clean verdict table.

**Architecture:** Three-phase command: (1) execute tests and capture full bundle, (2) dispatch 4 parallel Task workers each receiving identical bundle + adversarial prompt, (3) collect verdicts and render a table. No raw model output shown to user. Immediate BLOCK if tests crash without invoking quorum.

**Tech Stack:** Node.js `--test` runner, Claude Code slash commands (`.md` frontmatter), Task subagents, existing `commands/qgsd/` pattern, agent frontmatter pattern from `agents/gsd-*.md`.

**Design doc:** `docs/plans/2026-02-21-quorum-test-design.md`

---

### Task 1: Fix `npm test` to run all test files

`npm test` currently references a non-existent path. Fix it to run all three test files.

**Files:**
- Modify: `package.json` (`"test"` script)

**Step 1: Verify current breakage**

```bash
npm test
```
Expected: `Could not find 'get-shit-done/bin/gsd-tools.test.js'`

**Step 2: Check what test files exist**

```bash
find . -name "*.test.js" -o -name "*.test.cjs" | grep -v node_modules | grep -v .git
```
Expected output:
```
./hooks/config-loader.test.js
./hooks/qgsd-stop.test.js
./get-shit-done/bin/gsd-tools.test.cjs
```

**Step 3: Update the test script**

In `package.json`, change:
```json
"test": "node --test get-shit-done/bin/gsd-tools.test.js"
```
to:
```json
"test": "node --test hooks/qgsd-stop.test.js hooks/config-loader.test.js get-shit-done/bin/gsd-tools.test.cjs"
```

**Step 4: Run to verify it passes**

```bash
npm test
```
Expected: all tests pass, `ℹ pass 29` or more, `ℹ fail 0`.

**Step 5: Commit**

```bash
git add package.json
git commit -m "fix(test): update npm test script to run all three test files"
```

---

### Task 2: Create the quorum evaluation worker agent

This agent receives the execution bundle and returns a structured verdict. Each quorum worker is an instance of this agent loaded with a different MCP model call.

**Files:**
- Create: `agents/qgsd-quorum-test-worker.md`

**Step 1: Create the agent file**

```markdown
---
name: qgsd-quorum-test-worker
description: Evaluates a test execution bundle for genuineness and quality. Receives full stdout, stderr, test source, and exit metadata. Returns structured PASS/BLOCK/REVIEW-NEEDED verdict.
tools: Read
color: cyan
---

<role>
You are a skeptical test reviewer. You receive a test execution bundle — the raw output of running a test suite plus the full source of every test file — and you answer two questions:

1. Do these tests **genuinely pass**? Look for: exceptions swallowed in catch blocks, assertions that always evaluate true, mocked internals that bypass real code paths, environment assumptions baked in.

2. Are these **real tests**? Look for: `assert(true)`, trivial identity checks (`assert.equal(x, x)`), tests that only verify mock return values without exercising logic, single happy-path tests where the feature has obvious failure modes.

**Your job is NOT to confirm the pass. It is to challenge it.**

Ignore the exit code and the ✔ symbols. Read the assertion code. Ask: if someone changed the implementation in a meaningful way, would this test catch it?
</role>

<output_format>
Return ONLY this structure — no prose, no explanation, no markdown headers:

verdict: PASS | BLOCK | REVIEW-NEEDED
concerns:
  - <one-line concern> (or leave empty if none)
  - <one-line concern>

Rules:
- PASS: no concerns — tests are genuine and the pass is trustworthy
- BLOCK: at least one test is provably trivial or a false positive
- REVIEW-NEEDED: tests are real but have gaps or assumptions worth flagging
</output_format>

<bundle>
$BUNDLE
</bundle>
```

**Step 2: Verify file is valid markdown with correct frontmatter**

```bash
head -10 agents/qgsd-quorum-test-worker.md
```
Expected: `---` then `name: qgsd-quorum-test-worker` then `description:` etc.

**Step 3: Commit**

```bash
git add agents/qgsd-quorum-test-worker.md
git commit -m "feat(agents): add qgsd-quorum-test-worker agent for parallel quorum evaluation"
```

---

### Task 3: Create the `quorum-test` command

The main command file. Orchestrates all three phases.

**Files:**
- Create: `commands/qgsd/quorum-test.md`

**Step 1: Create the command file**

```markdown
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
  - <one-line concern, or nothing if none>

Your job is NOT to confirm the pass. Read the assertion code and ask: if someone changed the implementation in a meaningful way, would this test catch it? Look for swallowed exceptions, trivially true assertions, mocked internals that bypass real logic.
```

Dispatch:
- `Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli__gemini with: [worker prompt]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__opencode__opencode with: [worker prompt]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__copilot-cli__ask with: [worker prompt]")`
- `Task(subagent_type="general-purpose", prompt="Call mcp__codex-cli__review with: [worker prompt]")`

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
```

**Step 2: Verify file exists with correct frontmatter**

```bash
head -12 commands/qgsd/quorum-test.md
```
Expected: frontmatter with `name: qgsd:quorum-test`, `allowed-tools` list, `argument-hint`.

**Step 3: Commit**

```bash
git add commands/qgsd/quorum-test.md
git commit -m "feat(commands): add qgsd:quorum-test command — parallel quorum workers evaluate test quality"
```

---

### Task 4: Smoke-test the command structure

No unit test for `.md` prompt files — validate structure and cross-references instead.

**Files:**
- No new files — validation only

**Step 1: Verify all referenced paths exist**

```bash
# Command file exists
ls commands/qgsd/quorum-test.md

# Worker agent exists
ls agents/qgsd-quorum-test-worker.md

# npm test now runs all files
npm test 2>&1 | tail -5
```
Expected: all files exist, `ℹ fail 0`.

**Step 2: Verify command appears in help listing**

```bash
grep -l "quorum-test" commands/qgsd/
```
Expected: `quorum-test.md`

**Step 3: Check command is valid markdown with YAML frontmatter**

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('commands/qgsd/quorum-test.md', 'utf8');
console.assert(content.startsWith('---'), 'missing frontmatter');
console.assert(content.includes('name: qgsd:quorum-test'), 'wrong name');
console.assert(content.includes('allowed-tools:'), 'missing tools');
console.assert(content.includes('Task'), 'missing Task tool');
console.log('command structure OK');
"
```
Expected: `command structure OK`

**Step 4: Commit validation note**

No commit needed — validation only. Move to done.

---

## Execution order

Tasks are sequential — each builds on the previous:

1. Fix npm test (unblocks reliable test running)
2. Create worker agent (dependency for command)
3. Create command (depends on worker agent pattern)
4. Smoke-test (validates all pieces together)
