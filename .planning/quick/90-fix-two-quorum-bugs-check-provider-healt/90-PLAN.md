---
phase: quick-90
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/check-provider-health.cjs
  - agents/qgsd-quorum-orchestrator.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Running `node bin/check-provider-health.cjs --json` returns a non-empty providers object with entries for claude-1 through claude-6"
    - "The orchestrator Step 1 slot ordering section explicitly reads preferSub from qgsd.json and places auth_type=sub slots before auth_type=api slots before the healthy/unhealthy reorder"
    - "Subprocess slots (codex-1, gemini-1, opencode-1, copilot-1) appear first in the orchestrator's active slot list when preferSub=true in qgsd.json"
  artifacts:
    - path: "bin/check-provider-health.cjs"
      provides: "HTTP provider health probe — correctly identifies HTTP slots by ANTHROPIC_BASE_URL presence, not binary name"
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Quorum orchestrator Step 1 with preferSub ordering logic"
  key_links:
    - from: "bin/check-provider-health.cjs line ~134"
      to: "env.ANTHROPIC_BASE_URL"
      via: "remove redundant args filter — !baseUrl on line 139 is the real HTTP discriminator"
      pattern: "if.*!baseUrl.*continue"
    - from: "agents/qgsd-quorum-orchestrator.md Step 1 slot reorder"
      to: "qgsd.json quorum.preferSub + agent_config[slot].auth_type"
      via: "add preferSub read + sort before healthy/unhealthy reorder"
      pattern: "preferSub"
---

<objective>
Fix two quorum bugs:
1. check-provider-health.cjs line 134 filters on `claude-mcp-server` in args — but all slots now use `unified-mcp-server.mjs`, so $CLAUDE_MCP_SERVERS is always empty and HTTP providers are never pre-flight checked.
2. The orchestrator Step 1 has no preferSub/auth_type ordering — subscription CLI slots (codex-1, gemini-1, opencode-1, copilot-1) must be called first when `quorum.preferSub=true` in qgsd.json, before falling through to API slots.

Purpose: Ensure HTTP provider health is actually checked before quorum dispatch, and that sub slots are preferentially dispatched when configured.
Output: Fixed `bin/check-provider-health.cjs` (line 134) and updated `agents/qgsd-quorum-orchestrator.md` Step 1 with explicit preferSub ordering.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/check-provider-health.cjs
@agents/qgsd-quorum-orchestrator.md
@.planning/quick/quorum-debug-latest.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix check-provider-health.cjs binary name filter</name>
  <files>bin/check-provider-health.cjs</files>
  <action>
At line 134 in `bin/check-provider-health.cjs`, remove the args-based filter:

```js
// REMOVE THIS LINE:
if (!cfg.args?.some(a => a.includes('claude-mcp-server'))) continue;
```

Replace with a comment explaining the real discriminator:

```js
// HTTP slots are identified by ANTHROPIC_BASE_URL presence (checked below).
// Subprocess slots (codex-1, gemini-1, etc.) have no ANTHROPIC_BASE_URL and are filtered by the !baseUrl guard.
```

The `!baseUrl` guard on line 139 already correctly excludes subprocess slots. The removed `args` filter was the only thing preventing HTTP slots (claude-1..claude-6, which use `unified-mcp-server.mjs`) from being included in the providers map.

After the change the loop body reads:
```js
for (const [name, cfg] of Object.entries(activeMcpServers)) {
  // HTTP slots are identified by ANTHROPIC_BASE_URL presence (checked below).
  // Subprocess slots (codex-1, gemini-1, etc.) have no ANTHROPIC_BASE_URL and are filtered by the !baseUrl guard.
  const env     = cfg.env ?? {};
  const baseUrl = env.ANTHROPIC_BASE_URL;
  const apiKey  = env.ANTHROPIC_API_KEY;
  const model   = env.CLAUDE_DEFAULT_MODEL ?? '?';
  if (!baseUrl) continue;
  ...
}
```

Do NOT touch anything else in the file — no cache logic, no probe logic, no output formatting.
  </action>
  <verify>
Run: `node bin/check-provider-health.cjs --json 2>/dev/null`

Expected: JSON output contains a `providers` key (or similar structure) with entries corresponding to claude-1 through claude-6 base URLs. Previously it would print "No claude-mcp-server instances with ANTHROPIC_BASE_URL found." — that message must NOT appear.

Also run: `node bin/check-provider-health.cjs 2>/dev/null`
Expected: Human-readable table showing provider URLs, not the "No instances found" early exit.
  </verify>
  <done>
`node bin/check-provider-health.cjs --json` returns non-empty provider data for the HTTP slots (claude-1..claude-6). The "No claude-mcp-server instances" message no longer appears.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add preferSub ordering to orchestrator Step 1</name>
  <files>agents/qgsd-quorum-orchestrator.md</files>
  <action>
In `agents/qgsd-quorum-orchestrator.md`, locate Step 1's **Pre-flight slot skip** block — specifically the line:

```
- Reorder: healthy servers first (preserving discovery order within each group).
```

Replace that single reorder bullet with an expanded ordering block that applies preferSub BEFORE the healthy/unhealthy split:

```
- **preferSub ordering:** Read `quorum.preferSub` from `~/.claude/qgsd.json` (project config takes precedence). If `preferSub=true`, read `agent_config` from the same config and sort the working slot list: slots with `auth_type=sub` first, then slots with `auth_type=api` (stable sort, preserving original order within each group). This ensures subscription CLI slots (codex-1, gemini-1, opencode-1, copilot-1) are always attempted before API slots regardless of providers.json discovery order.
- **Reorder:** Within the sub group and within the api group separately, healthy servers first (preserving relative order within healthy/unhealthy subgroups).
```

Add the preferSub read snippet immediately before the reorder instruction, as an inline bash block so the orchestrator can execute it:

```bash
node -e "
const fs = require('fs'), os = require('os'), path = require('path');
const globalCfg = path.join(os.homedir(), '.claude', 'qgsd.json');
const projCfg   = path.join(process.cwd(), '.claude', 'qgsd.json');
let cfg = {};
for (const f of [globalCfg, projCfg]) {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch(_) {}
}
const preferSub  = cfg.quorum && cfg.quorum.preferSub === true;
const agentCfg   = cfg.agent_config || {};
console.log(JSON.stringify({ preferSub, agentCfg }));
"
```

Store result as `$PREFER_SUB_CONFIG`. Then apply the sort:
- If `$PREFER_SUB_CONFIG.preferSub` is true: partition working slot list into `subSlots` (auth_type=sub) and `apiSlots` (auth_type=api or missing). Within each partition, healthy before unhealthy. Final order: healthy-sub, unhealthy-sub, healthy-api, unhealthy-api.
- If `$PREFER_SUB_CONFIG.preferSub` is false or absent: existing behavior — healthy first, unhealthy last, discovery order preserved.

Place this bash block and ordering description inside the **Pre-flight slot skip** section in Step 1, after the UNAVAIL logging and before the "Log: Active slots:" line.

Do NOT change Mode A call order list, Mode B, scoreboard commands, or anything outside Step 1.
  </action>
  <verify>
Read the updated file and confirm:
1. Step 1 contains a bash snippet reading `quorum.preferSub` and `agent_config` from qgsd.json.
2. The ordering description explicitly mentions `auth_type=sub` first when `preferSub=true`.
3. The phrase "Reorder: healthy servers first (preserving discovery order within each group)" is no longer a standalone bullet — it has been replaced or augmented with the preferSub-aware ordering.
4. The Mode A call order section (codex-1, codex-2, gemini-1... then claude-1..claude-6) is unchanged.
  </verify>
  <done>
Step 1 of the orchestrator includes: (a) a bash snippet that reads preferSub + agent_config, (b) a clear sorting rule that places sub slots before api slots when preferSub=true, (c) healthy-within-group ordering preserved. The Mode A/Mode B call sections are unmodified.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. `node bin/check-provider-health.cjs --json` returns provider health data for HTTP slots (claude-1..claude-6) — not the empty-exit message.
2. `grep -n 'preferSub' agents/qgsd-quorum-orchestrator.md` returns at least 3 matches (the read, the condition, and the sort description).
3. `grep -n 'claude-mcp-server' bin/check-provider-health.cjs` returns 0 matches (the faulty filter is gone).
</verification>

<success_criteria>
- check-provider-health.cjs no longer exits early with "No claude-mcp-server instances" — HTTP providers (claude-1..claude-6) are correctly detected via ANTHROPIC_BASE_URL.
- Orchestrator Step 1 explicitly implements preferSub ordering: sub slots (codex-1, gemini-1, opencode-1, copilot-1) are always dispatched before API slots when quorum.preferSub=true.
</success_criteria>

<output>
After completion, create `.planning/quick/90-fix-two-quorum-bugs-check-provider-healt/90-SUMMARY.md`
</output>
