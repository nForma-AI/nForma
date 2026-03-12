---
name: nf:mcp-repair
description: Auto-diagnose and repair quorum slot connectivity — restarts MCP servers, checks CLI binaries, deep inference probes, reports unfixable issues
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
  - mcp__codex-1__deep_health_check
  - mcp__gemini-1__deep_health_check
  - mcp__opencode-1__deep_health_check
  - mcp__copilot-1__deep_health_check
  - mcp__claude-1__deep_health_check
  - mcp__claude-2__deep_health_check
  - mcp__claude-3__deep_health_check
  - mcp__claude-4__deep_health_check
  - mcp__claude-5__deep_health_check
  - mcp__claude-6__deep_health_check
---

<objective>
Auto-diagnose all quorum slot connectivity issues and apply automatic repairs where possible.

When quorum slots fail (MCP servers down, CLI auth expired, quota exhausted), users currently must manually diagnose and fix each one. This command automates the diagnosis-repair-verify cycle using a 4-step diagnostic:

1. **Diagnose** — collect identity + health_check + deep_health_check from all configured slots
2. **Classify** — categorize each slot's failure mode using layered probe results
3. **Auto-repair** — restart downed services (service.start for ccr slots) and MCP servers (pkill + reconnect)
4. **Guide** — provide actionable instructions for non-auto-fixable issues
5. **Verify** — re-check repaired slots to confirm fix
6. **Summarize** — show before/after health comparison

This command is read-only except for the service restart and pkill restart actions. It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

> **IMPORTANT: Run every Bash call in this workflow sequentially (one at a time). Never issue two Bash calls in parallel. A failure in one parallel sibling cancels all other parallel siblings — sequential execution isolates failures.**

## Step 1 — Initial diagnosis (before state)

Read the slot list from `bin/providers.json` to determine how many slots to diagnose:

```bash
node << 'NF_EVAL'
const p = JSON.parse(require("fs").readFileSync("bin/providers.json","utf8"));
const slots = p.providers.filter(function(s) { return s.name && s.name !== "unified-1"; });
console.log(slots.length);
NF_EVAL
```

Store the count as `$SLOT_COUNT`.

Display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► MCP REPAIR (4-step diagnostic)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Diagnosing $SLOT_COUNT quorum slots...
```

Invoke a Task() sub-agent to call all MCP identity + health_check + deep_health_check tools. This prevents raw tool-result blocks from cluttering the main conversation.

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
21. mcp__codex-1__deep_health_check   — store result as codex_1_deep
22. mcp__gemini-1__deep_health_check  — store result as gemini_1_deep
23. mcp__opencode-1__deep_health_check — store result as opencode_1_deep
24. mcp__copilot-1__deep_health_check — store result as copilot_1_deep
25. mcp__claude-1__deep_health_check  — store result as claude_1_deep
26. mcp__claude-2__deep_health_check  — store result as claude_2_deep
27. mcp__claude-3__deep_health_check  — store result as claude_3_deep
28. mcp__claude-4__deep_health_check  — store result as claude_4_deep
29. mcp__claude-5__deep_health_check  — store result as claude_5_deep
30. mcp__claude-6__deep_health_check  — store result as claude_6_deep

Return ONLY this JSON structure (no markdown, no explanation):
{
  "codex-1":    { "identity": <codex_id or null>,    "hc": <codex_hc or null>,    "deep": <codex_1_deep or null> },
  "gemini-1":   { "identity": <gemini_id or null>,   "hc": <gemini_hc or null>,   "deep": <gemini_1_deep or null> },
  "opencode-1": { "identity": <opencode_id or null>, "hc": <opencode_hc or null>, "deep": <opencode_1_deep or null> },
  "copilot-1":  { "identity": <copilot_id or null>,  "hc": <copilot_hc or null>,  "deep": <copilot_1_deep or null> },
  "claude-1":   { "identity": <claude1_id or null>,  "hc": <claude1_hc or null>,  "deep": <claude_1_deep or null> },
  "claude-2":   { "identity": <claude2_id or null>,  "hc": <claude2_hc or null>,  "deep": <claude_2_deep or null> },
  "claude-3":   { "identity": <claude3_id or null>,  "hc": <claude3_hc or null>,  "deep": <claude_3_deep or null> },
  "claude-4":   { "identity": <claude4_id or null>,  "hc": <claude4_hc or null>,  "deep": <claude_4_deep or null> },
  "claude-5":   { "identity": <claude5_id or null>,  "hc": <claude5_hc or null>,  "deep": <claude_5_deep or null> },
  "claude-6":   { "identity": <claude6_id or null>,  "hc": <claude6_hc or null>,  "deep": <claude_6_deep or null> }
}

Where each identity value is the raw object returned by the tool (with at minimum version and model fields), each hc value is the raw object returned by health_check (with healthy, latencyMs, and optionally model, via fields), and each deep value is the raw object returned by deep_health_check (with healthy, latencyMs, layer, error fields).
"""
)
```

Store the sub-agent's returned JSON object as `$BEFORE_STATE`.

## Step 2 — 4-step diagnostic classification

### Step 2a — Shallow check (existing health_check)

Use results from `$BEFORE_STATE`. If identity is null and health_check is null, the slot is unreachable.

### Step 2b — Service status check

For slots that have `service` config in providers.json (claude-1..6), check service status:

```bash
node << 'NF_EVAL'
var fs = require("fs");
var cp = require("child_process");
var providers = JSON.parse(fs.readFileSync("bin/providers.json", "utf8"));
var result = {};
providers.providers.forEach(function(p) {
  if (p.service && p.service.status) {
    try {
      var out = cp.execFileSync(p.service.status[0], p.service.status.slice(1), {encoding:"utf8", timeout: 5000});
      result[p.name] = out.trim();
    } catch(e) {
      result[p.name] = "error: " + (e.message || "unknown");
    }
  }
});
console.log(JSON.stringify(result));
NF_EVAL
```

If any service reports not-running/stopped, classify as SERVICE_DOWN and attempt auto-start:

```bash
# For each SERVICE_DOWN slot, run the start command then poll status
node << 'NF_EVAL'
var fs = require("fs");
var cp = require("child_process");
var providers = JSON.parse(fs.readFileSync("bin/providers.json", "utf8"));
var downSlots = providers.providers.filter(function(p) {
  if (!p.service || !p.service.status) return false;
  try {
    var out = cp.execFileSync(p.service.status[0], p.service.status.slice(1), {encoding:"utf8", timeout: 5000});
    return out.toLowerCase().includes("not running") || out.toLowerCase().includes("stopped");
  } catch(e) { return true; }
});
downSlots.forEach(function(p) {
  console.log("Restarting " + p.name + "...");
  try {
    cp.execFileSync(p.service.start[0], p.service.start.slice(1), {encoding:"utf8", timeout: 10000});
  } catch(e) {
    console.log("Restarting " + p.name + "... FAILED: " + e.message);
    return;
  }
  // Poll status every 1s, up to 10s total
  var ok = false;
  for (var i = 0; i < 10; i++) {
    cp.execFileSync("sleep", ["1"]);
    try {
      var status = cp.execFileSync(p.service.status[0], p.service.status.slice(1), {encoding:"utf8", timeout: 3000});
      if (!status.toLowerCase().includes("not running") && !status.toLowerCase().includes("stopped")) {
        ok = true;
        break;
      }
    } catch(e) { /* continue polling */ }
  }
  console.log("Restarting " + p.name + "... " + (ok ? "OK" : "FAILED"));
});
if (downSlots.length === 0) console.log("All services running.");
NF_EVAL
```

### Step 2c — Deep probe

Use the `deep` field from `$BEFORE_STATE` for each slot. The deep_health_check result contains `{ healthy, latencyMs, layer, error }` where `layer` classifies the failure point.

### Step 2d — Final classification

Combine results from all 4 steps to classify each slot:

Check CLI binary existence using three-tier resolution:

```bash
node << 'NF_EVAL'
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
NF_EVAL
```

Store as `$BINARY_STATUS`.

For each slot, apply the combined classification using the deep_health_check layer as the primary signal:

| Layer from deep_health_check | Category | Auto-fixable? |
|---|---|---|
| INFERENCE_OK | healthy | No action needed |
| BINARY_MISSING | cli-missing | NO — tell user to install |
| SERVICE_DOWN | service-down | YES — auto-start attempted in Step 2b |
| AUTH_EXPIRED | auth-expired | NO — tell user to re-auth |
| QUOTA_EXCEEDED | quota-exceeded | NO — report wait time |
| INFERENCE_TIMEOUT | timeout | NO — suggest /nf:mcp-restart |

Fallback classification (when deep_health_check result is null/unavailable):

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

Render a diagnosis table with columns: Slot | Type | Layer | Status | Issue | Action.

```
┌─────────────┬──────────┬──────────────────┬──────────┬─────────────────────┬──────────────────────────────┐
│ Slot        │ Type     │ Layer            │ Status   │ Issue               │ Action                       │
├─────────────┼──────────┼──────────────────┼──────────┼─────────────────────┼──────────────────────────────┤
│ codex-1     │ CLI      │ INFERENCE_OK     │ healthy  │ —                   │ —                            │
│ gemini-1    │ CLI      │ QUOTA_EXCEEDED   │ quota    │ 429 rate limited    │ wait ~30min                  │
│ claude-1    │ MCP      │ SERVICE_DOWN     │ down     │ service stopped     │ auto-restarting              │
│ ...         │          │                  │          │                     │                              │
└─────────────┴──────────┴──────────────────┴──────────┴─────────────────────┴──────────────────────────────┘
```

Slot Type is determined from providers.json: slots with `mainTool` field = `CLI`, without = `MCP`.

Count healthy vs unhealthy: `M/$SLOT_COUNT healthy`

## Step 4 — Auto-repair: restart downed services and MCP servers

### Service auto-start (ccr slots)

For each slot classified as `service-down` with `service.start` config in providers.json:

1. Print "Restarting <slot>..."
2. Run `service.start` command
3. Poll status every 1s, up to 10s total (do NOT use a hardcoded sleep)
4. Print "Restarting <slot>... OK" or "Restarting <slot>... FAILED" based on poll result
5. Re-run deep_health_check to verify:

```
Task(
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: """
Call mcp__<slot>__deep_health_check({}) and return the raw result JSON.
"""
)
```

### MCP server restart (pkill for mcp-down slots)

For each slot classified as `mcp-down` (claude-1..6 only, when service auto-start did not resolve):

1. Read `~/.claude.json` to find the exact process command/path for that slot's MCP server entry (same logic as mcp-restart.md Step 3):

```bash
AGENT="<slot-name>" node << 'NF_EVAL'
var fs = require("fs"), path = require("path"), os = require("os");
var cj = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
var sc = (cj.mcpServers || {})[process.env.AGENT];
if (sc === undefined) { process.stderr.write("not configured\n"); process.exit(2); }
var cmd = sc.command, args = sc.args || [];
if (cmd === "node" && args.length > 0) console.log(JSON.stringify({type:"local",processPath:args[0]}));
else if (cmd === "npx" || cmd === "npm") console.log(JSON.stringify({type:"npx",packageName:args[args.length-1]}));
else console.log(JSON.stringify({type:"unknown",command:cmd}));
NF_EVAL
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

If any auto-repairs were attempted in Step 4, re-run identity + health_check + deep_health_check on ONLY the repaired slots using a Task() sub-agent (same pattern as Step 1, but listing only the repaired slot tools).

Store as `$AFTER_STATE`.

If no repairs were attempted, skip this step.

## Step 7 — Before/after summary

**If repairs were attempted:**

```
━━━ REPAIR SUMMARY ━━━

  Before: M/N healthy
  After:  P/N healthy

  Repaired:
    claude-1: SERVICE_DOWN → INFERENCE_OK
    claude-3: SERVICE_DOWN → INFERENCE_OK

  Still broken (manual action needed):
    gemini-1: QUOTA_EXCEEDED — wait ~30min
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
- Diagnosis table shows Slot | Type | Layer | Status | Issue | Action for every slot
- Deep inference probe (deep_health_check) used for comprehensive diagnosis
- Service auto-start attempted for SERVICE_DOWN slots with service.start config
- Auto-start uses polling loop (1s interval, 10s max) instead of hardcoded sleep
- Auto-start prints "Restarting <slot>... OK/FAILED" for user visibility
- CLI binary existence checked via three-tier resolution (providers.json cli field, which fallback, missing)
- Downed MCP servers (claude-1..6) auto-repaired via pkill using exact process path from ~/.claude.json
- Non-auto-fixable issues (auth, quota, missing binary, timeout) produce actionable user guidance
- Before/after summary shows health improvement metrics after repairs
- Task() sub-agent pattern used for MCP tool calls (keeps raw output out of conversation)
- Sub-agent return JSON includes "deep" field per slot
- Sequential Bash execution pattern followed throughout
- No quorum invariants violated (observational + restart only)
</success_criteria>
