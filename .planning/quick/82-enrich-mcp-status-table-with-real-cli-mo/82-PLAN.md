---
phase: quick-82
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - bin/unified-mcp-server.mjs
  - commands/qgsd/mcp-status.md
autonomous: true
requirements: [Q82-01]

must_haves:
  truths:
    - "mcp-status table has a claude orchestrator row at the top with model claude-sonnet-4-6 (or opus/haiku equivalent), auth=api, Provider=Anthropic, Health=orchestrator, Latency=—"
    - "CLI agent rows (codex-1, gemini-1, opencode-1, copilot-1) show real model names (gpt-5.3-codex, gemini-2.5-pro, xai/grok-3, gpt-4.1) not just binary names (codex, gemini, ask)"
    - "CLI agent rows show real latency in ms from --version health_check, not — "
    - "CLI agent rows show correct provider display names: OpenAI, Google, OpenCode, GitHub"
    - "identity tool for subprocess providers returns display_provider field"
  artifacts:
    - path: "bin/providers.json"
      provides: "Static model, display_provider, health_check_args fields for each subprocess provider"
      contains: "gpt-5.3-codex"
    - path: "bin/unified-mcp-server.mjs"
      provides: "health_check tool for subprocess providers, model detection from model_detect config, display_provider in identity"
      exports: ["buildSlotTools", "handleSlotToolCall", "buildIdentityResult", "runSubprocessHealthCheck"]
    - path: "commands/qgsd/mcp-status.md"
      provides: "Updated command with claude row, CLI agent latency, correct provider names"
      contains: "claudeModel"
  key_links:
    - from: "bin/providers.json"
      to: "bin/unified-mcp-server.mjs"
      via: "provider.model, provider.model_detect, provider.health_check_args, provider.display_provider fields"
      pattern: "provider\\.model_detect|provider\\.health_check_args|provider\\.display_provider"
    - from: "bin/unified-mcp-server.mjs"
      to: "mcp__codex-1__health_check"
      via: "buildSlotTools adds health_check when provider.health_check_args is set"
      pattern: "health_check_args"
    - from: "commands/qgsd/mcp-status.md"
      to: "~/.claude/settings.json"
      via: "Step 1 Bash reads model field and maps to full model ID"
      pattern: "claudeModel"
---

<objective>
Enrich the mcp-status table with real CLI model names, latency for CLI agents, and a Claude orchestrator row.

Purpose: The status table currently shows binary names (codex, gemini, ask) and no latency for CLI agents. The orchestrator running the command is invisible. This makes the table incomplete for debugging quorum team composition.

Output: Updated providers.json (model metadata), unified-mcp-server.mjs (health_check for subprocess providers + model detection), and mcp-status.md (claude row at top, CLI latency, real model names, correct provider display names).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/bin/providers.json
@/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs
@/Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model metadata to providers.json for all subprocess providers</name>
  <files>bin/providers.json</files>
  <action>
For each subprocess provider entry, add the following fields:

**codex-1 and codex-2:**
```json
"model": "gpt-5.3-codex",
"model_detect": {
  "file": "~/.codex/config.toml",
  "pattern": "^model = \"([^\"]+)\""
},
"health_check_args": ["--version"],
"display_provider": "OpenAI"
```

**gemini-1 and gemini-2:**
```json
"model": "gemini-2.5-pro",
"health_check_args": ["--version"],
"display_provider": "Google"
```

**opencode-1:**
```json
"model": "xai/grok-3",
"health_check_args": ["--version"],
"display_provider": "OpenCode"
```

**copilot-1:**
```json
"model": "gpt-4.1",
"health_check_args": ["--version"],
"display_provider": "GitHub"
```

HTTP providers (claude-1 through claude-6) already have `model` fields — no changes needed for them. Do NOT add `display_provider` to HTTP providers (they use the URL_MAP lookup in mcp-status.md).

Insert each new field group directly after the existing `"mainTool"` field line for each provider.
  </action>
  <verify>node -e "const p=require('./bin/providers.json'); const sub=p.providers.filter(x=>x.type==='subprocess'); console.log(sub.map(x=>x.name+': model='+x.model+' display_provider='+x.display_provider+' hca='+JSON.stringify(x.health_check_args)))"</verify>
  <done>All 6 subprocess providers have model, health_check_args, and display_provider fields. codex-1/2 also have model_detect. HTTP providers are unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add subprocess health_check tool and model detection to unified-mcp-server.mjs</name>
  <files>bin/unified-mcp-server.mjs</files>
  <action>
Three changes to unified-mcp-server.mjs:

**A) buildIdentityResult — detect real model name and expose display_provider**

Replace the current model detection logic (lines 469–471):
```javascript
const model = provider.type === 'http'
  ? (process.env.CLAUDE_DEFAULT_MODEL ?? provider.model)
  : (provider.mainTool ?? provider.cli);
```

With:
```javascript
let model;
if (provider.type === 'http') {
  model = process.env.CLAUDE_DEFAULT_MODEL ?? provider.model;
} else {
  // Start with static fallback from providers.json, or binary name
  model = provider.model ?? provider.mainTool ?? provider.cli;
  // Attempt dynamic detection via model_detect config
  if (provider.model_detect?.file && provider.model_detect?.pattern) {
    try {
      const detectPath = provider.model_detect.file.replace(/^~/, os.homedir());
      const content = fs.readFileSync(detectPath, 'utf8');
      const match = content.match(new RegExp(provider.model_detect.pattern, 'm'));
      if (match?.[1]) model = match[1];
    } catch (_) { /* fall through to static value */ }
  }
}
```

Also add `import os from 'os';` at the top of the file (after the existing imports) if it is not already present.

Update the returned JSON object in buildIdentityResult to include `display_provider`:
```javascript
return JSON.stringify({
  name: 'unified-mcp-server',
  version,
  slot: provider.name,
  type: provider.type,
  model,
  display_provider: provider.display_provider ?? null,
  provider: provider.description,
  install_method: 'qgsd-monorepo',
});
```

**B) buildSlotTools — add health_check tool for subprocess providers**

In the `if (provider.type === 'subprocess')` block (around line 110), after the existing `extraTools` loop, add:
```javascript
// health_check tool for subprocess providers
if (provider.health_check_args) {
  tools.push({
    name: 'health_check',
    description: 'Test CLI availability by running a lightweight command (e.g. --version). Returns { healthy, latencyMs, type: "subprocess" }.',
    inputSchema: NO_ARGS_SCHEMA,
  });
}
```

**C) handleSlotToolCall — handle health_check for subprocess providers**

Add a new function `runSubprocessHealthCheck` before `handleSlotToolCall`:
```javascript
async function runSubprocessHealthCheck(provider) {
  const args = provider.health_check_args ?? ['--version'];
  const startTime = Date.now();
  const output = await runSubprocessWithArgs(provider, args, 10000);
  const latencyMs = Date.now() - startTime;
  const healthy = !output.startsWith('[spawn error') && !output.startsWith('[TIMED');
  return JSON.stringify({ healthy, latencyMs, type: 'subprocess' });
}
```

In `handleSlotToolCall`, inside the `if (slotProvider.type === 'subprocess')` block, after the existing `extra` handling, add:
```javascript
if (toolName === 'health_check' && slotProvider.health_check_args) {
  return runSubprocessHealthCheck(slotProvider);
}
```
  </action>
  <verify>node -e "import('./bin/unified-mcp-server.mjs').catch(e=>console.error(e.message))" 2>&1 | head -5</verify>
  <done>unified-mcp-server.mjs imports cleanly (no syntax errors). buildIdentityResult reads model_detect config when present. buildSlotTools includes health_check for subprocess providers that have health_check_args. handleSlotToolCall dispatches health_check for subprocess providers.</done>
</task>

<task type="auto">
  <name>Task 3: Update mcp-status.md with claude row, CLI latency, and real provider names</name>
  <files>commands/qgsd/mcp-status.md</files>
  <action>
Six targeted edits to mcp-status.md:

**A) allowed-tools frontmatter — add health_check for CLI agents**

After the existing `mcp__claude-6__health_check` entry, add:
```yaml
  - mcp__codex-1__health_check
  - mcp__gemini-1__health_check
  - mcp__opencode-1__health_check
  - mcp__copilot-1__health_check
```

**B) Step 1 Bash — also read ~/.claude/settings.json for orchestrator model**

Inside the existing `node << 'EOF'` script, after the `providers` block and before `console.log(...)`, add:

```javascript
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
```

Update the `console.log` line to include `claudeModel`:
```javascript
console.log(JSON.stringify({totalRounds,lastUpdate,providers,claudeModel}));
```

Update the "Parse..." sentence after the Bash block to also parse `claudeModel`.

**C) Step 3 sub-agent prompt — add 4 health_check calls for CLI agents**

In the "Tools to call in this order" list, add after item 4 (`copilot_id`):
```
5.  mcp__codex-1__health_check     — store result as codex_hc
6.  mcp__gemini-1__health_check    — store result as gemini_hc
7.  mcp__opencode-1__health_check  — store result as opencode_hc
8.  mcp__copilot-1__health_check   — store result as copilot_hc
```
Renumber the subsequent items (previously 5–16) to 9–20.

Update the return JSON structure to include hc for CLI agents:
```json
{
  "codex-1":    { "identity": <codex_id or null>,    "hc": <codex_hc or null> },
  "gemini-1":   { "identity": <gemini_id or null>,   "hc": <gemini_hc or null> },
  "opencode-1": { "identity": <opencode_id or null>, "hc": <opencode_hc or null> },
  "copilot-1":  { "identity": <copilot_id or null>,  "hc": <copilot_hc or null> },
  ...
}
```

**D) Step 4 — use hc for CLI agent latency**

Replace the current CLI agent health derivation block:
```
**For CLI agents — identity-based (not scoreboard-based):**
- If identity call threw an exception → health = `error`, latency = `—`
- Else → health = `available`, latency = `—`
```

With:
```
**For CLI agents — identity + health_check based:**
- If identity call threw an exception → health = `error`, latency = `—`
- Else if `hc` is null (health_check threw or timed out) → health = `available`, latency = `—`
- Else if `!hc.healthy` → health = `unhealthy`, latency = `${hc.latencyMs}ms`
- Else → health = `available`, latency = `${hc.latencyMs}ms`

Model for CLI agents: use `identity.model` if present (real model name from model_detect or static), else `identity.display_provider ?? identity.provider`.
```

**E) Step 5 — provider inference update and claude row**

Update the provider inference rule (in "Provider for CLI agents" paragraph). Change to:
```
**Provider for CLI agents** — prefer `identity.display_provider` when present. If absent, infer from model name:
- `gpt-*` or `o[0-9]*` → OpenAI
- `gemini-*` → Google
- `claude-*` → Anthropic
- `opencode*` or `grok*` → OpenCode
- default → —
```

**F) Step 5 table — add claude row at TOP and update example**

In the "Render formatted table" section, add this instruction before the table:

```
Before rendering, prepend a claude orchestrator row at the TOP of the table. This row does NOT come from AGENT_RESULTS — it comes from INIT_INFO:
- Agent: `claude`
- Auth: `api`
- Provider: `Anthropic`
- Model: `claudeModel` (from INIT_INFO, e.g. `claude-sonnet-4-6`)
- Health: `orchestrator`
- Latency: `—`
```

Update the example table to show:
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
```

**G) Update objective and success_criteria**

Update `<objective>` to:
```
Display a clean status table of all connected MCP quorum agents plus the Claude orchestrator. For CLI agents (codex-1, gemini-1, opencode-1, copilot-1): call their identity tool and health_check for real model names and latency. For HTTP agents (claude-1..6): call their identity tool then health_check for real-time endpoint health. Read provider URLs from ~/.claude.json. Show a claude orchestrator row at the top of the table.
```

Update `<success_criteria>` bullets to include:
- `claude` orchestrator row shown at top of table with model read from `~/.claude/settings.json`
- CLI agents show real model names (gpt-5.3-codex, gemini-2.5-pro, xai/grok-3, gpt-4.1) not binary names
- CLI agents show real latency in ms from `health_check` --version call
- CLI agent Provider column uses `identity.display_provider` (OpenAI, Google, OpenCode, GitHub)
- All 11 rows shown (1 orchestrator + 4 CLI + 6 HTTP)
  </action>
  <verify>grep -n "claudeModel\|mcp__codex-1__health_check\|orchestrator\|display_provider" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md | head -20</verify>
  <done>mcp-status.md has: health_check in allowed-tools for all 4 CLI agents, claudeModel in Step 1 Bash, health_check calls for CLI agents in Step 3 sub-agent prompt, CLI agent latency populated from hc in Step 4, display_provider preference in Step 5 provider inference, and claude orchestrator row at top of example table with orchestrator health value.</done>
</task>

</tasks>

<verification>
After all three tasks complete, verify the full chain:

1. providers.json passes JSON parse: `node -e "require('./bin/providers.json')"`
2. unified-mcp-server.mjs has no syntax errors: `node --input-type=module < /dev/null 2>&1; node -e "import('./bin/unified-mcp-server.mjs')" 2>&1 | grep -v 'started\|MCP' | head -3`
3. mcp-status.md has all required new elements: `grep -c "claudeModel\|health_check_args\|orchestrator\|display_provider" /Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md`
4. Install sync: `cp /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs /Users/jonathanborduas/code/QGSD/hooks/dist/ 2>/dev/null || true`

Note: unified-mcp-server.mjs is NOT a hook file — no install sync to ~/.claude/hooks is needed. It is invoked directly by the MCP server config.
</verification>

<success_criteria>
- providers.json: all 6 subprocess providers have model, health_check_args, display_provider; codex-1/2 have model_detect
- unified-mcp-server.mjs: buildIdentityResult reads model_detect file with regex fallback; returns display_provider; buildSlotTools adds health_check for subprocess providers with health_check_args; handleSlotToolCall dispatches health_check for subprocess via runSubprocessHealthCheck
- mcp-status.md: allowed-tools has 4 new CLI health_check entries; Step 1 reads claudeModel from ~/.claude/settings.json; Step 3 calls health_check for all 4 CLI agents; Step 4 populates CLI latency from hc; Step 5 table has claude orchestrator row at top; provider inference prefers identity.display_provider
- No regressions: HTTP provider rows still work exactly as before
</success_criteria>

<output>
After completion, create `.planning/quick/82-enrich-mcp-status-table-with-real-cli-mo/82-SUMMARY.md`
</output>
