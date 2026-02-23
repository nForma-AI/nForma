---
phase: quick-81
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/mcp-status.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Running /qgsd:mcp-status produces no raw JSON tool-result blocks in the main conversation"
    - "The final status table still shows all 10 agents with correct health/latency data"
    - "Individual agent failures are still handled gracefully (no crash)"
  artifacts:
    - path: "commands/qgsd/mcp-status.md"
      provides: "Updated mcp-status command with sub-agent Step 3"
      contains: "Task("
  key_links:
    - from: "commands/qgsd/mcp-status.md Step 3"
      to: "sub-agent internal MCP calls"
      via: "Task() with subagent_type: general-purpose"
      pattern: "Task\\("
    - from: "sub-agent return value"
      to: "Step 4 health derivation"
      via: "JSON object keyed by slot name"
      pattern: "identity.*hc"
---

<objective>
Reduce /qgsd:mcp-status verbosity by moving all 16 MCP tool calls (10 identity + 6 health_check) into a single Task() sub-agent that runs them internally and returns one JSON object. The main conversation never sees the raw tool result blocks.

Purpose: The current Step 3 expands ~20 lines of JSON per agent (160+ lines total) before the table appears. A sub-agent absorbs all of that noise.

Output: Updated commands/qgsd/mcp-status.md with Step 3 replaced by a Task() call. Steps 1, 2, 4, 5 and all frontmatter unchanged.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/mcp-status.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace Step 3 with a Task() sub-agent in mcp-status.md</name>
  <files>commands/qgsd/mcp-status.md</files>
  <action>
Replace the content of Step 3 in commands/qgsd/mcp-status.md — the section that currently instructs Claude to call all identity and health_check tools directly — with a single Task() sub-agent invocation.

The new Step 3 reads as follows (replace from the `## Step 3:` heading line through the end of the Step 3 section, up to but not including the `## Step 4:` heading):

---
## Step 3: Collect identity + health_check results via sub-agent (run after Step 2 output is stored)

Invoke a Task() sub-agent to call all MCP tools. This prevents raw tool-result blocks from appearing in the main conversation.

```
Task(
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: """
You are a data-collection sub-agent. Your only job is to call the MCP tools listed below and return their results as a single JSON object. Do not explain or summarize — return only the JSON object.

Call each tool with {} as input. Wrap every call in try/catch — if a tool throws or is unavailable, record null for that field.

Tools to call in this order (call them one at a time, sequentially — never parallel):

1. mcp__codex-1__identity          — store result as codex_id
2. mcp__gemini-1__identity         — store result as gemini_id
3. mcp__opencode-1__identity       — store result as opencode_id
4. mcp__copilot-1__identity        — store result as copilot_id
5. mcp__claude-1__identity         — store result as claude1_id
6. mcp__claude-1__health_check     — store result as claude1_hc
7. mcp__claude-2__identity         — store result as claude2_id
8. mcp__claude-2__health_check     — store result as claude2_hc
9. mcp__claude-3__identity         — store result as claude3_id
10. mcp__claude-3__health_check    — store result as claude3_hc
11. mcp__claude-4__identity        — store result as claude4_id
12. mcp__claude-4__health_check    — store result as claude4_hc
13. mcp__claude-5__identity        — store result as claude5_id
14. mcp__claude-5__health_check    — store result as claude5_hc
15. mcp__claude-6__identity        — store result as claude6_id
16. mcp__claude-6__health_check    — store result as claude6_hc

Return ONLY this JSON structure (no markdown, no explanation):
{
  "codex-1":    { "identity": <codex_id or null>,    "hc": null },
  "gemini-1":   { "identity": <gemini_id or null>,   "hc": null },
  "opencode-1": { "identity": <opencode_id or null>, "hc": null },
  "copilot-1":  { "identity": <copilot_id or null>,  "hc": null },
  "claude-1":   { "identity": <claude1_id or null>,  "hc": <claude1_hc or null> },
  "claude-2":   { "identity": <claude2_id or null>,  "hc": <claude2_hc or null> },
  "claude-3":   { "identity": <claude3_id or null>,  "hc": <claude3_hc or null> },
  "claude-4":   { "identity": <claude4_id or null>,  "hc": <claude4_hc or null> },
  "claude-5":   { "identity": <claude5_id or null>,  "hc": <claude5_hc or null> },
  "claude-6":   { "identity": <claude6_id or null>,  "hc": <claude6_hc or null> }
}

Where each identity value is the raw object returned by the tool (with at minimum `version` and `model` fields), and each hc value is the raw object returned by health_check (with `healthy`, `latencyMs`, and optionally `model`, `via` fields).
"""
)
```

Store the sub-agent's returned JSON object as AGENT_RESULTS (parse from the sub-agent's text output).

For each slot in AGENT_RESULTS:
- `identity` = the identity result (or null if the sub-agent recorded null)
- `hc` = the health_check result (or null)

Use these values in Step 4 exactly as before — the shape is identical to what the old direct tool calls returned.

---

Keep the `allowed-tools` frontmatter list exactly as-is (all identity and health_check tools remain listed — the sub-agent inherits available tools from the parent command context). Do not change any other section.
  </action>
  <verify>
    1. Read commands/qgsd/mcp-status.md and confirm Step 3 now contains "Task(" and "subagent_type" instead of individual mcp__ tool call instructions.
    2. Confirm the allowed-tools frontmatter still lists all 16 MCP tools (mcp__codex-1__identity through mcp__claude-6__health_check).
    3. Confirm Steps 1, 2, 4, and 5 are unchanged.
    4. Run: grep -n "mcp__claude-1__identity" commands/qgsd/mcp-status.md — it should appear ONLY in the frontmatter allowed-tools section and inside the sub-agent prompt string, NOT as a direct top-level instruction to Claude.
  </verify>
  <done>
    Step 3 is a single Task() invocation. The sub-agent prompt lists all 16 tools and returns one JSON object keyed by slot name. The main command body never directly calls identity or health_check tools. All other steps unchanged.
  </done>
</task>

</tasks>

<verification>
- grep -c "subagent_type" commands/qgsd/mcp-status.md → returns 1
- grep -n "Task(" commands/qgsd/mcp-status.md → appears in Step 3
- The allowed-tools list remains 16 MCP tools + Read + Bash
- Step 4 and Step 5 content is byte-for-byte identical to the original
</verification>

<success_criteria>
- /qgsd:mcp-status Step 3 uses a single Task() sub-agent call (not direct MCP tool calls in the main conversation)
- Sub-agent is instructed to call all 16 tools sequentially and return one JSON object
- JSON schema: { "slot-name": { "identity": {...}|null, "hc": {...}|null }, ... }
- Steps 1, 2, 4, 5 and frontmatter allowed-tools unchanged
- The command remains fully functional — all 10 agents, health/latency data, graceful failure handling
</success_criteria>

<output>
After completion, create `.planning/quick/81-make-mcp-status-sub-agent-its-mcp-tool-c/81-SUMMARY.md`
</output>
