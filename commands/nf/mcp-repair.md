---
name: nf:mcp-repair
description: Auto-diagnose and repair quorum slot connectivity — restarts MCP servers, checks CLI binaries, reports unfixable issues
allowed-tools:
  - Bash
  - Read
  - Task
  - mcp__codex-1__identity
  - mcp__gemini-1__identity
  - mcp__opencode-1__identity
  - mcp__copilot-1__identity
  - mcp__claude-1__identity
  - mcp__claude-2__identity
  - mcp__claude-3__identity
  - mcp__claude-4__identity
  - mcp__claude-5__identity
  - mcp__claude-6__identity
  - mcp__codex-1__health_check
  - mcp__gemini-1__health_check
  - mcp__opencode-1__health_check
  - mcp__copilot-1__health_check
  - mcp__claude-1__health_check
  - mcp__claude-2__health_check
  - mcp__claude-3__health_check
  - mcp__claude-4__health_check
  - mcp__claude-5__health_check
  - mcp__claude-6__health_check
---

<objective>
Auto-diagnose all quorum slot connectivity issues and apply automatic repairs where possible.

When quorum slots fail (MCP servers down, CLI auth expired, quota exhausted), users currently must manually diagnose and fix each one. This command automates the diagnosis-repair-verify cycle:

1. **Diagnose** — collect identity + health_check from all configured slots
2. **Classify** — categorize each slot's failure mode
3. **Auto-repair** — restart downed MCP servers (pkill + reconnect)
4. **Guide** — provide actionable instructions for non-auto-fixable issues
5. **Verify** — re-check repaired slots to confirm fix
6. **Summarize** — show before/after health comparison

This command is read-only except for the pkill restart action on MCP servers. It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

> **IMPORTANT: Run every Bash call in this workflow sequentially (one at a time). Never issue two Bash calls in parallel. A failure in one parallel sibling cancels all other parallel siblings — sequential execution isolates failures.**

## Step 1 — Initial diagnosis (before state)

Read the slot list from `bin/providers.json` to determine how many slots to diagnose:

```bash
node -e '
const p = JSON.parse(require("fs").readFileSync("bin/providers.json","utf8"));
const slots = p.providers.filter(function(s) { return s.name && s.name !== "unified-1"; });
console.log(slots.length);
'
```

Store the count as `$SLOT_COUNT`.

Display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► MCP REPAIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Diagnosing $SLOT_COUNT quorum slots...
```

Invoke a Task() sub-agent to call all MCP identity + health_check tools. This prevents raw tool-result blocks from cluttering the main conversation.

```
Task(
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: """
You are a data-collection sub-agent. Your only job is to call the MCP tools listed below and return their results as a single JSON object. Do not explain or summarize — return only the JSON object.

Call each tool with {} as input. Wrap every call in try/catch — if a tool throws or is unavailable, record null for that field.

Tools to call in this order (call them one at a time, sequentially — never parallel):

1.  mcp__codex-1__identity          — store result as codex_id
2.  mcp__gemini-1__identity         — store result as gemini_id
3.  mcp__opencode-1__identity       — store result as opencode_id
4.  mcp__copilot-1__identity        — store result as copilot_id
5.  mcp__codex-1__health_check      — store result as codex_hc
6.  mcp__gemini-1__health_check     — store result as gemini_hc
7.  mcp__opencode-1__health_check   — store result as opencode_hc
8.  mcp__copilot-1__health_check    — store result as copilot_hc
9.  mcp__claude-1__identity         — store result as claude1_id
10. mcp__claude-1__health_check     — store result as claude1_hc
11. mcp__claude-2__identity         — store result as claude2_id
12. mcp__claude-2__health_check     — store result as claude2_hc
13. mcp__claude-3__identity         — store result as claude3_id
14. mcp__claude-3__health_check     — store result as claude3_hc
15. mcp__claude-4__identity         — store result as claude4_id
16. mcp__claude-4__health_check     — store result as claude4_hc
17. mcp__claude-5__identity         — store result as claude5_id
18. mcp__claude-5__health_check     — store result as claude5_hc
19. mcp__claude-6__identity         — store result as claude6_id
20. mcp__claude-6__health_check     — store result as claude6_hc

Return ONLY this JSON structure (no markdown, no explanation):
{
  "codex-1":    { "identity": <codex_id or null>,    "hc": <codex_hc or null> },
  "gemini-1":   { "identity": <gemini_id or null>,   "hc": <gemini_hc or null> },
  "opencode-1": { "identity": <opencode_id or null>, "hc": <opencode_hc or null> },
  "copilot-1":  { "identity": <copilot_id or null>,  "hc": <copilot_hc or null> },
  "claude-1":   { "identity": <claude1_id or null>,  "hc": <claude1_hc or null> },
  "claude-2":   { "identity": <claude2_id or null>,  "hc": <claude2_hc or null> },
  "claude-3":   { "identity": <claude3_id or null>,  "hc": <claude3_hc or null> },
  "claude-4":   { "identity": <claude4_id or null>,  "hc": <claude4_hc or null> },
  "claude-5":   { "identity": <claude5_id or null>,  "hc": <claude5_hc or null> },
  "claude-6":   { "identity": <claude6_id or null>,  "hc": <claude6_hc or null> }
}

Where each identity value is the raw object returned by the tool (with at minimum version and model fields), and each hc value is the raw object returned by health_check (with healthy, latencyMs, and optionally model, via fields).
"""
)
```

Store the sub-agent's returned JSON object as `$BEFORE_STATE`.

## Step 2 — Classify each slot's health

Check CLI binary existence using three-tier resolution:

```bash
node -e '
var fs = require("fs");
var cp = require("child_process");
var providers = JSON.parse(fs.readFileSync("bin/providers.json", "utf8"));
var result = {};
providers.providers.forEach(function(p) {
  if (p.cli && p.mainTool) {
    var found = false;
    try { found = fs.existsSync(p.cli); } catch(_) {}
    if (!found) {
      try { cp.execFileSync("which", [p.mainTool], {encoding:"utf8"}); found = true; } catch(_) {}
    }
    result[p.name] = found ? "found" : "missing";
  }
});
console.log(JSON.stringify(result));
'
```

Store as `$BINARY_STATUS`.

For each slot in `$BEFORE_STATE`, classify into a category:

| Category | Condition | Auto-fixable? |
|---|---|---|
| `healthy` | identity OK + health_check healthy | No action needed |
| `mcp-down` | identity null/threw (claude-1..6 only) | YES — pkill + reconnect |
| `cli-missing` | `$BINARY_STATUS[slot]` is "missing" | NO — tell user to install |
| `auth-expired` | identity OK but hc fails with 401/403 | NO — tell user to re-auth |
| `quota-exceeded` | identity OK but hc fails with 402/429 | NO — report wait time |
| `timeout` | identity or hc timed out (null result for CLI slots) | NO — suggest `/nf:mcp-restart <slot>` |
| `unknown` | any other failure | NO — report raw error |

Store classified results as `$DIAGNOSIS` (map of slot name to category).

## Step 3 — Display diagnosis table

Render a diagnosis table with columns: Slot | Type | Status | Issue | Action.

```
┌─────────────┬──────────┬──────────┬─────────────────────┬──────────────────────────────┐
│ Slot        │ Type     │ Status   │ Issue               │ Action                       │
├─────────────┼──────────┼──────────┼─────────────────────┼──────────────────────────────┤
│ codex-1     │ CLI      │ healthy  │ —                   │ —                            │
│ gemini-1    │ CLI      │ quota    │ 429 rate limited    │ wait ~30min                  │
│ claude-1    │ MCP      │ down     │ identity failed     │ auto-restarting              │
│ ...         │          │          │                     │                              │
└─────────────┴──────────┴──────────┴─────────────────────┴──────────────────────────────┘
```

Slot Type is determined from providers.json: slots with `mainTool` field = `CLI`, without = `MCP`.

Count healthy vs unhealthy: `M/$SLOT_COUNT healthy`

## Step 4 — Auto-repair: restart downed MCP servers

For each slot classified as `mcp-down` (claude-1..6 only):

1. Read `~/.claude.json` to find the exact process command/path for that slot's MCP server entry (same logic as mcp-restart.md Step 3):

```bash
AGENT="<slot-name>" node -e '
var fs = require("fs"), path = require("path"), os = require("os");
var cj = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
var sc = (cj.mcpServers || {})[process.env.AGENT];
if (sc === undefined) { process.stderr.write("not configured\n"); process.exit(2); }
var cmd = sc.command, args = sc.args || [];
if (cmd === "node" && args.length > 0) console.log(JSON.stringify({type:"local",processPath:args[0]}));
else if (cmd === "npx" || cmd === "npm") console.log(JSON.stringify({type:"npx",packageName:args[args.length-1]}));
else console.log(JSON.stringify({type:"unknown",command:cmd}));
'
```

2. Kill using the exact process path from ~/.claude.json — do NOT use broad patterns like `pkill -f "claude"` which would over-match:

**type = "local":**
```bash
pkill -f "$PROCESS_PATH" 2>/dev/null || true
```

**type = "npx":**
```bash
pkill -f "npm exec $PACKAGE_NAME" 2>/dev/null || true
sleep 0.5
pkill -f "$PACKAGE_NAME" 2>/dev/null || true
```

3. Wait 3 seconds for Claude Code to auto-restart:
```bash
sleep 3
```

4. Call the identity tool to verify reconnection:
`mcp__<slot>__identity`

Print progress: `Restarting <slot>... [OK|FAILED]`

If NO slots need auto-repair, print: `No auto-fixable issues found.`

**Deduplication note:** All claude-1..6 slots typically share one process (`unified-mcp-server.mjs`). If multiple claude-* slots are down, kill once and verify all. Avoid redundant kills of the same process.

## Step 5 — Report manual actions needed

For each non-auto-fixable slot, print specific guidance:

**cli-missing:**
```
<slot>: Binary not found. Install with:
  codex:    npm install -g @openai/codex
  gemini:   npm install -g @google/gemini-cli
  opencode: go install github.com/anthropics/opencode@latest
  copilot:  gh extension install github/gh-copilot
```

**auth-expired:**
```
<slot>: Auth expired. Run in a separate terminal:
  codex:    codex auth login
  gemini:   gemini auth login
  opencode: opencode auth login
  copilot:  gh auth login
```

**quota-exceeded:**
```
<slot>: Quota exceeded. Resets in ~30 minutes.
        Use --force-quorum to skip this slot.
```

**timeout:**
```
<slot>: Timed out (no auto-retry in v1).
        Run: /nf:mcp-restart <slot>
```

**unknown:**
```
<slot>: Unknown error: <raw error message from identity or health_check>
```

If no manual actions needed, skip this step.

## Step 6 — Post-repair verification (after state)

If any auto-repairs were attempted in Step 4, re-run identity + health_check on ONLY the repaired slots using a Task() sub-agent (same pattern as Step 1, but listing only the repaired slot tools).

Store as `$AFTER_STATE`.

If no repairs were attempted, skip this step.

## Step 7 — Before/after summary

**If repairs were attempted:**

```
━━━ REPAIR SUMMARY ━━━

  Before: M/N healthy
  After:  P/N healthy

  Repaired:
    claude-1: down → healthy
    claude-3: down → healthy

  Still broken (manual action needed):
    gemini-1: quota exceeded — wait ~30min
```

Where N = total configured slots from providers.json.

**If no repairs needed and all slots healthy:**

```
All N quorum slots healthy. No repairs needed.
```

**If no repairs needed but some slots broken (all non-auto-fixable):**

```
No auto-fixable issues found. Manual action needed for M slot(s) — see above.
```

</process>

<success_criteria>
- All configured slots from bin/providers.json are diagnosed (not a hardcoded count)
- Diagnosis table shows Slot | Type | Status | Issue | Action for every slot
- CLI binary existence checked via three-tier resolution (providers.json cli field, which fallback, missing)
- Downed MCP servers (claude-1..6) auto-repaired via pkill using exact process path from ~/.claude.json
- Non-auto-fixable issues (auth, quota, missing binary, timeout) produce actionable user guidance
- Before/after summary shows health improvement metrics after repairs
- Task() sub-agent pattern used for MCP tool calls (keeps raw output out of conversation)
- Sequential Bash execution pattern followed throughout
- No quorum invariants violated (observational + restart only)
</success_criteria>
