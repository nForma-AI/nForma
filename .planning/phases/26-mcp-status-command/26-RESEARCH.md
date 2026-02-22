# Phase 26: MCP Status Command — Research

**Researched:** 2026-02-22 (updated)
**Domain:** QGSD command authoring, quorum scoreboard schema, MCP identity tool protocol
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OBS-01 | User can run `/qgsd:mcp-status` to see all connected MCPs with name, version, current model, and availability | Command file pattern established; identity tool returns name/version/model; all MCP tool prefixes documented |
| OBS-02 | Status display shows health state (available / quota-exceeded / error) derived from scoreboard data | Scoreboard rounds[].votes[model] contains UNAVAIL votes; derivation algorithm documented; live data verified |
| OBS-03 | Status shows available models for each agent (from `identity` tool response) | Identity tool returns available_models array; verified from simple-tools.ts source code |
| OBS-04 | Status shows recent UNAVAIL count per agent from quorum scoreboard | UNAVAIL count algorithm documented with working node -e code; live counts verified (codex=56, gemini=34, opencode=4) |
</phase_requirements>

## Summary

Phase 26 adds `/qgsd:mcp-status` — a read-only status display command that calls `identity` on each configured quorum agent, reads UNAVAIL counts from the quorum scoreboard, and renders a unified table showing name, version, model, health state, available models, and UNAVAIL count per agent.

All infrastructure is already in place from prior phases. All 6 MCP repos expose a 5-field `identity` tool (Phase 25, STD-04). The quorum scoreboard at `.planning/quorum-scoreboard.json` contains round-level UNAVAIL data. The QGSD command system follows a simple `.md` file pattern — new commands are added to `commands/qgsd/` and installed by `bin/install.js` to `~/.claude/commands/qgsd/`.

**Critical discovery (2026-02-22 update):** `~/.claude.json` has 10 MCP servers — the existing research documented 9, but `claude-glm` (Fireworks / GLM-5) was added and is now present. The quorum.md command description already lists GLM. However, `glm` is NOT yet in `VALID_MODELS` in `update-scoreboard.cjs`, meaning the scoreboard does not yet record GLM UNAVAIL votes. The mcp-status command must include `claude-glm` in its identity query list but will show UNAVAIL=0 (from empty scoreboard data) with no error.

**Primary recommendation:** Implement mcp-status as a single QGSD command file (`commands/qgsd/mcp-status.md`) with inline orchestration logic — no new workflow file needed, no new gsd-tools subcommand. The command calls identity sequentially on all 10 agents, parses scoreboard for UNAVAIL counts, and renders a formatted table.

## Standard Stack

### Core
| Component | Source | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| `mcp__*__identity` | MCP tool calls | Get name/version/model/available_models/install_method | Phase 25 STD-04 — all repos implement it |
| `.planning/quorum-scoreboard.json` | Local file (Bash + node) | UNAVAIL counts, team.agents snapshot | Already populated by quorum rounds |
| `~/.claude/qgsd.json` (two-layer) | config-loader.js pattern | `required_models` → which agents are primary quorum agents | Source of truth for configured quorum agents |
| `~/.claude.json` `mcpServers` | Read or Bash | Detect which MCP servers are actually installed | 10 servers currently: 4 primary + 6 claude-mcp-server instances |

### No new dependencies
No new npm packages. No new gsd-tools subcommand. No new workflow file. Single command `.md` file.

## Architecture Patterns

### Agent Inventory (verified from ~/.claude.json, 2026-02-22)

The live install has 10 MCP servers:

| Display Name | Identity Tool | Scoreboard Key | Provider | Model |
|---|---|---|---|---|
| codex-cli | mcp__codex-cli__identity | codex | Codex CLI | codex |
| gemini-cli | mcp__gemini-cli__identity | gemini | Gemini CLI | gemini |
| opencode | mcp__opencode__identity | opencode | OpenCode | claude-sonnet-4-6 |
| copilot-cli | mcp__copilot-cli__identity | copilot | Copilot CLI | gpt-4.1 |
| claude-deepseek | mcp__claude-deepseek__identity | deepseek | AkashML | deepseek-ai/DeepSeek-V3.2 |
| claude-minimax | mcp__claude-minimax__identity | minimax | AkashML | MiniMaxAI/MiniMax-M2.5 |
| claude-qwen-coder | mcp__claude-qwen-coder__identity | qwen-coder | Together.xyz | Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8 |
| claude-kimi | mcp__claude-kimi__identity | kimi | Fireworks | accounts/fireworks/models/kimi-k2p5 |
| claude-llama4 | mcp__claude-llama4__identity | llama4 | Together.xyz | meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8 |
| claude-glm | mcp__claude-glm__identity | glm | Fireworks | accounts/fireworks/models/glm-5 |

**Important:** `glm` is NOT in `VALID_MODELS` of `update-scoreboard.cjs` — scoreboard has no GLM UNAVAIL votes. Show UNAVAIL=0 for claude-glm (correct, not an error).

### Data Sources and Their Mapping

```
qgsd.json required_models
  → keyed by agent name (codex, gemini, opencode, copilot)
  → tool_prefix: "mcp__codex-cli__" etc.
  → only 4 primary quorum agents appear here

~/.claude.json mcpServers
  → 10 keys: codex-cli, gemini-cli, opencode, copilot-cli,
             claude-deepseek, claude-minimax, claude-qwen-coder,
             claude-kimi, claude-llama4, claude-glm
  → determines which MCP tool prefix is callable

identity tool response (per agent) — from simple-tools.ts:
  → { name, version, model, available_models, install_method }
  → version: dynamically read from package.json at startup
  → model: process.env['CLAUDE_DEFAULT_MODEL'] ?? 'claude-sonnet-4-6'
  → available_models: AVAILABLE_CLAUDE_MODELS constant from types.ts

quorum-scoreboard.json schema
  → rounds[].votes[model] = "UNAVAIL" | "TP" | "TN" | etc.
  → team.agents[model] = { type, model } — last known identity snapshot
  → VALID_MODELS: claude, gemini, opencode, copilot, codex, deepseek,
                  minimax, qwen-coder, kimi, llama4 (NO glm yet)
  → Live counts: codex=56, gemini=34, opencode=4, copilot=0 (61 rounds)
```

### Health State Derivation (OBS-02)

Health state is derived per agent:
- `error` — identity tool call threw or errored during mcp-status execution
- `quota-exceeded` — agent has UNAVAIL votes in scoreboard rounds (count > 0)
- `available` — 0 UNAVAIL in scoreboard (includes agents not in VALID_MODELS like glm)

### UNAVAIL Count Computation (OBS-04)

```javascript
// Inline node -e script to compute from scoreboard:
const fs = require('fs');
const p = '.planning/quorum-scoreboard.json';
if (!fs.existsSync(p)) { console.log('{}'); process.exit(0); }
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const counts = {};
for (const r of d.rounds || []) {
  for (const [m, v] of Object.entries(r.votes || {})) {
    if (v === 'UNAVAIL') counts[m] = (counts[m] || 0) + 1;
  }
}
const info = {
  counts,
  totalRounds: (d.rounds || []).length,
  lastUpdate: d.team?.captured_at || null
};
console.log(JSON.stringify(info));
```

Scoreboard key → UNAVAIL lookup: `counts['codex']`, `counts['gemini']`, etc.
For agents with no scoreboard key (glm) or not yet voted: default to 0.

### Command Architecture Pattern

QGSD commands follow two patterns:
1. **Thin wrapper** (e.g. `fix-tests.md`): frontmatter + `@workflow-file` reference
2. **Self-contained** (e.g. `quorum.md`): full orchestration inline in the `.md` file

For mcp-status, use **self-contained** — the logic is short (~50 lines) and doesn't justify a separate workflow file.

### Command Frontmatter Pattern

From quorum.md and analysis of existing commands:
```yaml
---
name: qgsd:mcp-status
description: Show status of all connected quorum agents — name, version, model, health, available models, and UNAVAIL count from the scoreboard
allowed-tools:
  - Read
  - Bash
  - mcp__codex-cli__identity
  - mcp__gemini-cli__identity
  - mcp__opencode__identity
  - mcp__copilot-cli__identity
  - mcp__claude-deepseek__identity
  - mcp__claude-minimax__identity
  - mcp__claude-qwen-coder__identity
  - mcp__claude-kimi__identity
  - mcp__claude-llama4__identity
  - mcp__claude-glm__identity
---
```

### Install Mechanism

`bin/install.js` copies everything in `commands/qgsd/` to `~/.claude/commands/qgsd/`. Adding `commands/qgsd/mcp-status.md` makes it installable via `node bin/install.js`. Both source and installed copy are updated directly (matching the pattern used in all prior quick tasks and plans).

### Output Table Format (OBS-01, OBS-02, OBS-03, OBS-04)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MCP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────┬─────────┬──────────────────────────┬────────────────┬───────────────────────────────┬─────────┐
│ Agent               │ Version │ Model                    │ Health         │ Available Models              │ UNAVAIL │
├─────────────────────┼─────────┼──────────────────────────┼────────────────┼───────────────────────────────┼─────────┤
│ codex-cli           │ 1.2.3   │ codex                    │ quota-exceeded │ codex, o3-mini, gpt-4o, ...   │ 56      │
│ gemini-cli          │ 1.1.0   │ gemini-3-pro-preview     │ quota-exceeded │ gemini-3-pro, flash, ...      │ 34      │
│ opencode            │ 1.0.0   │ claude-sonnet-4-6        │ available      │ claude-sonnet-4-6, gpt-4o     │ 4       │
│ copilot-cli         │ 1.2.0   │ gpt-4.1                  │ available      │ gpt-4.1, gpt-4o, claude-3.5   │ 0       │
│ claude-deepseek     │ 1.0.0   │ deepseek-ai/DeepSeek-V3  │ available      │ —                             │ 0       │
│ claude-minimax      │ 1.0.0   │ MiniMaxAI/MiniMax-M2.5   │ available      │ —                             │ 0       │
│ claude-qwen-coder   │ 1.0.0   │ Qwen/Qwen3-Coder-480B    │ available      │ —                             │ 0       │
│ claude-kimi         │ 1.0.0   │ kimi                     │ available      │ —                             │ 0       │
│ claude-llama4       │ 1.0.0   │ meta-llama/Llama-4-M     │ available      │ —                             │ 0       │
│ claude-glm          │ 1.0.0   │ glm-5                    │ available      │ —                             │ 0       │
└─────────────────────┴─────────┴──────────────────────────┴────────────────┴───────────────────────────────┴─────────┘

Scoreboard: 61 rounds recorded | Last update: 2026-02-22T...
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UNAVAIL count tallying | Custom aggregation logic | Node -e inline with scoreboard JSON | Scoreboard schema is well-defined; inline script is 10 lines |
| Agent discovery | Dynamic inspection of .claude.json | Hardcoded list of 10 known agents | List is stable; dynamic parsing adds fragility without benefit |
| Table formatting | Terminal table library | Markdown/Unicode box chars inline | No npm install needed; command is pure markdown prose with embedded code |

**Key insight:** This phase is purely composition — existing tools (identity, scoreboard) provide all data. The command is a rendering/display layer, not a new engine.

## Common Pitfalls

### Pitfall 1: Scoreboard not found (fresh project)
**What goes wrong:** `.planning/quorum-scoreboard.json` doesn't exist in new projects.
**Why it happens:** Scoreboard is only created after the first quorum round.
**How to avoid:** Check if file exists before reading — if absent, show UNAVAIL=0 and health=`unknown` or `available`. Don't error out.
**Warning signs:** Script exits with ENOENT on existsSync guard.

### Pitfall 2: Identity tool call fails (MCP not running or unavailable)
**What goes wrong:** `mcp__codex-cli__identity` throws if codex-cli MCP isn't configured or is down.
**Why it happens:** UNAVAIL agents, quota-exceeded agents, or MCP servers that aren't installed.
**How to avoid:** Wrap each call in try/catch; show health=`error` and fill version/model/available_models with `—` on failure. Never crash the whole command.
**Warning signs:** Single agent failure should not abort the table render.

### Pitfall 3: Missing claude-glm from agent list
**What goes wrong:** Prior research listed 9 agents; the actual install has 10 (including claude-glm).
**How to avoid:** Use the 10-agent list in the command frontmatter. The quorum.md command already mentions GLM in its description.
**Warning signs:** Status table missing claude-glm row.

### Pitfall 4: UNAVAIL count comes from scoreboard model keys, not MCP server names
**What goes wrong:** Scoreboard uses `codex`, `gemini`, `opencode`, `copilot` as model keys — NOT `codex-cli`, `gemini-cli` etc.
**How to avoid:** Maintain an explicit mapping between scoreboard model key and MCP server name when joining data.
**Warning signs:** All UNAVAIL counts show 0 even though codex has 56 failures.

### Pitfall 5: glm not in scoreboard VALID_MODELS
**What goes wrong:** `glm` is not in `update-scoreboard.cjs` VALID_MODELS list yet — scoreboard will never have glm UNAVAIL votes until that's added.
**How to avoid:** Show UNAVAIL=0 for claude-glm (correct behavior, not a bug). Don't warn about missing glm key.
**Warning signs:** Displaying "no data" or error for glm when 0 is the correct value.

### Pitfall 6: available_models array too long for table display
**What goes wrong:** Some agents expose 4+ model names; table becomes unreadable.
**How to avoid:** Display first 3 models + ", ..." if more than 3. Or show "—" for agents where available_models is empty/null.
**Warning signs:** Table columns misalign due to long cell content.

### Pitfall 7: Sequential identity calls (not sibling/parallel)
**What goes wrong:** mcp-status is NOT a quorum command but identity calls should still be sequential.
**Why it happens:** MCP parallelism issues; MEMORY.md explicitly states sequential model calls.
**How to avoid:** Call each identity tool in sequence. Note in command: read-only, NOT in quorum_commands.

### Pitfall 8: Agents in .claude.json vs agents in required_models diverge
**What goes wrong:** The 6 claude-mcp-server instances (deepseek/minimax/qwen-coder/kimi/llama4/glm) are NOT in `required_models` — they're directly in `.claude.json` only.
**How to avoid:** Build the agent list from a static known list (not from required_models alone). The static list of 10 agents is the right approach.

## Code Examples

### Reading scoreboard and computing UNAVAIL counts (inline Bash)

```bash
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
```

### Scoreboard model key → MCP server name mapping (complete, 10 agents)

```
MCP Server Name     → Scoreboard Key → Identity Tool
codex-cli           → codex          → mcp__codex-cli__identity
gemini-cli          → gemini         → mcp__gemini-cli__identity
opencode            → opencode       → mcp__opencode__identity
copilot-cli         → copilot        → mcp__copilot-cli__identity
claude-deepseek     → deepseek       → mcp__claude-deepseek__identity
claude-minimax      → minimax        → mcp__claude-minimax__identity
claude-qwen-coder   → qwen-coder     → mcp__claude-qwen-coder__identity
claude-kimi         → kimi           → mcp__claude-kimi__identity
claude-llama4       → llama4         → mcp__claude-llama4__identity
claude-glm          → glm            → mcp__claude-glm__identity
                                       (glm not yet in VALID_MODELS — UNAVAIL always 0)
```

### Identity tool response schema (from simple-tools.ts, verified)

```typescript
// execute() returns JSON string with these fields:
{
  name: 'claude-mcp-server',           // server binary name
  version: string,                      // from package.json at startup
  model: process.env['CLAUDE_DEFAULT_MODEL'] ?? 'claude-sonnet-4-6',
  available_models: AVAILABLE_CLAUDE_MODELS,  // constant from types.ts
  install_method: 'npm' | 'brew' | 'unknown'
}
```

For the 4 primary quorum agents (codex-cli, gemini-cli, opencode, copilot-cli), each has its own binary with different identity responses depending on implementation.

### Health state derivation logic

```javascript
// For each agent after identity call:
let health;
if (identityFailed) {
  health = 'error';
} else if ((counts[scoreboardKey] || 0) > 0) {
  health = 'quota-exceeded';
} else {
  health = 'available';
}
```

## Plan Decomposition Recommendation

Phase 26 fits in **1 plan**:

**Plan 26-01**: `mcp-status.md` command — call identity on all 10 configured agents, read UNAVAIL from scoreboard, render table (OBS-01, OBS-02, OBS-03, OBS-04)

All 4 requirements (OBS-01..04) are satisfied by one command file. No gsd-tools changes needed. No new workflow file needed. Install both source `commands/qgsd/mcp-status.md` and the installed `~/.claude/commands/qgsd/mcp-status.md`.

**Note:** The existing `26-01-PLAN.md` lists 9 agents and must be updated to include `mcp__claude-glm__identity` in the allowed-tools frontmatter and the agent table within the command.

## Open Questions

1. **available_models display for 4 primary agents**
   - What we know: The 4 primary agents (codex-cli, gemini-cli, opencode, copilot-cli) each have their own binary — their identity tool available_models may be longer arrays
   - What's unclear: Exact number of models each primary agent exposes
   - Recommendation: Truncate at 3 + ", ..." for table readability; this is safe regardless of actual count

2. **glm VALID_MODELS gap**
   - What we know: `glm` not in `update-scoreboard.cjs` VALID_MODELS; no UNAVAIL votes will be recorded
   - What's unclear: Whether adding glm to VALID_MODELS is in scope for Phase 26
   - Recommendation: Out of scope for Phase 26 (OBS requirements don't require tracking glm UNAVAIL). Show 0 with no error. A future phase or quick task can add glm to VALID_MODELS.

3. **26-01-PLAN.md update needed**
   - What we know: Existing plan lists 9 agents (missing claude-glm)
   - What's unclear: Whether to update the plan or let the executor notice the gap
   - Recommendation: Update 26-01-PLAN.md to include claude-glm in both the frontmatter allowed-tools and the agent table inside the command content

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — scoreboard schema, UNAVAIL vote, VALID_MODELS list (verified: glm NOT present)
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — required_models schema, two-layer config structure
- `/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — command frontmatter pattern, MCP tool prefix conventions (confirms 10 agents + GLM)
- `/Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts` — identity tool 5-field response schema (verified from source)
- `~/.claude.json mcpServers` — actual installed MCP server names: 10 servers confirmed (includes claude-glm)
- `~/.claude/qgsd.json` — production required_models configuration (4 primary agents only)

### Secondary (MEDIUM confidence)
- Live scoreboard at `.planning/quorum-scoreboard.json` — confirmed UNAVAIL counts: codex=56, gemini=34, opencode=4, copilot=0 (61 rounds); team.agents keys: codex, gemini, opencode, copilot

### Tertiary (LOW confidence)
- None — all claims verified from source code or live data

## Metadata

**Confidence breakdown:**
- Agent inventory: HIGH — verified from ~/.claude.json live data
- Scoreboard schema and UNAVAIL computation: HIGH — verified from update-scoreboard.cjs source + live data
- Identity tool response schema: HIGH — verified from simple-tools.ts source
- Command implementation pattern: HIGH — same pattern used by 20+ existing commands
- available_models display truncation: MEDIUM — design choice, no single right answer
- glm scoreboard gap: HIGH — confirmed glm not in VALID_MODELS

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain — scoreboard schema and MCP server list unlikely to change)
