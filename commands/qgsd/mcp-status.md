---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — provider, model, health, and latency
allowed-tools:
  - Read
  - Bash
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
  - mcp__claude-1__health_check
  - mcp__claude-2__health_check
  - mcp__claude-3__health_check
  - mcp__claude-4__health_check
  - mcp__claude-5__health_check
  - mcp__claude-6__health_check
  - mcp__codex-1__health_check
  - mcp__gemini-1__health_check
  - mcp__opencode-1__health_check
  - mcp__copilot-1__health_check
---

<objective>
Display a clean status table of all connected MCP quorum agents plus the Claude orchestrator. For CLI agents (codex-1, gemini-1, opencode-1, copilot-1): call their identity tool and health_check for real model names and latency. For HTTP agents (claude-1..6): call their identity tool then health_check for real-time endpoint health. Read provider URLs from ~/.claude.json. Show a claude orchestrator row at the top of the table.

This command is read-only (observation only). It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

> **IMPORTANT: Run every Bash call in this workflow sequentially (one at a time). Never issue two Bash calls in parallel. A failure in one parallel sibling cancels all other parallel siblings — sequential execution isolates failures. For each numbered step below: run this Bash command alone, wait for its full output, store the result, then proceed to the next step.**

## Step 1: Read scoreboard + provider URLs (run this Bash command first, wait for output before proceeding to Step 2)

Run the following Bash command and store the output as INIT_INFO:

```bash
node << 'EOF'
const fs=require('fs'), path=require('path'), os=require('os');

// Scoreboard
const sbPath=path.join(process.cwd(),'.planning','quorum-scoreboard.json');
let totalRounds=0, lastUpdate=null;
if(fs.existsSync(sbPath)){
  const d=JSON.parse(fs.readFileSync(sbPath,'utf8'));
  totalRounds=(d.rounds||[]).length;
  lastUpdate=d.team?.captured_at||null;
}

// Provider URLs from ~/.claude.json
const URL_MAP={
  'https://api.akashml.com/v1':           'AkashML',
  'https://api.together.xyz/v1':          'Together.xyz',
  'https://api.fireworks.ai/inference/v1':'Fireworks',
};
const cfgPath=path.join(os.homedir(),'.claude.json');
const providers={};
if(fs.existsSync(cfgPath)){
  const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8'));
  for(const [key,val] of Object.entries(cfg.mcpServers||{})){
    const url=(val.env||{}).ANTHROPIC_BASE_URL||null;
    providers[key]=url?URL_MAP[url]||url:null;
  }
}

// Claude orchestrator model from ~/.claude/settings.json
const claudeSettingsPath=path.join(os.homedir(),'.claude','settings.json');
let claudeModel='claude-sonnet-4-6'; // default
if(fs.existsSync(claudeSettingsPath)){
  try {
    const cs=JSON.parse(fs.readFileSync(claudeSettingsPath,'utf8'));
    const raw=(cs.model||'sonnet').toLowerCase();
    if(raw.includes('opus')) claudeModel='claude-opus-4-6';
    else if(raw.includes('haiku')) claudeModel='claude-haiku-4-5-20251001';
    else claudeModel='claude-sonnet-4-6';
  } catch(_){}
}

console.log(JSON.stringify({totalRounds,lastUpdate,providers,claudeModel}));
EOF
```

Parse `totalRounds`, `lastUpdate`, `providers` (map of slot → provider name or null), and `claudeModel`.

**Provider for CLI agents** — prefer `identity.display_provider` when present. If absent, infer from model name:
- `gpt-*` or `o[0-9]*` → OpenAI
- `gemini-*` → Google
- `claude-*` → Anthropic
- `opencode*` or `grok*` → OpenCode
- default → —

**Auth type** — read from identity response `auth_type` field if present. If absent, infer:
- CLI agents (codex-1, gemini-1, opencode-1, copilot-1) → `sub` (subscription — flat fee, no per-token cost)
- HTTP agents (claude-1..6) → `api` (API token — pay per request)

Display as `sub` or `api` in the Auth column.

## Step 2: Display banner (run this Bash command second, after Step 1 output is stored; wait for output before proceeding to Step 3)

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Querying 4 CLI agents + 6 HTTP providers...
```

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

Where each identity value is the raw object returned by the tool (with at minimum `version` and `model` fields), and each hc value is the raw object returned by health_check (with `healthy`, `latencyMs`, and optionally `model`, `via` fields).
"""
)
```

Store the sub-agent's returned JSON object as AGENT_RESULTS (parse from the sub-agent's text output).

For each slot in AGENT_RESULTS:
- `identity` = the identity result (or null if the sub-agent recorded null)
- `hc` = the health_check result (or null)

Use these values in Step 4 exactly as before — the shape is identical to what the old direct tool calls returned.

## Step 4: Derive health state per agent

**For CLI agents — identity + health_check based:**
- If identity call threw an exception → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `available`, latency = `—`
- Else if `!hc.healthy` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

Model for CLI agents: use `identity.model` if present (real model name from model_detect or static), else `identity.display_provider ?? identity.provider`.

**For HTTP agents (claude-1 through claude-6) — live health_check result:**
- If identity call threw an exception → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `unreachable`, latency = `—`
- Else if `hc.healthy === false` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else if `hc.via === 'fallback'` → health = `fallback`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

When `hc.via === 'fallback'`, the displayed Model should be `hc.model` (the fallback model) rather than the primary model from identity, since that's what actually responded.

## Step 5: Render formatted table

Collect all results then render **one table** via a single Bash call (do not print rows one at a time). Pass the collected data as a JSON string into the script.

Columns: **Agent | Auth | Provider | Model | Health | Latency**

Auto-size each column to the widest value (including header). Use box-drawing characters for borders.

Before rendering, prepend a claude orchestrator row at the TOP of the table. This row does NOT come from AGENT_RESULTS — it comes from INIT_INFO:
- Agent: `claude`
- Auth: `api`
- Provider: `Anthropic`
- Model: `claudeModel` (from INIT_INFO, e.g. `claude-sonnet-4-6`)
- Health: `orchestrator`
- Latency: `—`

Example output format:

```
┌─────────────┬──────┬──────────────┬───────────────────────────────────────────────────┬──────────────┬─────────┐
│ Agent       │ Auth │ Provider     │ Model                                             │ Health       │ Latency │
├─────────────┼──────┼──────────────┼───────────────────────────────────────────────────┼──────────────┼─────────┤
│ claude      │ api  │ Anthropic    │ claude-sonnet-4-6                                 │ orchestrator │ —       │
│ codex-1     │ sub  │ OpenAI       │ gpt-5.3-codex                                     │ available    │ 245ms   │
│ gemini-1    │ sub  │ Google       │ gemini-2.5-pro                                    │ available    │ 312ms   │
│ opencode-1  │ sub  │ OpenCode     │ xai/grok-3                                        │ available    │ 891ms   │
│ copilot-1   │ sub  │ GitHub       │ gpt-4.1                                           │ available    │ 1204ms  │
│ claude-1    │ api  │ AkashML      │ deepseek-ai/DeepSeek-V3.2                         │ available    │ 524ms   │
│ claude-2    │ api  │ AkashML      │ MiniMaxAI/MiniMax-M2.5                            │ available    │ 735ms   │
│ claude-3    │ api  │ Together.xyz │ Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8           │ available    │ 761ms   │
│ claude-4    │ api  │ Fireworks    │ accounts/fireworks/models/kimi-k2p5               │ available    │ 1828ms  │
│ claude-5    │ api  │ Together.xyz │ meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8 │ available    │ 20601ms │
│ claude-6    │ api  │ Fireworks    │ accounts/fireworks/models/glm-5                   │ fallback     │ 312ms   │
└─────────────┴──────┴──────────────┴───────────────────────────────────────────────────┴──────────────┴─────────┘

Scoreboard: 156 rounds recorded | Last update: 2026-02-23T14:23:52.301Z
```

If scoreboard file was absent, show instead:
```
Scoreboard: no data yet (run /qgsd:quorum first to populate)
```

Health legend:
- `available`   — agent responded (identity succeeded; for HTTP: health_check passed)
- `fallback`    — primary endpoint failed; fallback provider (ANTHROPIC_FALLBACK_BASE_URL) responded successfully
- `unhealthy`   — HTTP endpoint returned healthy=false
- `unreachable` — HTTP health_check call failed (timeout, connection error)
- `error`       — identity call failed (agent not running or crashed)

</process>

<success_criteria>
- All 11 rows shown in one clean table (1 orchestrator + 4 CLI + 6 HTTP)
- Columns: Agent | Auth | Provider | Model | Health | Latency (no UNAVAIL column)
- `claude` orchestrator row shown at top of table with model read from `~/.claude/settings.json`
- CLI agents show real model names (gpt-5.3-codex, gemini-2.5-pro, xai/grok-3, gpt-4.1) not binary names
- CLI agents show real latency in ms from `health_check` --version call
- CLI agent Provider column uses `identity.display_provider` (OpenAI, Google, OpenCode, GitHub)
- Provider derived from ~/.claude.json ANTHROPIC_BASE_URL for HTTP agents; identity.display_provider for CLI agents
- Health for CLI agents reflects identity + health_check result (available/unhealthy/error)
- Health for claude-1..6 is live from health_check result; `fallback` shown when primary failed but fallback responded
- Model column shows fallback model name (hc.model) when via=fallback, so it always reflects what actually served the check
- Latency shows ms for all agents with health_check, — for claude orchestrator row
- Command handles missing scoreboard gracefully (no crash)
- Command handles individual agent failures gracefully (no crash)
- Table rendered in a single Bash call at the end, not printed row-by-row
</success_criteria>
