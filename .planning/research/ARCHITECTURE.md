# Architecture Research

**Domain:** QGSD v0.10 — Roster Toolkit: 10 new features for `bin/manage-agents.cjs`
**Researched:** 2026-02-24
**Confidence:** HIGH (all source files read directly; integration points derived from live code; no novel APIs involved)

---

## Context: This Is a Subsequent Milestone

The existing QGSD architecture (v0.1–v0.9) is stable. `manage-agents.cjs` is the interactive roster management UI — a single 1569-line CJS file with inquirer@9 menus, `module.exports._pure` for testable pure functions, and integration with `secrets.cjs`, `update-agents.cjs`, `check-provider-health.cjs`, and `providers.json`.

This file answers 11 specific integration questions for v0.10:

1. Provider preset library — separate module or inline const?
2. Slot cloning — which existing flows does it reuse?
3. Live health dashboard — setInterval+readline vs inquirer conflict?
4. Quorum scoreboard inline — data source and missing-file handling?
5. CCR routing visibility — config location, slot mapping?
6. Batch key rotation — menu screen or editAgent extension?
7. Key expiry detection — where do 401s surface?
8. Per-agent timeout config — which config file?
9. Import/export — full data model definition?
10. Auto-update policy — persistence location?
11. File structure — split into modules or keep monolith?

---

## System Overview — Existing Architecture (v0.9 Stable)

```
~/.claude.json                        # MCP server registry (all slots)
~/.claude/qgsd.json                   # Global QGSD config (quorum_active, agent_config, etc.)
~/.claude/qgsd-key-index.json         # Key presence index (no secrets; bypasses keychain prompt)
~/.claude-code-router/config.json     # CCR routing config (provider→model map, API keys written here)
~/.claude/qgsd-provider-cache.json    # HTTP probe TTL cache (3–5 min)
.planning/quorum-scoreboard.json      # Per-project scoreboard (gitignored)
                                       #   .models{}: legacy family-keyed stats
                                       #   .slots{}: composite "<slot>:<model-id>" keyed stats
                                       #   .rounds[]: full round history
bin/
├── manage-agents.cjs     # Interactive roster UI (single CJS, 1569 lines)
├── secrets.cjs           # Keytar wrapper + syncToClaudeJson + qgsd-key-index.json
├── update-agents.cjs     # Version detection + update for subprocess CLIs
├── check-provider-health.cjs  # HTTP probe of providers behind HTTP slots
├── ccr-secure-config.cjs      # Writes CCR provider keys from keytar into config.json
├── providers.json        # Subprocess provider definitions (slot→cli→model mapping)
├── unified-mcp-server.mjs     # MCP stdio server (PROVIDER_SLOT=X exposes one provider)
└── update-scoreboard.cjs      # CLI to write scoreboard votes atomically
```

### Config Data Model (as-built)

**`~/.claude.json` — mcpServers per slot:**
```json
{
  "mcpServers": {
    "claude-1": {
      "type": "stdio",
      "command": "node",
      "args": ["...unified-mcp-server.mjs"],
      "env": {
        "ANTHROPIC_BASE_URL": "https://...",
        "CLAUDE_DEFAULT_MODEL": "deepseek-ai/...",
        "CLAUDE_MCP_TIMEOUT_MS": "30000",
        "PROVIDER_SLOT": "claude-1"
      }
    }
  }
}
```

**`~/.claude/qgsd.json` — global config:**
```json
{
  "quorum_active": ["codex-1", "gemini-1", ...],
  "agent_config": {
    "claude-1": { "auth_type": "api" },
    "codex-1":  { "auth_type": "sub" }
  },
  "circuit_breaker": { "oscillation_depth": 3, "commit_window": 6 },
  "required_models": { ... },
  "orchestrator": { "model": "...", "provider": "...", "billing": "sub" }
}
```

**`bin/providers.json` — subprocess provider registry:**
```json
{
  "providers": [
    {
      "name": "claude-1",          // PROVIDER_SLOT value
      "type": "subprocess",
      "cli": "/opt/homebrew/bin/ccr",
      "model": "deepseek-ai/DeepSeek-V3.2",
      "display_provider": "AkashML",
      "timeout_ms": 300000,
      "quorum_timeout_ms": 20000,
      "args_template": ["claude-1", "-p", "{prompt}", "--dangerously-skip-permissions"]
    }
  ]
}
```

---

## Integration Architecture: 10 New Features

### Feature 1: Provider Preset Library

**Decision: PROVIDER_PRESETS const in `manage-agents.cjs` (not a separate module).**

The preset library is 10–20 well-known provider configs (AkashML, Together.xyz, Fireworks, etc.). It is read-only, static data with no I/O, no async, no cross-file dependency. A separate module would add require() overhead and an install sync step for no benefit.

**Location:** Top-level const in `manage-agents.cjs`, declared near the existing `CCR_KEY_NAMES` const (line 1295):

```javascript
const PROVIDER_PRESETS = [
  {
    name: 'AkashML',
    baseUrl: 'https://api.akashml.com/v1',
    keyName: 'AKASHML_API_KEY',  // keytar account for CCR keys (or new per-slot key)
    models: ['deepseek-ai/DeepSeek-V3.2', 'MiniMaxAI/MiniMax-M2.5'],
    displayType: 'http',
  },
  {
    name: 'Together.xyz',
    baseUrl: 'https://api.together.xyz/v1',
    keyName: 'TOGETHER_API_KEY',
    models: ['Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8', ...],
    displayType: 'http',
  },
  // ... Fireworks, custom
];
```

**Integration in `addAgent()`:** After the slotName prompt, add a new step: "Select provider preset or enter manually". If a preset is selected, pre-fill baseUrl and model choices. If "Custom", fall through to existing manual prompts. The provider probe step (`probeProviderUrl`) already exists and runs after URL selection — no change needed.

**Integration in `editAgent()`:** In the baseUrl field editing branch, offer presets as a list source alongside manual entry.

**No new files. No install sync step.**

---

### Feature 2: Slot Cloning

**Decision: New `cloneAgent()` function, reusing `addAgent()` data flow but pre-filling from source slot.**

Slot cloning is not a simple extension of `editAgent()` (which edits in-place) or `addAgent()` (which starts blank). It is a distinct flow:

1. Select source slot from `mcpServers` (same list prompt as `editAgent`)
2. Enter new slot name (same validation as `addAgent`)
3. Optionally select a different provider preset or keep the source URL
4. Optionally enter new API key (clone stores its own key in keytar under new account)
5. Model defaults to source slot model; user can override
6. `PROVIDER_SLOT` in the new entry is set to the new slot name (not copied from source)
7. Writes to `mcpServers` via `writeClaudeJson()` — same as `addAgent`

**New data needed (not in existing slots):**
- Source slot's providers.json entry (for model, timeout, display info)
- A new providers.json entry for the clone (if source is a subprocess type) — the user must choose whether the clone goes into providers.json too (Y/N prompt)

**Reuse summary:**
- `readClaudeJson()` / `writeClaudeJson()` — unchanged
- `probeProviderUrl()` — unchanged (runs pre-flight on new URL)
- `secrets.cjs.set()` — unchanged (stores new key under new account)
- `deriveKeytarAccount()` — unchanged (derives from new slot name)

**Implementation: new `cloneAgent()` async function added after `addAgent()`. Added to `mainMenu()` as item 11.**

---

### Feature 3: Live Health Dashboard

**Decision: Separate full-screen render loop using `readline` + `process.stdout.write`, NOT within the inquirer REPL.**

Inquirer@9 owns the TTY while prompts are active — it sets raw mode, intercepts keypresses, and maintains its own cursor state. Running a `setInterval` that clears the screen while inquirer is active corrupts the prompt UI. This is not a timing issue; it is a fundamental architecture conflict.

**Correct architecture: mode switch.**

The live dashboard is a separate "watch mode" that:
1. Exits the inquirer menu loop (`running = false`)
2. Enters a standalone refresh loop using `readline.clearLine` + `process.stdout.write`
3. Reads `process.stdin` for a single keypress to exit (set raw mode, listen for 'q' or Ctrl-C)
4. On exit, re-enters `mainMenu()`

```javascript
async function liveHealthDashboard() {
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let stop = false;
  process.stdin.once('data', (key) => {
    if (key[0] === 0x71 || key[0] === 0x03) stop = true; // 'q' or Ctrl-C
  });

  while (!stop) {
    const results = await checkAllProvidersHealth(); // probeProviderUrl per slot
    process.stdout.write('\x1b[2J\x1b[H'); // clear screen
    renderHealthTable(results);
    process.stdout.write('\n  [q] to exit dashboard\n');
    await new Promise(r => setTimeout(r, 5000)); // 5s refresh interval
  }

  process.stdin.setRawMode(false);
  process.stdin.pause();
}
```

**Health data source:** `probeProviderUrl()` already exists in `manage-agents.cjs`. For the dashboard, call it for every slot that has an `ANTHROPIC_BASE_URL`. Subprocess slots (subprocess type) get a version check via `spawnSync([cli, '--version'])` as a health proxy.

**Refresh interval:** 5 seconds. Not configurable in v0.10 (hardcode; user can exit and re-enter).

**No new dependencies.** readline is Node.js built-in. `probeProviderUrl()` is already in-file.

---

### Feature 4: Quorum Scoreboard Inline

**Data source:** `.planning/quorum-scoreboard.json` in the current working directory (same convention as `update-scoreboard.cjs` and `check-provider-health.cjs`).

**Read pattern:**

```javascript
function readScoreboardSafe() {
  const sbPath = path.join(process.cwd(), '.planning', 'quorum-scoreboard.json');
  try {
    return JSON.parse(fs.readFileSync(sbPath, 'utf8'));
  } catch (_) {
    return null; // missing file → null → show '—' in UI
  }
}
```

**Slot-to-scoreboard mapping:** The scoreboard's `slots{}` map uses composite keys `"<slot>:<model-id>"`. To show inline stats in the `listAgents()` table, look up all keys that start with `"<slotName>:"`, sum or pick the most recent. Fall back to the `models{}` family map using the family name derived by stripping the trailing `-N` digit.

**UI placement:** Add a `Score` column to the existing `listAgents()` table. The column shows `tp/total` win rate or `—` if no scoreboard data. When scoreboard file is missing, the column shows `—` for all slots without error.

**Missing file handling:** Fail-silent at read time. The `null` return from `readScoreboardSafe()` means the table renders normally without the Score column values. No error message shown; this is a non-critical display enhancement.

---

### Feature 5: CCR Routing Visibility

**CCR config location:** `~/.claude-code-router/config.json` (confirmed in `bin/ccr-secure-config.cjs` line 15).

**Config structure:**
```json
{
  "providers": [
    { "name": "akashml", "models": ["deepseek-ai/DeepSeek-V3.2", "MiniMaxAI/MiniMax-M2.5"] },
    { "name": "together", "models": ["Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8", ...] },
    { "name": "fireworks", "models": ["accounts/fireworks/models/kimi-k2p5", ...] }
  ],
  "Router": { "default": "akashml,deepseek-ai/DeepSeek-V3.2" }
}
```

**Slot→CCR provider mapping:** Cross-reference `providers.json` model field → CCR config `providers[].models[]` array. If a slot's model appears in `providers[i].models`, that slot routes through `providers[i].name`.

```javascript
function buildCcrRouteMap(ccrConfig, providersJson) {
  const map = {}; // slotName -> ccrProviderName
  const providersByModel = {};
  for (const p of (ccrConfig.providers || [])) {
    for (const m of (p.models || [])) providersByModel[m] = p.name;
  }
  for (const p of (providersJson.providers || [])) {
    if (p.display_type === 'claude-code-router' && p.model) {
      map[p.name] = providersByModel[p.model] || '?';
    }
  }
  return map;
}
```

**UI placement:** Add a `CCR` column to the `listAgents()` table for slots with `display_type === 'claude-code-router'`. Shows provider name (akashml / together / fireworks). Shows `—` for non-CCR slots. Shows `?` when CCR config is unreadable (missing file — fail-silent same as scoreboard).

**CCR config read pattern:** Try/catch around `fs.readFileSync(CONFIG_PATH)` — fail-silent, return `null`.

---

### Feature 6: Batch Key Rotation

**Decision: New `batchKeyRotation()` function — NOT an extension of `editAgent()`.**

`editAgent()` is single-slot; batch key rotation is inherently multi-slot. The flows share key storage logic (`secrets.cjs.set()`, `deriveKeytarAccount()`) but the UX is completely different.

**Flow:**
1. Checkbox prompt: select which slots to rotate keys for (all API-auth slots pre-selected)
2. For each selected slot, show current masked key, prompt for new key (password input)
3. After all inputs collected, confirm batch ("Rotate N keys?")
4. Apply in sequence: `secretsLib.set()` per slot, then `syncToClaudeJson()` once at end

**Why `syncToClaudeJson()` at end:** The secrets layer's `syncToClaudeJson()` iterates all credentials and patches `~/.claude.json` env blocks. Calling it once after all set() calls is identical to calling it N times — the last call sees all updated values. This saves N-1 redundant file reads/writes.

**New menu item:** Added as item 12, separate from item 3 (Edit agent).

**Reuse:** `deriveKeytarAccount()`, `maskKey()`, `secretsLib.set()`, `syncToClaudeJson()` — all unchanged.

---

### Feature 7: Key Expiry Detection

**Where 401s surface:** `unified-mcp-server.mjs` runs as a child process and logs errors to stderr, but those errors are only visible in `~/.claude/debug/<session-id>.txt` (MCP debug logs). The `probeProviderUrl()` function in `manage-agents.cjs` returns `statusCode: 401` when a key is invalid — this is the detection point.

**Detection architecture:** The health check probe (`probeProviderUrl`) already returns `statusCode`. A 401 response from the `/models` endpoint specifically means: server is reachable but key is invalid. (The probe currently treats 401 as "healthy" for the purpose of reachability; key expiry detection adds a layer on top of this.)

**Implementation:**

```javascript
function classifyProbeResult(probe) {
  if (!probe.healthy) return 'DOWN';
  if (probe.statusCode === 401) return 'KEY_INVALID';
  if (probe.statusCode === 403) return 'KEY_FORBIDDEN';
  return 'UP';
}
```

**UI integration:** In `listAgents()`, for HTTP slots, perform a lightweight probe (reuse `probeProviderUrl()`) and show a `[key invalid]` badge (yellow) when 401, `[down]` badge (red) when connection fails, `✓` when 200/403. For subprocess slots (no HTTP endpoint), show `—`.

**Performance concern:** Running probes on every `listAgents()` call adds latency for large rosters. Mitigation: use the existing TTL cache in `~/.claude/qgsd-provider-cache.json` that `check-provider-health.cjs` already maintains. Read cache before probing; only probe if cache is stale (same TTL logic already in `check-provider-health.cjs`). This deduplicates the probe implementation without merging files.

**Alternative (batch check only):** Only show `[key invalid]` badge in the live health dashboard, not in `listAgents()` (which is a static list). This avoids adding latency to the main menu. Recommendation: add it to the dashboard; show a stale-cache-based badge in `listAgents()` if cache exists.

---

### Feature 8: Per-Agent Timeout Config

**Current state:** Timeout config lives in TWO places:
- `~/.claude.json` env block: `CLAUDE_MCP_TIMEOUT_MS` (controls MCP tool call timeout)
- `bin/providers.json` provider entry: `timeout_ms` (used by `unified-mcp-server.mjs` for subprocess calls), `quorum_timeout_ms` (used by orchestrator)

**For HTTP/CCR slots:** `CLAUDE_MCP_TIMEOUT_MS` in `~/.claude.json` is the authoritative timeout. Already editable via `editAgent()` → `fields: 'timeout'` branch (line 718). No new config file needed.

**For subprocess slots (codex/gemini/opencode/copilot/ccr-backed):** `timeout_ms` and `quorum_timeout_ms` in `providers.json` are the authoritative values. Already editable via `editSubprocessProvider()` → `fields: 'timeout_ms'` and `'quorum_timeout_ms'` branches (lines 1256–1279). No new config file needed.

**Gap:** The `listAgents()` table shows timeout from `providers.json` for PROVIDER_SLOT-mapped entries and from `CLAUDE_MCP_TIMEOUT_MS` for others. This is already consistent.

**Conclusion:** Per-agent timeout config is **already implemented** via the existing edit flows. The v0.10 feature should surface this more visibly (e.g., in the summary card in `editAgent()`) and add a dedicated "Tune timeouts" shortcut menu item that jumps directly to timeout editing without the full edit flow. No new config file. No new persistence layer.

---

### Feature 9: Import/Export

**Full data model to export:**

| Data | Source | Export? | Notes |
|------|--------|---------|-------|
| Slot names | `~/.claude.json` mcpServers keys | YES | Structural identity |
| Slot command/args | `~/.claude.json` mcpServers[slot].{command,args} | YES | Required to reconstruct entry |
| ANTHROPIC_BASE_URL | `~/.claude.json` env | YES | Non-secret config |
| CLAUDE_DEFAULT_MODEL | `~/.claude.json` env | YES | Model preference |
| CLAUDE_MCP_TIMEOUT_MS | `~/.claude.json` env | YES | Timeout config |
| PROVIDER_SLOT | `~/.claude.json` env | YES | Provider cross-ref |
| ANTHROPIC_API_KEY | keytar | **NO** | Never export secrets |
| quorum_active | `~/.claude/qgsd.json` | YES | Quorum composition |
| agent_config (auth_type) | `~/.claude/qgsd.json` | YES | Billing type (not the key itself) |
| providers.json entries | `bin/providers.json` | YES | Subprocess provider definitions |
| quorum_timeout_ms | providers.json per-entry | YES | Subprocess timeouts |
| CCR provider keys | keytar | **NO** | Never export secrets |
| CCR config routes | `~/.claude-code-router/config.json` | YES (structure only, no keys) | Route map without api_key fields |

**Export file format:**
```json
{
  "_qgsd_export": "1.0",
  "exported_at": "2026-02-24T00:00:00Z",
  "slots": {
    "claude-1": {
      "command": "node",
      "args": ["..."],
      "env": {
        "ANTHROPIC_BASE_URL": "https://...",
        "CLAUDE_DEFAULT_MODEL": "deepseek-ai/...",
        "CLAUDE_MCP_TIMEOUT_MS": "30000",
        "PROVIDER_SLOT": "claude-1"
      }
    }
  },
  "quorum_active": ["claude-1", "gemini-1", ...],
  "agent_config": { "claude-1": { "auth_type": "api" } },
  "providers": [ /* providers.json entries, no api_key */ ],
  "ccr_routes": {
    "claude-1": "akashml",
    "claude-3": "together"
  }
}
```

**Import flow:**
1. Read export file, validate `_qgsd_export` version field
2. Diff against current config: show what slots would be added/modified/removed
3. Confirm with user
4. Merge slots into `~/.claude.json` (user chooses: merge or replace)
5. Merge providers into `providers.json`
6. Update `~/.claude/qgsd.json` (quorum_active, agent_config)
7. Remind user to add API keys via manage-agents after import (keys were not exported)

**No new config files.** Export is a JSON file the user saves to disk. Import reads it. Both are new functions `exportRoster()` and `importRoster()` in `manage-agents.cjs`.

---

### Feature 10: Auto-Update Policy

**Persistence location: `~/.claude/qgsd.json` under a new `update_policy` key.**

Reasoning:
- This is a per-slot config value (like `agent_config`)
- It should survive roster import/export (agents carry their policy)
- It is not a per-project override (global only, like `agent_config`)
- `qgsd.json` already has the `agent_config` pattern for per-slot config

**Schema:**
```json
{
  "agent_config": {
    "codex-1": {
      "auth_type": "sub",
      "update_policy": "auto"
    },
    "gemini-1": {
      "auth_type": "sub",
      "update_policy": "prompt"
    }
  }
}
```

**Policy values:** `"auto"` (update silently), `"prompt"` (ask before updating), `"off"` (never auto-check). Default: `"prompt"` when not set.

**Integration in `update-agents.cjs`:** Before running an update for a CLI, check `agent_config[slot].update_policy`. The `buildCliList()` function in `update-agents.cjs` derives CLI entries from `providers.json`, which uses `p.name` as the slot name. Pass policy into `updateAgents()` context by reading `qgsd.json` at the start of the function.

**UI:** New sub-screen "Auto-update settings" accessible from the main menu, showing all subprocess slots with their current policy and allowing changes. Saves to `qgsd.json`.

---

## File Structure Decision: Keep Monolith or Split?

**Decision: Keep `manage-agents.cjs` as a single file. Do NOT split into modules.**

Rationale:
1. **The _pure pattern scales.** All testable logic is already exported via `module.exports._pure`. Adding 10 more features adds 10+ new pure functions to that export — no test infrastructure change needed.
2. **Split cost is high, gain is low.** Splitting would create 3–5 new `.cjs` files, each requiring `require()` chains, install sync steps (the installer copies individual files), and test file updates. The circuit breaker false-positive incident (Phase 18, gsd-tools.cjs monolith note) happened specifically because parallel agents modified the same file — but manage-agents.cjs is edited sequentially per phase, not in parallel.
3. **The file is already well-organized.** The existing pattern of `// --- Section ---` comment blocks with clearly-named functions is readable at 1569 lines. At 2500–3000 lines (post v0.10), it remains manageable.
4. **No circular dependency risk.** All new features depend on existing helpers in the file (readClaudeJson, writeClaudeJson, probeProviderUrl, maskKey) — no reason to externalize.

**Exception:** If a feature has a natural standalone CLI use case (e.g., batch health check script), it stays in `check-provider-health.cjs` or a new dedicated script. `manage-agents.cjs` stays as the interactive UI layer.

**New `_pure` exports to add (for testability):**
```javascript
module.exports._pure = {
  // existing:
  deriveKeytarAccount, maskKey, buildKeyStatus, buildAgentChoiceLabel,
  applyKeyUpdate, applyCcrProviderUpdate,
  // new:
  buildCcrRouteMap,       // CCR routing visibility
  readScoreboardSafe,     // Scoreboard data read (pure if path injected)
  classifyProbeResult,    // Key expiry detection from probe result
  buildExportPayload,     // Import/export data assembly
  validateImportPayload,  // Import file validation
  mergeImportedSlots,     // Import merge logic
  applyUpdatePolicy,      // Auto-update policy read/write
  PROVIDER_PRESETS,       // Preset library const (re-exported for tests)
};
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `manage-agents.cjs` | Interactive roster UI: all 10 new features | `secrets.cjs`, `update-agents.cjs`, `providers.json`, `~/.claude.json`, `~/.claude/qgsd.json`, `~/.claude-code-router/config.json`, `.planning/quorum-scoreboard.json` |
| `secrets.cjs` | Keytar wrapper; key index; syncToClaudeJson | keytar (OS keychain), `~/.claude.json`, `~/.claude/qgsd-key-index.json` |
| `update-agents.cjs` | Version detection + CLI updates | `providers.json`, npm/gh CLI via spawnSync |
| `check-provider-health.cjs` | HTTP probe + TTL cache | `~/.claude.json`, `~/.claude/qgsd-provider-cache.json` |
| `ccr-secure-config.cjs` | Writes CCR API keys from keytar to CCR config | `secrets.cjs`, `~/.claude-code-router/config.json` |
| `providers.json` | Subprocess provider definitions | Read by `manage-agents.cjs`, `unified-mcp-server.mjs`, `update-agents.cjs` |
| `unified-mcp-server.mjs` | MCP stdio server; wraps provider CLIs | `providers.json`, subprocess CLIs |

---

## Data Flow

### Feature Data Flow Overview

```
User → mainMenu() → feature function
                         |
              ┌──────────┼──────────────────────────┐
              v          v                          v
    readClaudeJson()  readProvidersJson()     readQgsdJson()
    ~/.claude.json    bin/providers.json      ~/.claude/qgsd.json
              |          |                          |
              └──────────┴──────────────────────────┘
                                 |
                          modify in-memory
                                 |
              ┌──────────┬───────┴──────────────────┐
              v          v                          v
    writeClaudeJson() writeProvidersJson()    writeQgsdJson()
    (atomic via tmp)  (atomic via tmp)        (new helper)
```

### Batch Key Rotation Flow

```
batchKeyRotation()
  1. readClaudeJson() → extract all API-auth slots
  2. Checkbox: select slots
  3. For each: prompt new key (password input)
  4. Confirm
  5. For each: secretsLib.set('qgsd', deriveKeytarAccount(slot), newKey)
  6. secretsLib.syncToClaudeJson('qgsd')  ← once at end
  7. Print summary
```

### Import/Export Flow

```
exportRoster()
  1. readClaudeJson() → slots
  2. readProvidersJson() → providers (strip api_key if present)
  3. readQgsdJson() → quorum_active, agent_config
  4. readCcrConfig() → build ccr_routes map (no api_key)
  5. Assemble payload (buildExportPayload)
  6. Write to user-specified file path
  7. Print "Export complete. API keys NOT included."

importRoster()
  1. Read file → validateImportPayload()
  2. Diff current state → show changes (add/modify/remove)
  3. Confirm (merge or replace mode)
  4. mergeImportedSlots() → writeClaudeJson()
  5. Merge providers → writeProvidersJson()
  6. Merge quorum_active, agent_config → writeQgsdJson()
  7. Remind: add API keys via Edit agent
```

### CCR Routing Visibility Flow

```
listAgents()
  1. readProvidersJson() → providerMap (existing)
  2. readCcrConfigSafe() → ccrConfig (new, fail-silent)
  3. buildCcrRouteMap(ccrConfig, providerMap) → { slotName: providerName }
  4. In render loop: if slot in ccrRouteMap → show CCR provider in column
```

---

## Architectural Patterns

### Pattern 1: Fail-Silent Reads for Optional Display Data

**What:** Non-critical display data (scoreboard, CCR config) is read in a try/catch that returns `null` on any error. The UI renders `—` for missing values without alerting the user.

**When to use:** Any display enhancement that reads a file that may legitimately be absent (scoreboard doesn't exist until a quorum round runs; CCR config doesn't exist if CCR isn't installed).

**Example:**
```javascript
function readCcrConfigSafe() {
  try {
    return JSON.parse(fs.readFileSync(CCR_CONFIG_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}
```

### Pattern 2: Mode Switch for Non-inquirer UIs

**What:** Features that require a persistent display loop (live health dashboard) exit the inquirer menu, run their own stdin/stdout loop, then re-enter mainMenu() on completion.

**When to use:** Any feature that needs to render repeatedly without user input (watch mode, auto-refresh).

**Trade-offs:**
- Pro: No conflict with inquirer's TTY ownership
- Pro: Clean separation — inquirer handles selection, raw mode handles rendering
- Con: Re-entering mainMenu() creates a new inquirer prompt instance each time (acceptable; no state leak)

### Pattern 3: Collect All Inputs, Apply Once

**What:** Batch operations (batch key rotation, import) collect all user inputs in a confirmation loop before making any writes. The confirmation step shows the full change set. Writes happen only after confirmation.

**When to use:** Any write operation affecting more than one slot or config file.

**Why:** Avoids partial writes when user cancels mid-flow. Matches existing pattern in editAgent() (collect all field changes → apply at end).

### Pattern 4: Two-Layer Config Write (qgsd.json needs a helper)

**What:** Several new features write to `~/.claude/qgsd.json` (auto-update policy, agent_config extensions). Currently there is no `readQgsdJson()` / `writeQgsdJson()` helper in `manage-agents.cjs` — qgsd.json is only read inline via try/catch in `listAgents()` and `editAgent()`. New features need atomic write support.

**Add:**
```javascript
const QGSD_JSON_PATH = path.join(os.homedir(), '.claude', 'qgsd.json');
const QGSD_JSON_TMP = QGSD_JSON_PATH + '.tmp';

function readQgsdJson() {
  try {
    return JSON.parse(fs.readFileSync(QGSD_JSON_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function writeQgsdJson(data) {
  fs.writeFileSync(QGSD_JSON_TMP, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(QGSD_JSON_TMP, QGSD_JSON_PATH);
}
```

This is the same atomic write pattern as `writeClaudeJson()` and `writeProvidersJson()`. These become the canonical qgsd.json I/O pair, replacing all inline reads of that file.

---

## Build Order (Dependency-Aware)

Features are grouped by dependency. Independent features can be built in any order within a group. Groups must be built in sequence.

### Group 1: Zero-Dependency Additions (build in any order)

These features add new data or UI to existing screens without modifying existing logic paths.

| Feature | Why Independent | New Code Location |
|---------|-----------------|-------------------|
| Provider preset library | Read-only const; integrated into addAgent/editAgent as optional input | PROVIDER_PRESETS const + addAgent() branch |
| Quorum scoreboard inline | Read-only; fail-silent; only modifies listAgents() output | readScoreboardSafe() + listAgents() column |
| CCR routing visibility | Read-only; fail-silent; only modifies listAgents() output | readCcrConfigSafe() + buildCcrRouteMap() + listAgents() column |

**Rationale for first:** These three share a common dependency (none) and a common test surface (listAgents() output). Building them first validates the new column structure in listAgents() before adding mutation features.

### Group 2: Depends on readQgsdJson/writeQgsdJson helper (build helper first)

The helper is ~8 lines. Build it as a precursor to all Group 2 features.

| Feature | Why Group 2 | New Code Location |
|---------|-------------|-------------------|
| Per-agent timeout config (dedicated UI) | Reads/writes qgsd.json for timeout_ms config | timeoutSettings() |
| Auto-update policy | Writes agent_config.update_policy to qgsd.json | updatePolicySettings() + update-agents.cjs read |

### Group 3: Depends on existing key management patterns

| Feature | Why Group 3 | New Code Location |
|---------|-------------|-------------------|
| Slot cloning | Reuses addAgent() data flow + secrets.cjs.set() | cloneAgent() |
| Batch key rotation | Reuses secretsLib.set() + syncToClaudeJson() | batchKeyRotation() |
| Key expiry detection | Reads probe statusCode; shows badge in liveHealthDashboard | classifyProbeResult() + dashboard render |

### Group 4: Depends on Group 1 + Group 2 (for complete data model)

| Feature | Why Group 4 | New Code Location |
|---------|-------------|-------------------|
| Live health dashboard | Depends on classifyProbeResult (Group 3) for key expiry badge; on readScoreboardSafe (Group 1) for score display | liveHealthDashboard() |
| Import/Export | Needs complete data model knowledge from all Groups; export payload covers all config sources | exportRoster() + importRoster() + buildExportPayload() + validateImportPayload() + mergeImportedSlots() |

### Suggested Phase Mapping

```
Phase v0.10-01: Foundation
  - PROVIDER_PRESETS const
  - readQgsdJson() / writeQgsdJson() helper
  - readScoreboardSafe() + readCcrConfigSafe() + buildCcrRouteMap()
  - listAgents() extended columns (scoreboard, CCR, key expiry badge from cache)
  - Unit tests for all new pure functions
  No user-facing prompts yet; all read-only. Zero risk to write paths.

Phase v0.10-02: Preset-Aware Add/Clone
  - Provider preset integration in addAgent()
  - cloneAgent() function + menu item
  - Unit tests for cloneAgent data logic

Phase v0.10-03: Batch Key Rotation + Key Expiry
  - batchKeyRotation() function + menu item
  - classifyProbeResult() + key expiry badge in listAgents() (live probe)
  - Unit tests for batchKeyRotation, classifyProbeResult

Phase v0.10-04: Live Health Dashboard
  - liveHealthDashboard() with mode switch
  - 5s refresh loop, rawMode stdin, scoreboard + expiry badge
  - Manual test (interactive — no unit test for raw TTY mode)

Phase v0.10-05: Timeout + Auto-Update Policy UIs
  - Per-agent timeout dedicated sub-screen
  - Auto-update policy settings screen (reads/writes qgsd.json)
  - update-agents.cjs policy integration
  - Unit tests for policy read/write

Phase v0.10-06: Import/Export + Verification
  - exportRoster() + importRoster()
  - buildExportPayload, validateImportPayload, mergeImportedSlots
  - Unit tests for import/export data assembly and validation
  - VERIFICATION.md for all v0.10 requirements
```

---

## Anti-Patterns

### Anti-Pattern 1: setInterval Inside an Inquirer Prompt

**What people do:** Run `setInterval(() => { console.log(table); }, 5000)` while inquirer is waiting for input.

**Why it's wrong:** Inquirer@9 renders its own prompt UI using ANSI escape sequences and maintains cursor position state. An external setInterval writing to stdout corrupts the prompt. The user sees garbled output and the keypress handler may miss events.

**Do this instead:** Exit the inquirer loop before entering refresh mode. Use the mode switch pattern (Feature 3 above). Re-enter inquirer on exit.

### Anti-Pattern 2: Exporting API Keys in Export Payload

**What people do:** Include `ANTHROPIC_API_KEY` in the export file because it is present in `~/.claude.json` env blocks (for legacy installs that didn't use keytar).

**Why it's wrong:** Export files are disk files the user might share or commit. Keys in plaintext disk files are a secret exposure risk.

**Do this instead:** `buildExportPayload()` explicitly deletes `ANTHROPIC_API_KEY` from all env blocks before serialization. Always. Add a unit test that asserts no key appears in any export payload from any input that contains one.

### Anti-Pattern 3: Writing qgsd.json Without Atomic Rename

**What people do:** `fs.writeFileSync(QGSD_JSON_PATH, JSON.stringify(data))` directly.

**Why it's wrong:** If the process is killed mid-write, qgsd.json is truncated or corrupt. Hooks read qgsd.json on every invocation — corrupt config causes hook failures.

**Do this instead:** The `writeQgsdJson()` helper writes to `.tmp` first, then `fs.renameSync()`. Rename is atomic on POSIX. Matches the pattern in `writeClaudeJson()` and `writeProvidersJson()`.

### Anti-Pattern 4: Probing All Slots on Every listAgents() Call

**What people do:** Add `await probeProviderUrl(slot.url)` for every HTTP slot inside `listAgents()`.

**Why it's wrong:** With 6 HTTP slots, each timing out at 7000ms, worst-case `listAgents()` blocks for 42 seconds before rendering. The main menu becomes unusable.

**Do this instead:** Read from the TTL cache (`~/.claude/qgsd-provider-cache.json`) that `check-provider-health.cjs` already maintains. Show cached status in `listAgents()`. Run the live probe only in `liveHealthDashboard()` or `checkAgentHealth()`.

### Anti-Pattern 5: Splitting manage-agents.cjs Prematurely

**What people do:** Extract features into `manage-agents-health.cjs`, `manage-agents-export.cjs`, etc. as soon as the file grows.

**Why it's wrong:** Each split file requires: a new `require()` path, a new `_pure` re-export chain, an installer `copyWithPathReplacement()` entry, and test file updates. The gain (smaller files) is cosmetic; the loss (install sync complexity) is functional.

**Do this instead:** Keep the monolith until a feature has a proven standalone CLI use case (like `check-provider-health.cjs`, which is invoked by hooks directly). Use `// ---------------------------------------------------------------------------` section headers and the `_pure` export pattern to maintain navigability.

---

## Integration Points

### New vs Modified Components

| Component | Status | Notes |
|-----------|--------|-------|
| `manage-agents.cjs` | MODIFIED | Add ~10 new functions + 3 new const/helpers; extend mainMenu() with 4+ new items |
| `update-agents.cjs` | MODIFIED (minor) | Read `update_policy` from qgsd.json in `updateAgents()` and `getUpdateStatuses()` |
| `providers.json` | MODIFIED (at runtime) | Import/export writes new provider entries; no source change |
| `~/.claude/qgsd.json` | MODIFIED (at runtime) | Auto-update policy, import/export writes agent_config |
| `secrets.cjs` | UNMODIFIED | Existing API sufficient for batch rotation |
| `check-provider-health.cjs` | UNMODIFIED | Cache read by manage-agents; probe logic stays there |
| `ccr-secure-config.cjs` | UNMODIFIED | CCR config read path in manage-agents is independent |
| `unified-mcp-server.mjs` | UNMODIFIED | No new features touch MCP server logic |
| hooks (all 3) | UNMODIFIED | Roster features are not planning commands |
| `bin/install.js` | UNMODIFIED | No new files to install (manage-agents.cjs is already installed) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `manage-agents.cjs` → `secrets.cjs` | `require('./secrets.cjs')` (existing pattern) | For batch key rotation, same as editAgent |
| `manage-agents.cjs` → TTL cache | `fs.readFileSync(CACHE_FILE)` (read-only) | Stale cache shown in listAgents; no writes |
| `manage-agents.cjs` → CCR config | `fs.readFileSync(CCR_CONFIG_PATH)` (read-only) | Fail-silent; only route map needed |
| `manage-agents.cjs` → scoreboard | `fs.readFileSync(sbPath)` (read-only) | Fail-silent; project-local .planning/ |
| `manage-agents.cjs` → qgsd.json | `readQgsdJson()` / `writeQgsdJson()` (new helpers) | Auto-update policy, import/export |
| `update-agents.cjs` → qgsd.json | `readQgsdJsonForPolicy()` (new internal read) | Policy check before updating each CLI |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` — HIGH confidence (source read, 1569 lines). All existing flows, data paths, and export pattern.
- `/Users/jonathanborduas/code/QGSD/bin/secrets.cjs` — HIGH confidence (source read). Keytar wrapper, key index, syncToClaudeJson.
- `/Users/jonathanborduas/code/QGSD/bin/update-agents.cjs` — HIGH confidence (source read). CLI metadata, buildCliList(), updateAgents() flow.
- `/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs` — HIGH confidence (source read). TTL cache structure, probe logic, quorum_active filtering.
- `/Users/jonathanborduas/code/QGSD/bin/ccr-secure-config.cjs` — HIGH confidence (source read). CCR_CONFIG_PATH, provider key names, config.json structure.
- `/Users/jonathanborduas/code/QGSD/bin/providers.json` — HIGH confidence (source read). All 10 provider entries, fields: name/type/cli/model/display_provider/timeout_ms/quorum_timeout_ms/display_type.
- `/Users/jonathanborduas/.claude/qgsd.json` — HIGH confidence (source read). quorum_active, agent_config, circuit_breaker, required_models.
- `/Users/jonathanborduas/.claude-code-router/config.json` — HIGH confidence (source read). providers array structure, Router.default, no api_key export.
- `/Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.json` — HIGH confidence (source read). models{} + slots{} composite key structure.
- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — HIGH confidence (source read). slots{} key format `"<slot>:<model-id>"`, VALID_MODELS list.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — HIGH confidence (source read). v0.10 feature list and milestone context.

---

*Architecture research for: QGSD v0.10 — Roster Toolkit (manage-agents.cjs extension)*
*Researched: 2026-02-24*
