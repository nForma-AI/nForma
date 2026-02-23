---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — name, version, model, health, endpoint latency, available models, and UNAVAIL count from the scoreboard
allowed-tools:
  - Read
  - Bash
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
---

<objective>
Display a formatted status table of all connected MCP quorum agents. For CLI agents (codex-1, gemini-1, opencode-1, copilot-1): call their identity tool to get live name/version/model/available_models. For HTTP agents (claude-1..6): call their identity tool for model info, then call health_check for real-time endpoint health. Read UNAVAIL count from the quorum scoreboard and derive health state.

For claude-1 through claude-6 (HTTP agents), health reflects live health_check results — NOT historical UNAVAIL counts. UNAVAIL count is shown in the UNAVAIL column for context only.

This command is read-only (observation only). It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

> **IMPORTANT: Run every Bash call in this workflow sequentially (one at a time). Never issue two Bash calls in parallel. A failure in one parallel sibling cancels all other parallel siblings — sequential execution isolates failures. For each numbered step below: run this Bash command alone, wait for its full output, store the result, then proceed to the next step.**

## Step 1: Read UNAVAIL counts from scoreboard (run this Bash command first, wait for output before proceeding to Step 2)

Run the following Bash command and store the output as SCOREBOARD_INFO:

```bash
node << 'EOF'
const fs=require('fs');
const path=require('path');
const p=path.join(process.cwd(),'.planning','quorum-scoreboard.json');
if(!fs.existsSync(p)){console.log(JSON.stringify({counts:{},totalRounds:0,lastUpdate:null}));process.exit(0);}
const d=JSON.parse(fs.readFileSync(p,'utf8'));
const counts={};
for(const r of d.rounds||[]){
  for(const [m,v] of Object.entries(r.votes||{})){
    if(v==='UNAVAIL')counts[m]=(counts[m]||0)+1;
  }
}
const info={counts,totalRounds:(d.rounds||[]).length,lastUpdate:d.team?.captured_at||null};
console.log(JSON.stringify(info));
EOF
```

Parse `counts` (object: scoreboard key → UNAVAIL count), `totalRounds`, `lastUpdate`.

The scoreboard may use two key formats:
- **Old simple keys**: `deepseek`, `minimax`, `qwen-coder`, `kimi`, `llama4`, `glm`
- **New composite keys**: `claude-1:deepseek-ai/DeepSeek-V3.2`, `claude-2:MiniMaxAI/MiniMax-M2.5`, etc.

For HTTP agents, derive UNAVAIL count using: `Math.max(counts[slot] || 0, counts[simpleKey] || 0, counts[slot + ':' + model] || 0)` where `simpleKey` is the old key mapped from the slot:

| Slot     | Old Simple Key |
|----------|---------------|
| claude-1 | deepseek      |
| claude-2 | minimax       |
| claude-3 | qwen-coder    |
| claude-4 | kimi          |
| claude-5 | llama4        |
| claude-6 | glm           |

If scoreboard file does not exist, treat all counts as 0.

## Step 2: Display banner (run this Bash command second, after Step 1 output is stored; wait for output before proceeding to Step 3)

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Querying 4 CLI agents + 6 HTTP providers...
```

## Step 3: Call identity (and health_check for claude-N) on each agent (sequential — one at a time, never parallel; after Step 2 output is stored)

For each of the 10 agents below, call their identity tool with `{}` as input. Wrap each call in try/catch — on error, mark health=`error` and fill version/model/available_models with `—`. Never let a single agent failure abort the loop.

**Agent list and tool mapping (complete — 10 agents):**

| Display Name | Identity Tool              | health_check Tool              | Scoreboard Key |
|---|---|---|---|
| codex-1      | mcp__codex-1__identity     | — (none)                       | codex          |
| gemini-1     | mcp__gemini-1__identity    | — (none)                       | gemini         |
| opencode-1   | mcp__opencode-1__identity  | — (none)                       | opencode       |
| copilot-1    | mcp__copilot-1__identity   | — (none)                       | copilot        |
| claude-1     | mcp__claude-1__identity    | mcp__claude-1__health_check    | deepseek       |
| claude-2     | mcp__claude-2__identity    | mcp__claude-2__health_check    | minimax        |
| claude-3     | mcp__claude-3__identity    | mcp__claude-3__health_check    | qwen-coder     |
| claude-4     | mcp__claude-4__identity    | mcp__claude-4__health_check    | kimi           |
| claude-5     | mcp__claude-5__identity    | mcp__claude-5__health_check    | llama4         |
| claude-6     | mcp__claude-6__identity    | mcp__claude-6__health_check    | glm            |

After each successful identity call, parse the JSON response to extract: `name`, `version`, `model`, `available_models`, `install_method`. If `available_models` has more than 3 entries, display the first 3 joined by ", " followed by ", ..." truncation. If `available_models` is empty or null, display `—`.

**For claude-1 through claude-6 (HTTP agents):** After calling identity, also call the corresponding `health_check` tool with `{}` as input. Wrap in try/catch — on error or timeout, set `hc = null`. On success, extract `hc.healthy` (boolean), `hc.latencyMs` (number), and `hc.model` (string).

**For CLI agents (codex-1, gemini-1, opencode-1, copilot-1):** Do NOT call health_check — there is no such tool for them. Set `hc = null` for these agents.

## Step 4: Derive health state per agent

Health derivation uses two separate paths depending on agent type:

**For CLI agents (codex-1, gemini-1, opencode-1, copilot-1) — scoreboard-based:**
- If identity call threw an exception or returned an error → health = `error`, latency = `—`
- Else if `(counts[scoreboardKey] || 0) > 0` → health = `quota-exceeded`, latency = `—`
- Else → health = `available`, latency = `—`

**For HTTP agents (claude-1 through claude-6) — live health_check result:**
- If identity call threw an exception or returned an error → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `unreachable`, latency = `—`
- Else if `hc.healthy === false` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

Note: UNAVAIL count from the scoreboard is still shown in the UNAVAIL column for context, but does NOT drive the health field for claude-N agents. A high UNAVAIL count just means the agent had past quota issues — it does NOT mean it is unavailable right now.

## Step 5: Render formatted table

Display the table with these columns: Agent | Version | Model | Health | Latency | Available Models | UNAVAIL

Example output format:

```
┌─────────────────────┬─────────┬────────────────────────────────┬────────────────┬─────────┬───────────────────────────────┬─────────┐
│ Agent               │ Version │ Model                          │ Health         │ Latency │ Available Models              │ UNAVAIL │
├─────────────────────┼─────────┼────────────────────────────────┼────────────────┼─────────┼───────────────────────────────┼─────────┤
│ codex-1             │ 1.2.3   │ codex                          │ quota-exceeded │ —       │ codex, o3-mini, gpt-4o, ...   │ 56      │
│ gemini-1            │ 1.1.0   │ gemini-3-pro-preview           │ quota-exceeded │ —       │ gemini-3-pro, flash, ...      │ 34      │
│ opencode-1          │ 1.0.0   │ claude-sonnet-4-6              │ available      │ —       │ claude-sonnet-4-6, gpt-4o     │ 4       │
│ copilot-1           │ 1.2.0   │ gpt-4.1                        │ available      │ —       │ gpt-4.1, gpt-4o, claude-3.5   │ 0       │
│ claude-1            │ 1.0.0   │ deepseek-ai/DeepSeek-V3.2      │ available      │ 312ms   │ —                             │ 14      │
│ claude-2            │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5         │ available      │ 480ms   │ —                             │ 14      │
│ claude-3            │ 1.0.0   │ Qwen/Qwen3-Coder-480B-A35B     │ unhealthy      │ 9800ms  │ —                             │ 9       │
│ claude-4            │ 1.0.0   │ accounts/fireworks/models/kimi │ available      │ 220ms   │ —                             │ 14      │
│ claude-5            │ 1.0.0   │ meta-llama/Llama-4-Maverick    │ unreachable    │ —       │ —                             │ 10      │
│ claude-6            │ 1.0.0   │ accounts/fireworks/models/glm  │ available      │ 670ms   │ —                             │ 7       │
└─────────────────────┴─────────┴────────────────────────────────┴─────────────────┴─────────┴───────────────────────────────┴─────────┘

Scoreboard: {totalRounds} rounds recorded | Last update: {lastUpdate}
```

If scoreboard file was absent (empty counts), show instead:
```
Scoreboard: no data yet (run /qgsd:quorum first to populate)
```

Health legend:
- `available` — agent is responsive and reachable right now
- `quota-exceeded` — UNAVAIL count > 0 in scoreboard (CLI agents only)
- `unhealthy` — HTTP agent endpoint returned healthy=false from health_check
- `unreachable` — HTTP agent health_check call failed (timeout, connection error)
- `error` — identity call failed (agent not running or crashed)

</process>

<success_criteria>
- All 10 agents shown (4 CLI via identity call + 6 HTTP via identity + health_check)
- Health for claude-1..6 is live from health_check (NOT from UNAVAIL count)
- Health for CLI agents (codex/gemini/opencode/copilot) remains scoreboard-derived (quota-exceeded if UNAVAIL > 0)
- Latency column shows ms for claude-N agents from health_check, — for CLI agents
- `unreachable` state shown when health_check call itself fails (null hc)
- `unhealthy` state shown when health_check returns healthy: false
- UNAVAIL count still shown per agent in UNAVAIL column (for context/history)
- UNAVAIL count handles both old simple keys (deepseek) and new composite keys (claude-1:deepseek-ai/DeepSeek-V3.2)
- CLI agents use current slot names: codex-1, gemini-1, opencode-1, copilot-1
- Command handles missing scoreboard gracefully (no crash)
- Command handles individual agent identity or health_check failures gracefully (no crash)
</success_criteria>
