---
phase: quick-49
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
autonomous: true
requirements:
  - QUICK-49
must_haves:
  truths:
    - "quorum.md contains no instruction to call models in parallel or as sibling tool calls"
    - "Mode A query section enforces sequential calls with an explicit anti-parallel warning"
    - "Mode B Task dispatch section uses sequential dispatch (one Task at a time) rather than a single parallel message"
    - "A top-level sequential enforcement rule exists in quorum.md before any model call section"
  artifacts:
    - path: "commands/qgsd/quorum.md"
      provides: "Updated quorum command — all model calls sequential, sibling calls prohibited"
  key_links:
    - from: "commands/qgsd/quorum.md (Mode A query section)"
      to: "each mcp__ tool call"
      via: "sequential loop — one call per message"
      pattern: "MUST be a separate, sequential tool call"
    - from: "commands/qgsd/quorum.md (Mode B dispatch section)"
      to: "Task subagent calls"
      via: "sequential dispatch — one Task per message"
      pattern: "sequential.*one Task at a time"
---

<objective>
Fix sibling tool call errors in the quorum command by making all model calls explicitly sequential.

Purpose: When Claude Code executes multiple MCP tool calls as siblings (in the same message), a failure in one propagates "Sibling tool call errored" to all co-submitted calls. The quorum command must eliminate every instruction that could cause parallel/sibling dispatch — both direct MCP calls (Mode A) and Task subagent calls (Mode B).

Output: An updated `commands/qgsd/quorum.md` where every model call (native agent, claude-mcp, Task subagent) is explicitly sequential with a blanket anti-sibling-call rule at the top of the call sections.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add top-level sequential enforcement rule and fix Mode B parallel dispatch</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
Edit `commands/qgsd/quorum.md` with the following changes:

**Change 1 — Add a sequential enforcement block.**

After the closing `</mode_detection>` block (line 32) and before the `---` separator (line 33), insert a new `<sequential_enforcement>` block:

```
---

> **SEQUENTIAL CALLS ONLY — NO SIBLING TOOL CALLS**
> Every MCP tool call and every Task spawn in this command MUST be issued as a separate, standalone message turn — never batched or co-submitted as sibling calls. This applies to identity checks, health checks, inference calls, and Task subagent dispatches. A single failure in a sibling batch propagates "Sibling tool call errored" to all co-submitted calls, corrupting the entire quorum. When in doubt: one call, then wait for the response, then proceed.
```

Place this block immediately after `</mode_detection>` and before the `### Provider pre-flight` section.

**Change 2 — Fix Mode B Task dispatch.**

Find the section that currently reads:

```
### Dispatch parallel quorum workers via Task

Task subagents are isolated subprocesses — parallel dispatch is safe (a failing Task does not propagate to co-submitted Tasks, unlike direct sibling MCP calls).
```

Replace the entire heading and rationale paragraph with:

```
### Dispatch quorum workers via Task (sequential — one at a time)

Task subagents must be dispatched **sequentially**, one per message turn. Do NOT co-submit multiple Task calls in the same message, even though Task subagents are isolated. Sibling Task calls still produce "Sibling tool call errored" propagation in Claude Code when any one fails.
```

**Change 3 — Fix the "Dispatch (single parallel message):" label.**

Find the line:

```
Dispatch (single parallel message):
```

Replace with:

```
Dispatch (sequential — one Task per message turn):
```

**Change 4 — Verify Mode A already uses sequential language.**

Confirm the Mode A "Query models (sequential)" section at line ~135 contains the text:

```
each call MUST be a **separate, sequential tool call** (not sibling calls in the same message, per R3.2)
```

If that text is present and unchanged, no edit needed for Mode A. If it is absent or weakened, restore it.

**What NOT to change:** The Mode B bundle assembly logic, the worker prompt template, the scoreboard update commands, the verdict collection logic, and Mode A's deliberation and consensus sections are all unaffected by this fix. Do not touch them.
  </action>
  <verify>
Run the following checks:

```bash
# Confirm "parallel" no longer appears as an instruction in dispatch sections
grep -n "parallel" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md

# Confirm sequential enforcement block exists
grep -n "SEQUENTIAL CALLS ONLY" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md

# Confirm Mode B dispatch heading is updated
grep -n "sequential.*one Task" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md

# Confirm Mode A sequential language is present
grep -n "separate, sequential tool call" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
```

Expected: "SEQUENTIAL CALLS ONLY" appears once, "separate, sequential tool call" appears at least once, "sequential.*one Task" appears in Mode B heading, and any remaining "parallel" occurrences are only in the Mode B rationale comment or Mode A text that already correctly says NOT parallel.
  </verify>
  <done>
`commands/qgsd/quorum.md` has a top-level anti-sibling-call warning, Mode B dispatch heading says "sequential — one Task per message turn", and Mode A query section retains its sequential enforcement text. No instruction in the file tells Claude to batch or co-submit model calls.
  </done>
</task>

</tasks>

<verification>
After task completion:
1. `grep -n "parallel" commands/qgsd/quorum.md` — any remaining "parallel" references must only describe what is PROHIBITED (the word must not appear in an affirmative instruction)
2. `grep -c "sequential" commands/qgsd/quorum.md` — should return 5 or more occurrences (enforcement block + Mode A heading + Mode A body + Mode B heading + deliberation note)
3. Read the full file top-to-bottom and confirm no section instructs batching multiple model calls into a single message
</verification>

<success_criteria>
The quorum command is free of parallel/sibling dispatch instructions. Running `/qgsd:quorum` with one or more models UNAVAIL will not produce "Sibling tool call errored" on the remaining models because each call is issued sequentially in its own message turn.
</success_criteria>

<output>
After completion, create `.planning/quick/49-fix-sibling-tool-call-errors-in-quorum-b/49-01-SUMMARY.md`
</output>
