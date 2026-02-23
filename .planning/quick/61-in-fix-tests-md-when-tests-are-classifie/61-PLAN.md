---
phase: quick-61
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
    - "real-bug classified tests are NOT silently deferred — each one gets a quorum investigation and a dispatched /qgsd:quick fix task"
    - "The quorum investigation receives: test file content, error_summary (failure output), and extracted docstring/describe context"
    - "The quorum consensus produces a single fix hypothesis that becomes the context for the dispatched /qgsd:quick task"
    - "The dispatch pattern for real-bug fix tasks is identical in structure to adapt/fixture dispatch (Task with qgsd-planner subagent_type)"
    - "adapt/fixture/isolate classification dispatch is unchanged — quorum is NOT called for those categories"
    - "The INTG-03 note is updated to reflect that quorum IS called for real-bug investigation (not classification)"
    - "The terminal summary shows real-bug fix tasks as dispatched rather than just deferred"
    - "The installed copy at ~/.claude/qgsd/workflows/fix-tests.md reflects all changes after install sync"
  artifacts:
    - path: "get-shit-done/workflows/fix-tests.md"
      provides: "Updated workflow with real-bug quorum investigation + dispatch in Step 6h"
  key_links:
    - from: "Step 6h real-bug filter"
      to: "quorum investigation + /qgsd:quick dispatch"
      via: "inline quorum Mode A call per verdict, then Task(subagent_type=qgsd-planner)"
      pattern: "real-bug.*quorum"
---

<objective>
Add quorum-driven investigation and automatic fix dispatch for real-bug classified test failures in fix-tests.md.

Purpose: Real-bug failures are currently the only category that gets silently deferred to the terminal report. This wastes the opportunity to apply quorum intelligence — the quorum can deliberate on the most likely fix hypothesis based on the test file, failure output, and docstring context, then dispatch a /qgsd:quick task with that hypothesis as the starting point. Same outcome as adapt/fixture: the failure gets worked on autonomously.

Output: Updated get-shit-done/workflows/fix-tests.md with a new Step 6h.1 block (real-bug quorum investigation), updated INTG-03 note, updated terminal summary, and a second task that runs install sync to propagate the changes to ~/.claude/qgsd/.
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
  <name>Task 1: Add real-bug quorum investigation and dispatch to Step 6h</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Make three targeted edits to `get-shit-done/workflows/fix-tests.md`:

---

**Edit 1 — Replace the real-bug "not actionable" handling in Step 6h.**

Find the current real-bug deferred block in Step 6h:

```
**Filter actionable categories:**
- Actionable: `adapt`, `fixture`, `isolate`
- Not actionable: `real-bug` (→ `state.deferred_report.real_bug`), `deferred` / context_score < 2 (already in `state.deferred_report.low_context`)

For each new verdict with category == "real-bug": append `result.file` to `state.deferred_report.real_bug` (if not already present).
```

Replace just the `real-bug` description line and the "For each new verdict..." sentence with:

```
**Filter actionable categories:**
- Actionable: `adapt`, `fixture`, `isolate`, `real-bug` (via quorum investigation — see Step 6h.1 below)
- Not actionable: `deferred` / context_score < 2 (already in `state.deferred_report.low_context`)
```

Remove the old sentence: `For each new verdict with category == "real-bug": append result.file to state.deferred_report.real_bug (if not already present).`

The real-bug handling moves entirely into the new Step 6h.1 block below.

---

**Edit 2 — Insert new Step 6h.1 block after the existing Step 6h "After 6h, proceed..." line but before the "## Step 6: Clear Activity State" header.**

Insert the following block in full:

```markdown
### 6h.1. Quorum investigation and dispatch for real-bug verdicts

**Purpose:** For each real-bug verdict, run a focused quorum investigation to produce a fix hypothesis, then dispatch a /qgsd:quick fix task with that hypothesis as context.

**Collect real-bug verdicts for this batch:**
Identify all entries in the current batch's new verdicts (same set used in 6h) where `category == "real-bug"` AND the file has not already been recorded in `state.dispatched_tasks[].test_files`.

If no real-bug verdicts in this batch: skip 6h.1 entirely.

**For each real-bug verdict (process one at a time — sequential):**

**Step A — Assemble investigation context:**

1. Re-read the test file (or use already-read content from 6d):
   ```
   Read(verdict.file)
   ```

2. Extract docstring/describe context: scan the test file for the first `describe(`, `it(`, or `test(` block header, plus any leading block comment (`/** ... */` or `# ...`). Extract up to 10 lines. This is `$DOCSTRING_CONTEXT`.

3. Assemble the investigation bundle:
   ```
   INVESTIGATION BUNDLE
   ====================
   Test file: {verdict.file}
   Classification reason: {verdict.reason}
   Error type: {verdict.error_type}
   Context score: {verdict.context_score}

   === Error / failure output ===
   {verdict.error_summary — full, not truncated}

   === Test file context (first 100 lines) ===
   {first 100 lines of test file content}

   === Docstring / describe context ===
   {$DOCSTRING_CONTEXT}
   ```

**Step B — Claude's own fix hypothesis (Round 1):**

Before querying any quorum model, Claude states its own hypothesis:

```
Claude (real-bug investigation): Based on the failure output and test context above, the most likely root cause is [1-3 sentences]. The most actionable fix hypothesis is: [specific, concrete, 1-2 sentence hypothesis about what code to change and why].
```

Store as `$CLAUDE_HYPOTHESIS`.

**Step C — Query quorum models sequentially (Mode A style):**

For each available quorum model, call sequentially (NEVER as sibling calls). Prompt template:

```
QGSD fix-tests — Real-bug Investigation

{$INVESTIGATION_BUNDLE}

You are reviewing a test failure classified as a real bug (not an environment issue, not a stale fixture). Your task: deliberate on the most likely fix hypothesis.

Claude's hypothesis: {$CLAUDE_HYPOTHESIS}

Do you agree with Claude's hypothesis, or do you have a different or more specific fix hypothesis? Give:
- hypothesis: [1-2 sentence specific, actionable fix hypothesis]
- confidence: high | medium | low
- reasoning: [1-3 sentences grounded in the failure output and test context]

Be concrete — name specific functions, variables, or code paths if visible in the context.
```

Call order (sequential, same as Mode A in quorum.md):

**Native CLI agents:**
1. `mcp__codex-cli-1__review`
2. `mcp__gemini-cli-1__gemini`
3. `mcp__opencode-1__opencode`
4. `mcp__copilot-1__ask`

**claude-mcp instances:** For each available claude-mcp server (from `$CLAUDE_MCP_SERVERS` built in quorum pre-flight — if pre-flight has not been run yet for this session, skip claude-mcp calls and proceed with native agents only):
- Call `mcp__<serverName>__claude` with the investigation prompt

Handle UNAVAILABLE: note and skip (same R6 handling as quorum.md). If ALL models are unavailable, fall back to Claude's own hypothesis as the sole input.

**Step D — Deliberate to consensus hypothesis:**

Collect all model hypotheses. Claude synthesizes a single CONSENSUS HYPOTHESIS:

- If majority (>50% of available models) agree on a specific fix direction → use that as consensus.
- If split: Claude picks the hypothesis with the most concrete, evidence-grounded reasoning.
- If only Claude responded: Claude's hypothesis IS the consensus.

Print consensus:
```
QGSD fix-tests: Real-bug consensus [{verdict.file}] → {one-sentence summary of consensus hypothesis}
```

Store as `$CONSENSUS_HYPOTHESIS` for this verdict.

**Step E — Append to deferred_report and save state:**

Append to `state.deferred_report.real_bug` (even though a task will be dispatched — this preserves the audit trail):
```json
{
  "file": "{verdict.file}",
  "reason": "{verdict.reason}",
  "consensus_hypothesis": "{$CONSENSUS_HYPOTHESIS}"
}
```

Save state:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '<state with updated deferred_report.real_bug>'
```

**Step F — Build and dispatch /qgsd:quick fix task:**

Build task description:
```
Fix real-bug test failure: {verdict.file}

Classification: real-bug
Error type: {verdict.error_type}
Failure reason: {verdict.reason}

Quorum fix hypothesis (consensus from {N} models):
{$CONSENSUS_HYPOTHESIS}

Test file: {verdict.file}
Error output summary:
{verdict.error_summary — first 500 chars}

Apply the quorum hypothesis. Run the test after fixing to confirm it passes.
```

Build dispatched_task record:
```json
{
  "task_id": "<ISO timestamp + 'real-bug'>",
  "category": "real-bug",
  "error_type": "{verdict.error_type}",
  "directory": "{first 2 path segments of verdict.file}",
  "test_count": 1,
  "test_files": ["{verdict.file}"],
  "dispatched_at": "<ISO timestamp>",
  "consensus_hypothesis": "{$CONSENSUS_HYPOTHESIS}"
}
```

Save state with this record appended to `dispatched_tasks` BEFORE spawning the Task:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '<state with new dispatched_task appended>'
```

Spawn the /qgsd:quick Task agent:
```
Task(
  prompt="First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.

<planning_context>
Mode: quick
Description: {task_description}

<files_to_read>
- .planning/STATE.md
- ./CLAUDE.md (if exists)
</files_to_read>
</planning_context>
",
  subagent_type="qgsd-planner",
  description="Fix real-bug: {verdict.file}"
)
```

Print after each dispatch:
```
QGSD fix-tests: Dispatched real-bug task — {verdict.file} ({N} quorum models deliberated)
```

**After all real-bug verdicts in this batch are processed:**

Print:
```
QGSD fix-tests: Batch {B+1} real-bug dispatch complete — {N} tasks dispatched via quorum investigation
```
```

---

**Edit 3 — Update the INTG-03 Compliance Note at the bottom of the file.**

Find:
```
## INTG-03 Compliance Note

This workflow MUST NOT call any quorum worker (mcp__gemini-cli__, mcp__codex-cli__, etc.).
It is execution-only. Adding fix-tests to quorum_commands violates R2.1 and will cause the
Stop hook to block every response waiting for quorum that was never dispatched.
```

Replace with:
```
## INTG-03 Compliance Note

This workflow calls quorum workers ONLY for real-bug investigation (Step 6h.1) — a targeted,
per-test deliberation to produce a fix hypothesis before dispatching a /qgsd:quick task.

Quorum MUST NOT be called for classification of adapt/fixture/isolate failures. Those categories
dispatch /qgsd:quick tasks directly. fix-tests MUST NOT be added to `quorum_commands` in qgsd.json
— that would cause the Stop hook to block every fix-tests response waiting for a planning quorum
that was never dispatched (R2.1 violation).

The real-bug quorum calls in Step 6h.1 are inline investigation calls, not planning quorum.
They are safe because fix-tests is not in quorum_commands and the Stop hook only intercepts
responses from commands listed there.
```

---

**Also update the terminal summary in Step 7** to change the deferred real-bug line:

Find in Step 7:
```
   real-bug:    {len(real_bug)}   ← deferred (see report below)
```

Replace with:
```
   real-bug:    {len(real_bug)}   ← investigated by quorum + dispatched (see report below)
```

Find in Step 7 the deferred report block that shows "Real bugs (requires developer judgment):":
```
Real bugs (requires developer judgment):
{for each file in state.deferred_report.real_bug:}
  - {file} — {matching verdict.reason from categorization_verdicts}
```

Replace with:
```
Real bugs (quorum-investigated, fix task dispatched):
{for each entry in state.deferred_report.real_bug:}
  - {entry.file} — {entry.reason}
    Hypothesis: {entry.consensus_hypothesis}
```
  </action>
  <verify>
```bash
grep -n "real-bug\|6h\.1\|INTG-03\|quorum investigation\|consensus_hypothesis" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md | head -40
```
  </verify>
  <done>
- `grep "6h.1" fix-tests.md` returns at least 2 matches (the new step header and a reference from 6h)
- `grep "INTG-03" fix-tests.md` shows the updated compliance note mentioning "real-bug investigation"
- `grep "consensus_hypothesis" fix-tests.md` returns at least 3 matches (investigation bundle, dispatched_task record, deferred_report entry)
- `grep "quorum_commands" fix-tests.md` returns at least 1 match (still warns against adding fix-tests to quorum_commands)
- `grep "requires developer judgment" fix-tests.md` returns 0 matches (old label replaced)
- The adapt/fixture/isolate dispatch block in 6h is unchanged
  </done>
</task>

<task type="auto">
  <name>Task 2: Run install sync to propagate changes to ~/.claude/qgsd/</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
After Task 1 updates the source `get-shit-done/workflows/fix-tests.md`, run install to copy the updated workflow to the installed location that Claude Code uses at runtime.

Run from the QGSD repo root:
```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

After install completes, spot-verify the installed copy has the new content:
```bash
grep -c "6h.1" /Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md
grep -c "consensus_hypothesis" /Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md
```

Both should return >= 2.
  </action>
  <verify>
```bash
grep "6h.1" /Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md | head -3
grep "INTG-03" /Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md
```
  </verify>
  <done>
`grep "6h.1" ~/.claude/qgsd/workflows/fix-tests.md` returns at least 2 matches. The installed copy reflects the source changes from Task 1.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `grep -c "6h.1" get-shit-done/workflows/fix-tests.md` returns >= 2
2. `grep -c "consensus_hypothesis" get-shit-done/workflows/fix-tests.md` returns >= 3
3. `grep "requires developer judgment" get-shit-done/workflows/fix-tests.md` returns 0 (old label gone)
4. `grep "quorum_commands" get-shit-done/workflows/fix-tests.md` returns 1 (warning preserved)
5. `diff <(grep "adapt\|fixture\|isolate" get-shit-done/workflows/fix-tests.md | grep -v "real-bug")` shows no regression in adapt/fixture/isolate dispatch blocks
6. The installed copy at `~/.claude/qgsd/workflows/fix-tests.md` has the same changes
</verification>

<success_criteria>
- real-bug verdicts trigger quorum investigation (Claude + available quorum models, sequential calls) before dispatch
- Each real-bug verdict produces a consensus fix hypothesis
- A /qgsd:quick task is dispatched per real-bug verdict with the quorum hypothesis as context
- The dispatch record stored in state.dispatched_tasks includes `consensus_hypothesis`
- deferred_report.real_bug entries include the consensus hypothesis (audit trail preserved)
- adapt/fixture/isolate dispatch in Step 6h is completely unchanged
- INTG-03 note correctly explains the scoped quorum use (real-bug investigation only, not classification quorum)
- ~/.claude/qgsd/workflows/fix-tests.md is up to date after install sync
</success_criteria>

<output>
After completion, create `.planning/quick/61-in-fix-tests-md-when-tests-are-classifie/61-SUMMARY.md` following @/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</output>
