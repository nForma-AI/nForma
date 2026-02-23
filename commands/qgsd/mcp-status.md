---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — name, version, model, health, available models, and UNAVAIL count from the scoreboard
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
---

<objective>
Display a formatted status table of all connected MCP quorum agents. For each agent: call its identity tool to get live name/version/model/available_models, read UNAVAIL count from the quorum scoreboard, and derive health state.

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

## Step 3: Call identity on each agent (sequential — one at a time, never parallel)

For each of the 10 agents below, call their identity tool with `{}` as input. Wrap each call in try/catch — on error, mark health=`error` and fill version/model/available_models with `—`. Never let a single agent failure abort the loop.

**Agent list and tool mapping (complete — 10 agents):**

| Display Name    | Identity Tool                   | Scoreboard Key |
|---|---|---|
| codex-cli-1     | mcp__codex-cli-1__identity      | codex          |
| gemini-cli-1    | mcp__gemini-cli-1__identity     | gemini         |
| opencode-1      | mcp__opencode-1__identity       | opencode       |
| copilot-1       | mcp__copilot-1__identity        | copilot        |
| claude-1        | mcp__claude-1__identity         | deepseek       |
| claude-2        | mcp__claude-2__identity         | minimax        |
| claude-3        | mcp__claude-3__identity         | qwen-coder     |
| claude-4        | mcp__claude-4__identity         | kimi           |
| claude-5        | mcp__claude-5__identity         | llama4         |
| claude-6        | mcp__claude-6__identity         | glm            |

After each successful identity call, parse the JSON response to extract: `name`, `version`, `model`, `available_models`, `install_method`. If `available_models` has more than 3 entries, display the first 3 joined by ", " followed by ", ..." truncation. If `available_models` is empty or null, display `—`.

Note: `glm` is not yet in the scoreboard VALID_MODELS list — `counts['glm']` will be undefined for `claude-6`. Treat as 0 (correct, not an error).

## Step 4: Derive health state per agent

For each agent after the identity call attempt:
- If identity call threw an exception or returned an error → health = `error`
- Else if `(counts[scoreboardKey] || 0) > 0` → health = `quota-exceeded`
- Else → health = `available`

## Step 5: Render formatted table

Display the table with these columns: Agent | Version | Model | Health | Available Models | UNAVAIL

Example output format:

┌─────────────────────┬─────────┬──────────────────────────┬────────────────┬───────────────────────────────┬─────────┐
│ Agent               │ Version │ Model                    │ Health         │ Available Models              │ UNAVAIL │
├─────────────────────┼─────────┼──────────────────────────┼────────────────┼───────────────────────────────┼─────────┤
│ codex-cli-1         │ 1.2.3   │ codex                    │ quota-exceeded │ codex, o3-mini, gpt-4o, ...   │ 56      │
│ gemini-cli-1        │ 1.1.0   │ gemini-3-pro-preview     │ quota-exceeded │ gemini-3-pro, flash, ...      │ 34      │
│ opencode-1          │ 1.0.0   │ claude-sonnet-4-6        │ available      │ claude-sonnet-4-6, gpt-4o     │ 4       │
│ copilot-1           │ 1.2.0   │ gpt-4.1                  │ available      │ gpt-4.1, gpt-4o, claude-3.5   │ 0       │
│ claude-1            │ 1.0.0   │ deepseek-ai/DeepSeek-V3  │ available      │ —                             │ 0       │
│ claude-2            │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5   │ available      │ —                             │ 0       │
│ claude-3            │ 1.0.0   │ Qwen/Qwen3-Coder-480B    │ available      │ —                             │ 0       │
│ claude-4            │ 1.0.0   │ kimi                     │ available      │ —                             │ 0       │
│ claude-5            │ 1.0.0   │ meta-llama/Llama-4-M     │ available      │ —                             │ 0       │
│ claude-6            │ 1.0.0   │ glm-5                    │ available      │ —                             │ 0       │
└─────────────────────┴─────────┴──────────────────────────┴────────────────┴───────────────────────────────┴─────────┘

Scoreboard: {totalRounds} rounds recorded | Last update: {lastUpdate}

If scoreboard file was absent (empty counts), show instead:
Scoreboard: no data yet (run /qgsd:quorum first to populate)

</process>

<success_criteria>
- All 10 agents queried (or marked error if unavailable)
- UNAVAIL count shown per agent from scoreboard rounds
- Health state shown: available / quota-exceeded / error
- available_models shown (truncated at 3 + "..." if longer)
- Command handles missing scoreboard gracefully (no crash)
- Command handles individual agent identity failures gracefully (no crash)
- claude-6 row present with UNAVAIL=0 (scoreboard does not yet record glm votes)
</success_criteria>
