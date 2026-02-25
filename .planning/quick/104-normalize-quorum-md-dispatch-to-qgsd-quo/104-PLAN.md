---
phase: quick-104
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
autonomous: true
requirements:
  - QT-104
must_haves:
  truths:
    - "Mode A query section spawns one Task per slot with subagent_type=qgsd-quorum-slot-worker and a YAML argument block"
    - "Mode B dispatch section spawns one Task per slot with subagent_type=qgsd-quorum-slot-worker and a YAML argument block"
    - "No Task in quorum.md uses subagent_type=general-purpose for slot dispatch"
    - "No direct sequential MCP tool calls (mcp__*__review, mcp__*__gemini, etc.) appear in the Mode A query section"
    - "The YAML arguments passed to each worker include: slot, round, timeout_ms, repo_dir, mode, question (and traces for Mode B)"
  artifacts:
    - path: "commands/qgsd/quorum.md"
      provides: "Updated quorum command — both Mode A and Mode B use qgsd-quorum-slot-worker for slot dispatch"
      contains: "subagent_type=\"qgsd-quorum-slot-worker\""
  key_links:
    - from: "commands/qgsd/quorum.md (Mode A query section)"
      to: "agents/qgsd-quorum-slot-worker.md"
      via: "Task(subagent_type=qgsd-quorum-slot-worker, prompt=YAML block)"
      pattern: "subagent_type=\"qgsd-quorum-slot-worker\""
    - from: "commands/qgsd/quorum.md (Mode B dispatch section)"
      to: "agents/qgsd-quorum-slot-worker.md"
      via: "Task(subagent_type=qgsd-quorum-slot-worker, prompt=YAML block)"
      pattern: "subagent_type=\"qgsd-quorum-slot-worker\""
---

<objective>
Normalize quorum.md so both Mode A and Mode B dispatch slot workers via `subagent_type="qgsd-quorum-slot-worker"` Tasks, replacing direct sequential MCP calls (Mode A) and `general-purpose` Tasks (Mode B).

Purpose: The `qgsd-quorum-slot-worker` agent is the canonical slot-calling mechanism — it handles MCP calls via `call-quorum-slot.cjs` with Bash fallback, reads repo context, and returns structured result blocks. Both modes should use it consistently.

Output: Updated `commands/qgsd/quorum.md` with normalized dispatch in both modes.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/quorum.md
@agents/qgsd-quorum-slot-worker.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace Mode A direct MCP calls with qgsd-quorum-slot-worker Tasks</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
Replace the "Query models (sequential)" section in Mode A (currently lines ~214-237) which does direct sequential MCP tool calls.

Current pattern to replace:
```
Call order (sequential):

**Native CLI agents** (hardcoded tool names):
1. `mcp__codex-cli-1__review`
2. `mcp__gemini-cli-1__gemini`
3. `mcp__opencode-1__opencode`
4. `mcp__copilot-1__ask`

**claude-mcp instances** (dynamic — iterate over available servers in `$CLAUDE_MCP_SERVERS` order):
For each server with `available: true` and healthy from team capture:
- Call `mcp__<serverName>__claude` with the query prompt (field name: `prompt`)
```

Replace with: spawn one `Task(subagent_type="qgsd-quorum-slot-worker", description="<slotName> quorum R<N>", prompt=<YAML block>)` per active slot, in parallel (sibling Task calls in one message turn). Build the YAML prompt per the slot-worker argument spec:

```
slot: <slotName>
round: <round_number>
timeout_ms: <slot_timeout from $SLOT_TIMEOUTS>
repo_dir: <absolute path to working directory>
mode: A
question: <question text>
```

For Round 2+ deliberation, append:
```
prior_positions: |
  <all prior positions verbatim>
```

Also remove the now-redundant prompt template block in Mode A (the `QGSD Quorum — Round 1` template with the hardcoded `You are one of the quorum members...` text) since the slot-worker builds its own prompt from the YAML arguments — the orchestrator only passes the YAML block.

The deliberation section header note ("Each model is called **sequentially** (not as sibling calls).") should be updated: workers ARE dispatched as parallel sibling Tasks per round. The sequential constraint in R3.2 applied to the old direct-call model; the slot-worker architecture explicitly supports parallel Task dispatch.

Do NOT change:
- Provider pre-flight section
- Team identity capture section
- Evaluate Round 1 / consensus logic
- Scoreboard update calls
- The `<dispatch_pattern>` frontmatter block
- Mode B (handled in Task 2)
  </action>
  <verify>
    grep -n "subagent_type=\"qgsd-quorum-slot-worker\"" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md | head -20
    grep -n "mcp__codex-cli-1__review\|mcp__gemini-cli-1__gemini\|mcp__opencode-1__opencode\|mcp__copilot-1__ask" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
  </verify>
  <done>
    - grep for "subagent_type=\"qgsd-quorum-slot-worker\"" returns at least one match in Mode A section
    - grep for direct native MCP calls (mcp__codex-cli-1__review, mcp__gemini-cli-1__gemini, mcp__opencode-1__opencode, mcp__copilot-1__ask) in the Mode A query section returns no matches
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace Mode B general-purpose Tasks with qgsd-quorum-slot-worker Tasks</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
Replace the "Dispatch quorum workers via Task (parallel per round)" section in Mode B (currently lines ~464-474) which uses `subagent_type="general-purpose"` with a prompt instructing the sub-agent to call an MCP tool.

Current pattern to replace (for each native agent + claude-mcp instance):
```
Task(subagent_type="general-purpose", prompt="Call mcp__gemini-cli-1__gemini with the following prompt. Pass the full literal bundle inline — do not summarize or truncate: [full worker prompt with bundle inlined]")
```

And for claude-mcp instances:
```
Task(subagent_type="general-purpose", prompt="Call mcp__<serverName>__claude with prompt=[full worker prompt with bundle inlined]. Pass the full literal bundle inline — do not summarize or truncate.")
```

Replace ALL of these with: one `Task(subagent_type="qgsd-quorum-slot-worker", description="<slotName> quorum R<N>", prompt=<YAML block>)` per active slot, dispatched as parallel sibling Tasks in one message turn. The YAML block for Mode B:

```
slot: <slotName>
round: <round_number>
timeout_ms: <slot_timeout from $SLOT_TIMEOUTS>
repo_dir: <absolute path to working directory>
mode: B
question: <question text>
traces: |
  <full $TRACES content verbatim>
```

For Round 2+ deliberation, also append:
```
prior_positions: |
  <all prior positions verbatim>
```

Also remove the worker prompt template block in Mode B (the `QGSD Quorum — Execution Review` template with `verdict: APPROVE | REJECT | FLAG` format) — the slot-worker builds its own prompt from the YAML arguments. The orchestrator only passes the YAML block.

Do NOT change:
- Parse commands section
- Execute and capture traces section
- Assemble review bundle section (the `$TRACES` assembly stays — it feeds the YAML block)
- Collect verdicts section
- Output consensus verdict section
- Scoreboard update calls
- Mode A (already handled in Task 1)
  </action>
  <verify>
    grep -n "subagent_type=\"qgsd-quorum-slot-worker\"" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
    grep -n "subagent_type=\"general-purpose\"" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
  </verify>
  <done>
    - grep for "subagent_type=\"qgsd-quorum-slot-worker\"" returns matches in both Mode A and Mode B sections
    - grep for "subagent_type=\"general-purpose\"" returns zero matches (no general-purpose Tasks remain)
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. `grep -c "subagent_type=\"qgsd-quorum-slot-worker\"" commands/qgsd/quorum.md` — should return 2 or more (one for Mode A, one for Mode B)
2. `grep -c "subagent_type=\"general-purpose\"" commands/qgsd/quorum.md` — must return 0
3. `grep -c "mcp__codex-cli-1__review\|mcp__gemini-cli-1__gemini\|mcp__opencode-1__opencode\|mcp__copilot-1__ask" commands/qgsd/quorum.md` — must return 0 in the query/dispatch sections (provider pre-flight and team-identity-capture MCP calls are acceptable if present there, but those sections don't call these tools)
4. Verify the YAML argument block in each Task dispatch includes `slot`, `round`, `timeout_ms`, `repo_dir`, `mode`, `question` fields
5. Verify Mode B Tasks include `traces:` in the YAML block
</verification>

<success_criteria>
- Both Mode A and Mode B in `commands/qgsd/quorum.md` dispatch slot workers exclusively via `Task(subagent_type="qgsd-quorum-slot-worker", ...)`
- No `subagent_type="general-purpose"` Task calls remain
- No direct sequential MCP tool calls remain in the Mode A query section or Mode B dispatch section
- The YAML argument block passed to each worker is valid per the slot-worker's `<arguments>` spec (slot, round, timeout_ms, repo_dir, mode, question; plus traces for Mode B; plus prior_positions for Round 2+)
- The file still has valid markdown structure and all other sections (pre-flight, team capture, consensus output, scoreboard) are intact
</success_criteria>

<output>
After completion, create `.planning/quick/104-normalize-quorum-md-dispatch-to-qgsd-quo/104-SUMMARY.md` using the summary template.
</output>
