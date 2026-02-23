---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — name, version, model, health, latency, available models, and UNAVAIL count from the scoreboard
allowed-tools:
  - Read
  - Bash
  - mcp__codex-cli-1__identity
  - mcp__gemini-cli-1__identity
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
Display a formatted status table of all connected MCP quorum agents. For each agent: call its identity tool to get live name/version/model/available_models, read UNAVAIL count from the quorum scoreboard, and derive health state.

For claude-1 through claude-6 (HTTP agents), also call `health_check` after `identity` to get a live `{ healthy, latencyMs, model }` result from the actual HTTP API endpoint. Health for these agents reflects real-time reachability, not historical UNAVAIL counts.

For CLI agents (codex-cli-1, gemini-cli-1, opencode-1, copilot-1), health is derived from scoreboard UNAVAIL counts as before.

This command is read-only (observation only). It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

## Step 1: Read UNAVAIL counts from scoreboard

Run the following Bash command and store the output as SCOREBOARD_INFO:

node -e "
const fs=require('fs');
const p='.planning/quorum-scoreboard.json';
if(!fs.existsSync(p)){console.log('{}');process.exit(0);}
const d=JSON.parse(fs.readFileSync(p,'utf8'));
const counts={};
for(const r of d.rounds||[]){
  for(const [m,v] of Object.entries(r.votes||{})){
    if(v==='UNAVAIL')counts[m]=(counts[m]||0)+1;
  }
}
const info={counts,totalRounds:(d.rounds||[]).length,lastUpdate:d.team?.captured_at||null};
console.log(JSON.stringify(info));
"

Parse `counts` (object: model key → UNAVAIL count), `totalRounds`, `lastUpdate`.

If scoreboard file does not exist, the script outputs `{}` — treat all counts as 0.

## Step 2: Display banner

Print:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Querying 10 agents...

## Step 3: Call identity (and health_check for claude-N) on each agent (sequential — one at a time, never parallel)

For each of the 10 agents below, call their identity tool with `{}` as input. Wrap each call in try/catch — on error, mark health=`error` and fill version/model/available_models with `—`. Never let a single agent failure abort the loop.

**Agent list and tool mapping (complete — 10 agents):**

| Display Name    | Identity Tool                   | health_check Tool                | Scoreboard Key |
|---|---|---|---|
| codex-cli-1     | mcp__codex-cli-1__identity      | — (none)                         | codex          |
| gemini-cli-1    | mcp__gemini-cli-1__identity     | — (none)                         | gemini         |
| opencode-1      | mcp__opencode-1__identity       | — (none)                         | opencode       |
| copilot-1       | mcp__copilot-1__identity        | — (none)                         | copilot        |
| claude-1        | mcp__claude-1__identity         | mcp__claude-1__health_check      | deepseek       |
| claude-2        | mcp__claude-2__identity         | mcp__claude-2__health_check      | minimax        |
| claude-3        | mcp__claude-3__identity         | mcp__claude-3__health_check      | qwen-coder     |
| claude-4        | mcp__claude-4__identity         | mcp__claude-4__health_check      | kimi           |
| claude-5        | mcp__claude-5__identity         | mcp__claude-5__health_check      | llama4         |
| claude-6        | mcp__claude-6__identity         | mcp__claude-6__health_check      | glm            |

After each successful identity call, parse the JSON response to extract: `name`, `version`, `model`, `available_models`, `install_method`. If `available_models` has more than 3 entries, display the first 3 joined by ", " followed by ", ..." truncation. If `available_models` is empty or null, display `—`.

**For claude-1 through claude-6 (HTTP agents):** After calling identity, also call the corresponding `health_check` tool with `{}` as input. Wrap in try/catch — on error or timeout, set `hc = null`. On success, extract `hc.healthy` (boolean), `hc.latencyMs` (number), and `hc.model` (string).

**For CLI agents (codex-cli-1, gemini-cli-1, opencode-1, copilot-1):** Do NOT call health_check — there is no such tool for them. Set `hc = null` for these agents.

Note: `glm` is not yet in the scoreboard VALID_MODELS list — `counts['glm']` will be undefined for `claude-6`. Treat as 0 (correct, not an error).

## Step 4: Derive health state per agent

Health derivation uses two separate paths depending on agent type:

**For CLI agents (codex-cli-1, gemini-cli-1, opencode-1, copilot-1) — scoreboard-based:**
- If identity call threw an exception or returned an error → health = `error`, latency = `—`
- Else if `(counts[scoreboardKey] || 0) > 0` → health = `quota-exceeded`, latency = `—`
- Else → health = `available`, latency = `—`

**For HTTP agents (claude-1 through claude-6) — live health_check result:**
- If identity call threw an exception or returned an error → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `unreachable`, latency = `—`
- Else if `hc.healthy === false` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

Note: UNAVAIL count from the scoreboard is still shown in the UNAVAIL column for context, but no longer drives the health field for claude-N agents.

## Step 5: Render formatted table

Display the table with these columns: Agent | Version | Model | Health | Latency | Available Models | UNAVAIL

Example output format:

┌─────────────────────┬─────────┬──────────────────────────┬─────────────┬─────────┬───────────────────────────────┬─────────┐
│ Agent               │ Version │ Model                    │ Health      │ Latency │ Available Models              │ UNAVAIL │
├─────────────────────┼─────────┼──────────────────────────┼─────────────┼─────────┼───────────────────────────────┼─────────┤
│ codex-cli-1         │ 1.2.3   │ codex                    │ quota-excee │ —       │ codex, o3-mini, gpt-4o, ...   │ 56      │
│ gemini-cli-1        │ 1.1.0   │ gemini-3-pro-preview     │ quota-excee │ —       │ gemini-3-pro, flash, ...      │ 34      │
│ opencode-1          │ 1.0.0   │ claude-sonnet-4-6        │ available   │ —       │ claude-sonnet-4-6, gpt-4o     │ 4       │
│ copilot-1           │ 1.2.0   │ gpt-4.1                  │ available   │ —       │ gpt-4.1, gpt-4o, claude-3.5   │ 0       │
│ claude-1            │ 1.0.0   │ deepseek-ai/DeepSeek-V3  │ available   │ 312ms   │ —                             │ 0       │
│ claude-2            │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5   │ available   │ 480ms   │ —                             │ 0       │
│ claude-3            │ 1.0.0   │ Qwen/Qwen3-Coder-480B    │ unhealthy   │ 9800ms  │ —                             │ 3       │
│ claude-4            │ 1.0.0   │ kimi                     │ available   │ 220ms   │ —                             │ 0       │
│ claude-5            │ 1.0.0   │ meta-llama/Llama-4-M     │ unreachable │ —       │ —                             │ 1       │
│ claude-6            │ 1.0.0   │ glm-5                    │ available   │ 670ms   │ —                             │ 0       │
└─────────────────────┴─────────┴──────────────────────────┴─────────────┴─────────┴───────────────────────────────┴─────────┘

Scoreboard: {totalRounds} rounds recorded | Last update: {lastUpdate}

If scoreboard file was absent (empty counts), show instead:
Scoreboard: no data yet (run /qgsd:quorum first to populate)

</process>

<success_criteria>
- All 10 agents queried (or marked error if unavailable)
- UNAVAIL count shown per agent from scoreboard rounds
- Health for claude-1..6 is live from health_check (not from UNAVAIL count)
- Health for CLI agents (codex/gemini/opencode/copilot) remains scoreboard-derived
- Latency column shows ms for claude-N agents (e.g. 312ms), `—` for CLI agents
- `unreachable` state shown when health_check call itself fails (null hc)
- `unhealthy` state shown when health_check returns `healthy: false`
- available_models shown (truncated at 3 + "..." if longer)
- Command handles missing scoreboard gracefully (no crash)
- Command handles individual agent identity or health_check failures gracefully (no crash)
- claude-6 row present with UNAVAIL=0 (scoreboard does not yet record glm votes)
</success_criteria>
