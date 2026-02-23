---
phase: quick-67
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-orchestrator.md
autonomous: true
requirements: [QUICK-67]

must_haves:
  truths:
    - "A hung claude-mcp-server inference call is marked UNAVAIL within 30s instead of freezing the session for 2+ minutes"
    - "The orchestrator log shows a timeout/UNAVAIL entry for any model that does not respond, then continues to the next model"
    - "CLAUDE_MCP_TIMEOUT_MS is 30000 in ~/.claude.json for all claude-mcp server entries"
    - "Both source (agents/qgsd-quorum-orchestrator.md) and installed (~/.claude/agents/qgsd-quorum-orchestrator.md) copies are identical after the sync"
  artifacts:
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Per-model timeout + UNAVAIL skip instruction for claude-mcp inference calls"
      contains: "30s"
  key_links:
    - from: "agents/qgsd-quorum-orchestrator.md"
      to: "~/.claude/agents/qgsd-quorum-orchestrator.md"
      via: "node bin/install.js --claude --global"
      pattern: "install sync"
    - from: "CLAUDE_MCP_TIMEOUT_MS in ~/.claude.json"
      to: "claude-mcp-server executeCommand timeout"
      via: "process.env.CLAUDE_MCP_TIMEOUT_MS"
      pattern: "30000"
---

<objective>
Harden all quorum calls against model-inference hangs by reducing the per-model timeout from 120s to 30s and adding explicit skip-on-timeout instructions to the quorum orchestrator agent definition.

Purpose: Session freezes occur when claude-mcp-server inference calls (deepseek, kimi, minimax) hang. The MCP subprocess timeout is currently 120s, causing the orchestrator to stall for 2+ minutes per hung model. The provider pre-flight HTTP probe does not catch model-level overload (endpoint is "up" but inference queues are stuck). The fix is two-pronged: lower the subprocess timeout to 30s so hung calls surface quickly, and add explicit orchestrator instruction to treat any model exceeding the timeout as UNAVAIL and continue.

Output: Updated orchestrator agent definition with timeout guard prose + reduced CLAUDE_MCP_TIMEOUT_MS in ~/.claude.json + install sync.
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
  <name>Task 1: Reduce CLAUDE_MCP_TIMEOUT_MS to 30s in ~/.claude.json for all claude-mcp servers</name>
  <files>~/.claude.json (env block for each claude-mcp server entry)</files>
  <action>
    Read ~/.claude.json. For every mcpServers entry whose key starts with "claude-" (these are the claude-mcp-server instances: claude-deepseek, claude-minimax, claude-qwen-coder, claude-kimi, claude-llama4, claude-glm), set:
      "CLAUDE_MCP_TIMEOUT_MS": "30000"
    (change from 120000 to 30000). Leave CLAUDE_MCP_HEALTH_TIMEOUT_MS untouched at 30000 (already correct).

    Do NOT touch native CLI agent entries (codex-cli, gemini-cli, opencode, copilot-cli) — they don't use this variable.

    Write the updated ~/.claude.json back. Verify by grepping for CLAUDE_MCP_TIMEOUT_MS in the result — all claude-* entries must show 30000.

    Rationale: claude-mcp-server's executeCommand() reads CLAUDE_MCP_TIMEOUT_MS from process.env at startup. 120s allowed hung inference calls to freeze the quorum orchestrator for 2 minutes per model. 30s matches the health_check timeout and is long enough for real inference while short enough to surface hangs promptly.
  </action>
  <verify>
    node -e "
    const d=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude.json','utf8'));
    const servers=d.mcpServers||{};
    const bad=Object.entries(servers).filter(([k,v])=>k.startsWith('claude-')&&v.env&&v.env.CLAUDE_MCP_TIMEOUT_MS!=='30000');
    if(bad.length) { console.error('FAIL: still 120000 for', bad.map(([k])=>k).join(', ')); process.exit(1); }
    else console.log('OK: all claude-mcp servers have CLAUDE_MCP_TIMEOUT_MS=30000');
    "
  </verify>
  <done>All claude-* mcpServers entries in ~/.claude.json have CLAUDE_MCP_TIMEOUT_MS set to "30000". Native CLI agents are unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add per-model timeout guard to quorum orchestrator + install sync</name>
  <files>
    agents/qgsd-quorum-orchestrator.md
    ~/.claude/agents/qgsd-quorum-orchestrator.md (via install sync)
  </files>
  <action>
    Read /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md.

    In Step 2 (Team identity capture), in the "claude-mcp-server instances" loop block — immediately after the line "For each server with `available: true`:", add this timeout guard sentence BEFORE the health_check bullet:

    > **Timeout guard:** Each `health_check` and `mcp__<serverName>__claude` inference call must complete within 30 seconds. If a call hangs or errors (including MCP timeout), immediately mark that server UNAVAIL, log `[<serverName>] TIMEOUT — marked UNAVAIL`, and continue to the next server. Do NOT wait for a hung call to resolve.

    In Mode A (Pure Question), in the "Query models (sequential)" section — after the sentence "Skip slots where `available: false`." and before the call order list, add:

    > **Per-model timeout:** Each `mcp__<slotName>__claude` inference call must resolve within 30 seconds. If the MCP tool call hangs, times out, or returns an error, mark that slot UNAVAIL immediately, log `[<slotName>] TIMEOUT — marked UNAVAIL`, and proceed to the next slot. Do not retry. Continue quorum with remaining available models.

    In Mode A Deliberation rounds section — after "Each model called **sequentially**.", add:

    > Apply the same 30-second timeout guard: any model that hangs or errors during deliberation is marked UNAVAIL for the remainder of this quorum run.

    In Mode B (Execution + Trace Review), "Dispatch quorum workers via Task" section — after "Do NOT co-submit multiple Task calls in the same message", add:

    > **Per-worker timeout:** If a Task worker spawn or the underlying MCP call within it takes longer than 30 seconds without a response, treat that worker's verdict as UNAVAIL. Continue collecting verdicts from remaining workers.

    After making all edits, run the install sync to propagate to the installed copy:
    ```
    node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
    ```

    Then verify source and installed copies are identical (only the expected path-substitution diff should remain):
    ```
    diff /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
    ```
    The only acceptable diff is the `~/.claude/qgsd.json` vs absolute path substitution already present from the installer. All new timeout guard text must appear in both files.
  </action>
  <verify>
    grep -c "30 seconds" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
    # Must return 4 (one per insertion point)
    grep -c "30 seconds" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md
    # Must also return 4
    grep "TIMEOUT — marked UNAVAIL" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
    # Must show at least 2 matching lines
  </verify>
  <done>The orchestrator agent definition in both source and installed locations contains explicit 30-second per-model timeout guard instructions at all four quorum call sites (team identity health_check, Mode A round queries, Mode A deliberation, Mode B worker dispatch). Install sync ran successfully.</done>
</task>

</tasks>

<verification>
1. `grep CLAUDE_MCP_TIMEOUT_MS ~/.claude.json | grep 30000 | wc -l` — must equal the number of claude-* server entries (currently 6).
2. `grep "30 seconds" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md | wc -l` — must be 4.
3. `grep "30 seconds" /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md | wc -l` — must be 4.
4. `diff /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md /Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md` — only the path substitution line differs (qgsd.json path).
</verification>

<success_criteria>
- All 6 claude-mcp server entries in ~/.claude.json use CLAUDE_MCP_TIMEOUT_MS=30000 (was 120000).
- Quorum orchestrator source at agents/qgsd-quorum-orchestrator.md contains 4 explicit timeout guard blocks (team capture, Mode A query, Mode A deliberation, Mode B dispatch).
- Installed copy at ~/.claude/agents/qgsd-quorum-orchestrator.md matches source (path sub aside).
- A future quorum run where kimi/minimax/deepseek hangs will surface within 30s as UNAVAIL rather than freezing the session.
</success_criteria>

<output>
After completion, create `.planning/quick/67-harden-all-quorum-calls-against-hangs-ad/67-SUMMARY.md`
</output>
