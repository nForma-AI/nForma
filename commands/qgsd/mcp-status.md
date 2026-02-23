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
---

<objective>
Display a formatted status table of all connected MCP quorum agents. For CLI agents (codex-1, gemini-1, opencode-1, copilot-1): call their identity tool to get live name/version/model/available_models. For HTTP agents (claude-1..6): read model info from providers.json and probe endpoint health via inline HTTP GET. Read UNAVAIL count from the quorum scoreboard and derive health state.

This command is read-only (observation only). It does NOT invoke quorum and is NOT in quorum_commands.
</objective>

<process>

## Step 1: Read UNAVAIL counts from scoreboard

Run the following Bash command and store the output as SCOREBOARD_INFO:

```bash
node -e "
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
"
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

## Step 2: Load HTTP provider info from providers.json

Run the following Bash command and store the output as HTTP_PROVIDERS:

```bash
node -e "
const fs=require('fs');
const path=require('path');
const p=path.join(process.cwd(),'bin','providers.json');
const data=JSON.parse(fs.readFileSync(p,'utf8'));
const httpMap={};
for(const prov of data.providers||[]){
  if(prov.type==='http'){
    httpMap[prov.name]={model:prov.model,description:prov.description,baseUrl:prov.baseUrl,apiKeyEnv:prov.apiKeyEnv};
  }
}
console.log(JSON.stringify(httpMap));
"
```

Parse the result as a map: `{ "claude-1": { model, description, baseUrl, apiKeyEnv }, ... }`.

## Step 3: Probe HTTP endpoints

Run the following Bash command and store the output as ENDPOINT_HEALTH:

```bash
node -e "
const https=require('https');
const fs=require('fs');
const path=require('path');
const p=path.join(process.cwd(),'bin','providers.json');
const data=JSON.parse(fs.readFileSync(p,'utf8'));

const baseUrls=new Set();
for(const prov of data.providers||[]){
  if(prov.type==='http') baseUrls.add(prov.baseUrl);
}

function probeUrl(baseUrl){
  return new Promise((resolve)=>{
    const url=new URL(baseUrl+'/models');
    const start=Date.now();
    const req=https.request({hostname:url.hostname,path:url.pathname,method:'GET',timeout:7000},(res)=>{
      const latencyMs=Date.now()-start;
      const healthy=[200,401,403,404,422].includes(res.statusCode);
      res.resume();
      resolve({healthy,latencyMs,statusCode:res.statusCode,error:null});
    });
    req.on('timeout',()=>{req.destroy();resolve({healthy:false,latencyMs:7000,statusCode:null,error:'timeout'});});
    req.on('error',(e)=>{resolve({healthy:false,latencyMs:Date.now()-start,statusCode:null,error:e.message});});
    req.end();
  });
}

Promise.all([...baseUrls].map(async(u)=>({url:u,result:await probeUrl(u)}))).then((results)=>{
  const health={};
  for(const {url,result} of results) health[url]=result;
  console.log(JSON.stringify(health));
});
"
```

Parse the result as a map: `{ "https://api.akashml.com/v1": { healthy, latencyMs, statusCode, error }, ... }`.

## Step 4: Display banner

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Querying 4 CLI agents + 6 HTTP providers...
```

## Step 5: Call identity on CLI agents only (sequential — one at a time, never parallel)

For each of the 4 CLI agents below, call their identity tool with `{}` as input. Wrap each call in try/catch — on error, mark health=`error` and fill version/model/available_models with `—`. Never let a single agent failure abort the loop.

**CLI agent list and tool mapping:**

| Display Name | Identity Tool              | Scoreboard Key |
|---|---|---|
| codex-1      | mcp__codex-1__identity     | codex          |
| gemini-1     | mcp__gemini-1__identity    | gemini         |
| opencode-1   | mcp__opencode-1__identity  | opencode       |
| copilot-1    | mcp__copilot-1__identity   | copilot        |

After each successful identity call, parse the JSON response to extract: `name`, `version`, `model`, `available_models`, `install_method`. If `available_models` has more than 3 entries, display the first 3 joined by ", " followed by ", ..." truncation. If `available_models` is empty or null, display `—`.

## Step 6: Assemble all 10 agent rows

Build one row per agent using the data collected above.

**For CLI agents (codex-1, gemini-1, opencode-1, copilot-1):**
- `version` = from identity call result
- `model` = from identity call result
- `available_models` = from identity call result (truncated at 3)
- `endpoint` = `—` (no HTTP probe for subprocess agents)
- `health`:
  - If identity call threw an exception → `error`
  - Else if `(counts[scoreboardKey] || 0) > 0` → `quota-exceeded`
  - Else → `available`
- `unavail` = `counts[scoreboardKey] || 0`

**For HTTP agents (claude-1, claude-2, claude-3, claude-4, claude-5, claude-6):**
- `version` = `1.0.0` (static — unified-mcp-server version)
- `model` = from HTTP_PROVIDERS map (e.g. `deepseek-ai/DeepSeek-V3.2`)
- `available_models` = `—` (single model per slot)
- `endpoint` = latency from ENDPOINT_HEALTH for this slot's baseUrl (e.g. `42ms`); if probe failed → `—`
- `health`:
  - If endpoint not healthy (`healthy=false`) → `endpoint-down`
  - Else if `getUnavail(slot, model) > 0` → `quota-exceeded`
  - Else → `available`
- `unavail` = `getUnavail(slot, model)` — checks both old simple key AND new composite key `slot:model`

**HTTP agent to provider mapping (from providers.json):**

| Slot     | Model                                                | Base URL                              |
|----------|------------------------------------------------------|---------------------------------------|
| claude-1 | deepseek-ai/DeepSeek-V3.2                            | https://api.akashml.com/v1            |
| claude-2 | MiniMaxAI/MiniMax-M2.5                               | https://api.akashml.com/v1            |
| claude-3 | Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8              | https://api.together.xyz/v1           |
| claude-4 | accounts/fireworks/models/kimi-k2p5                  | https://api.fireworks.ai/inference/v1 |
| claude-5 | meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8    | https://api.together.xyz/v1           |
| claude-6 | accounts/fireworks/models/glm-5                      | https://api.fireworks.ai/inference/v1 |

## Step 7: Render formatted table

Display the table with these columns: Agent | Version | Model | Health | Endpoint | Available Models | UNAVAIL

Example output format:

```
┌─────────────────────┬─────────┬────────────────────────────────┬────────────────┬──────────┬───────────────────────────────┬─────────┐
│ Agent               │ Version │ Model                          │ Health         │ Endpoint │ Available Models              │ UNAVAIL │
├─────────────────────┼─────────┼────────────────────────────────┼────────────────┼──────────┼───────────────────────────────┼─────────┤
│ codex-1             │ 1.2.3   │ codex                          │ quota-exceeded │ —        │ codex, o3-mini, gpt-4o, ...   │ 56      │
│ gemini-1            │ 1.1.0   │ gemini-3-pro-preview           │ quota-exceeded │ —        │ gemini-3-pro, flash, ...      │ 34      │
│ opencode-1          │ 1.0.0   │ claude-sonnet-4-6              │ available      │ —        │ claude-sonnet-4-6, gpt-4o     │ 4       │
│ copilot-1           │ 1.2.0   │ gpt-4.1                        │ available      │ —        │ gpt-4.1, gpt-4o, claude-3.5   │ 0       │
│ claude-1            │ 1.0.0   │ deepseek-ai/DeepSeek-V3.2      │ available      │ 38ms     │ —                             │ 0       │
│ claude-2            │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5         │ available      │ 41ms     │ —                             │ 0       │
│ claude-3            │ 1.0.0   │ Qwen/Qwen3-Coder-480B-A35B     │ available      │ 2104ms   │ —                             │ 0       │
│ claude-4            │ 1.0.0   │ accounts/fireworks/models/kimi │ available      │ 210ms    │ —                             │ 0       │
│ claude-5            │ 1.0.0   │ meta-llama/Llama-4-Maverick    │ available      │ 2099ms   │ —                             │ 0       │
│ claude-6            │ 1.0.0   │ accounts/fireworks/models/glm  │ endpoint-down  │ —        │ —                             │ 0       │
└─────────────────────┴─────────┴────────────────────────────────┴────────────────┴──────────┴───────────────────────────────┴─────────┘

Scoreboard: {totalRounds} rounds recorded | Last update: {lastUpdate}
```

If scoreboard file was absent (empty counts), show instead:
```
Scoreboard: no data yet (run /qgsd:quorum first to populate)
```

Health legend:
- `available` — agent is responsive and no recent quota errors
- `quota-exceeded` — UNAVAIL count > 0 in scoreboard
- `endpoint-down` — HTTP probe returned unhealthy (timeout, connection refused, or non-2xx/non-auth error)
- `error` — CLI identity call failed (agent not running or crashed)

</process>

<success_criteria>
- All 10 agents shown (4 CLI via identity call + 6 HTTP via providers.json)
- HTTP agent model names sourced from providers.json (not from identity tool calls)
- HTTP endpoint health probed inline (3 probes: AkashML, Together, Fireworks) via Node https
- Endpoint latency shown in ms for HTTP agents, — for CLI agents
- UNAVAIL count handles both old simple keys (deepseek) and new composite keys (claude-1:deepseek-ai/DeepSeek-V3.2)
- Health state shown: available / quota-exceeded / endpoint-down / error
- No claude-N identity tool calls anywhere in this command
- CLI agents use current slot names: codex-1, gemini-1, opencode-1, copilot-1
- Command handles missing scoreboard gracefully (no crash)
- Command handles individual CLI agent identity failures gracefully (no crash)
</success_criteria>
