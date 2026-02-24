# Feature Research

**Domain:** CLI roster management UI — managing multi-model quorum agent slots
**Researched:** 2026-02-24
**Confidence:** HIGH for inquirer patterns and JSON/keytar mechanics (existing codebase verified); MEDIUM for live dashboard approaches; LOW for CCR routing display conventions (no direct industry analogs)

---

## Context: What Is Already Built

This is a SUBSEQUENT MILESTONE. The following `bin/manage-agents.cjs` features are DONE and must not be re-scoped:

- Agent list view: columns for `#`, `Slot`, `Model`, `Provider`, `Type`, `Billing`, `Upd`, `Timeout` — ASCII table via padded `console.log`
- Edit agent: summary card (box drawing), checkbox field picker, API key via keytar, base URL with provider probe, model list fetch from `/models` endpoint
- Add agent: guided prompts for slot name, command, args, base URL, API key (keytar-stored), model, timeout, providerSlot
- Remove agent: list selector + confirm gate
- Reorder agents: list selector + numeric position input
- Check agent health: per-slot HTTP probe to `/models` endpoint with latency
- Add/edit subprocess provider: full `providers.json` CRUD via guided prompts
- Manage CCR provider keys: set/view/remove AkashML, Together.xyz, Fireworks keys via keytar

The 10 features below are NEW additions for v0.10.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for the Roster Toolkit to feel functional. These are expected based on how comparable CLI management tools work.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Provider preset library | Any tool managing multiple endpoints should let users pick by name, not type URLs | LOW | `providers.json` already encodes AkashML/Together/Fireworks. Preset picker = `list` prompt over known providers with their canonical base URLs auto-filled. Pattern: `aws configure` picks region from a list, not free-form URL entry. |
| Slot cloning | Any entity manager with N-slot support needs "duplicate and modify" to avoid re-entering 8 fields | LOW | Pattern from `kubectl cp`, `docker cp`, `git checkout -b <name> <source>`: clone source slot, prompt for new name, optionally swap one field. All keytar keys should NOT be cloned — new slot gets no key until user sets one. |
| Key expiry warnings | Credential managers always surface invalid keys visually rather than making users probe manually | MEDIUM | Detect on-list: probe keytar key → if 401 on `/models`, annotate slot with `[key 401]` badge in list view. Already know to probe because `probeProviderUrl` exists. Badge pattern: `\x1b[31m[key 401]\x1b[0m` analogous to existing `[key ✓]`/`[no key]` badges. |
| Auto-update policy | Any tool with updates shows update behavior preference per-entity | LOW | Pattern: `npm config set update-notifier false`. For agents, store `auto_update: "always" | "ask" | "never"` in `qgsd.json agent_config[slot]`. Display in edit menu. Integrates with existing `update-agents.cjs`. |
| Per-agent timeout tuning | Any tool managing N entities with latency differences needs per-entity numeric config | LOW | Already partially built: `editAgent()` has `timeout` field. Gap: edit flow shows current value + `perfRow` suggestion from MCP logs. Enhancement: surface suggested timeout more prominently in the summary card. Subprocess providers already have `quorum_timeout_ms` in `providers.json`. |
| Import/export config | Roster portability is expected for any multi-slot config tool | MEDIUM | Export: write sanitized JSON with keys redacted (replace with `"__redacted__"`). Import: read JSON, validate structure, prompt before overwriting any existing slot. JSON is the right format — already the native format for `~/.claude.json` and `providers.json`. Do NOT export env files (keys in plaintext) or TOML (no ecosystem precedent here). |

---

### Differentiators (Competitive Advantage)

Features that go beyond table stakes and leverage QGSD's unique quorum/scoreboard architecture.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Quorum scoreboard inline | Surfacing win/loss stats per slot in the main list closes the feedback loop — users can see which agents are performing before deciding to edit/rotate/remove | MEDIUM | Read from `.planning/quorum-scoreboard.md` (disk-only per design). Parse per-slot W/L counts. Add `W/L` column to `listAgents()` table. Column width: 7 chars max (`999/999`). Must gracefully omit if scoreboard file not found (no quorum data yet). |
| Live health dashboard | Single-screen auto-refreshing view of all slots' probe results — removes need for "Check agent health" per slot | HIGH | Pattern recommendation: simple `setInterval` loop with ANSI cursor-up rewrite — NOT blessed/ink. Reason: blessed is unmaintained (no commits since 2019); ink requires React + full rewrite of existing inquirer-based tool (incompatible stdin handling). Implementation: print N lines, wait 5s, write `\x1b[{N}A` to move cursor up, overwrite. Probe all slots in parallel with Promise.all. Must exit on any keypress to return to menu. Constraint: inquirer cannot run concurrently with an active setInterval that writes to stdout — dashboard must be a separate non-inquirer subcommand mode. |
| CCR routing visibility | Shows which CCR backend (`ccr` CLI + which slot name) each agent uses — transparency into the routing layer | LOW | Data already in `providers.json` (`display_type: "claude-code-router"`, `cli: "/opt/homebrew/bin/ccr"`, `args_template[0]` = slot name like `"claude-1"`). Add `CCR-slot` column to list view for ccr-type providers. Reads from providers.json cross-reference that `listAgents()` already performs. |
| Batch key rotation | Lets user rotate keys across multiple slots in one flow instead of editing each slot individually | MEDIUM | Pattern: checkbox selector (multi-select) → for each selected slot, prompt for new key sequentially → apply all at once → summary of what changed. Follows same keytar storage pattern as single-key edit. Critical: old key must still be valid when user starts rotation — warn not to revoke until all slots are updated. Quorum parallel call note: sequential key setting is correct (keys are independent, no race). |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Replace inquirer with ink/blessed for live dashboard | "Blessed/ink would make a real TUI" | Blessed is unmaintained (last commit 2019, multiple forks but no single active maintainer). Ink requires full React rewrite — all existing prompts (checkbox, list, password, input) would need replacement with `@inkjs/ui` equivalents. Significant scope creep. Inquirer stdin conflicts with ink's React renderer if mixed. | Use ANSI cursor-up rewrite pattern for dashboard. Keep all existing inquirer flows intact. Dashboard is a separate non-interactive display mode with a "press any key to exit" trap. |
| Store API keys in export file | "I want a full backup" | API keys in JSON files on disk are a security incident waiting to happen. Even with file permissions, keys appear in backups, synced drives, version control. | Export with `__redacted__` placeholders. Provide import flow that lets user paste keys interactively after import (re-uses existing `editAgent()` key flow). |
| Auto-revoke old key on rotation | "Full rotation automation" | If the new key fails before the old one is revoked, the slot goes dark with no recovery path. Batch rotation with auto-revoke = potential for cascading outages. | Separate step: "I have confirmed the new key works — remove old key from keytar." User is gate, not automation. |
| Real-time quorum dashboard (live stream results as they happen) | "I want to watch quorum votes come in" | Quorum tool calls are long-running (10-300s each). Live streaming requires a persistent process, websocket or IPC plumbing, and a separate daemon — far outside the manage-agents scope. | Quorum scoreboard inline (static W/L from finished rounds) gives the same signal without any daemon. |
| TOML or env-file export format | "TOML is more readable / env is more portable" | TOML has no precedent in the QGSD/Claude Code ecosystem. Env files put secrets in plaintext. Both add parse complexity with no user benefit beyond aesthetics. | JSON is the native format. All existing config files (`~/.claude.json`, `providers.json`, `qgsd.json`) are JSON. Consistency wins. |
| Per-slot update version pinning | "I want claude-1 on v1.2 and claude-2 on v2.0" | Version pinning across npm global packages requires per-package directory isolation (`npm install -g --prefix ~/.local/claude-1/ claude-mcp-server@1.2`). This is a complex install architecture change, not a UI feature. | `auto_update: "never"` policy effectively pins by suppressing updates. For actual version differences, user manages separately. |

---

## Feature Dependencies

```
Provider preset library
    └──requires──> providers.json canonical URL mapping (already exists)
    └──enhances──> Add agent flow (auto-fills baseUrl)

Slot cloning
    └──requires──> readClaudeJson + writeClaudeJson (already built)
    └──requires──> Slot name input with uniqueness validation (already built in addAgent)
    └──MUST NOT clone──> keytar keys (security: new slot has no key until explicitly set)

Live health dashboard
    └──requires──> probeProviderUrl (already built)
    └──CONFLICTS WITH──> concurrent inquirer prompts (stdout conflict)
    └──implementation pattern──> ANSI cursor-up rewrite + setInterval (not blessed/ink)

Quorum scoreboard inline
    └──requires──> quorum-scoreboard.md on disk (written by quorum hooks, gitignored)
    └──enhances──> listAgents() table (adds W/L column)
    └──MUST degrade gracefully if──> scoreboard file not found

CCR routing visibility
    └──requires──> providers.json display_type + args_template (already exists)
    └──enhances──> listAgents() table (adds CCR-slot column for ccr-type providers)

Batch key rotation
    └──requires──> keytar secrets.cjs (already built)
    └──requires──> Multi-select checkbox prompt (inquirer checkbox, already used)
    └──sequentially calls──> existing applyKeyUpdate() for each slot

Key expiry warnings
    └──requires──> probeProviderUrl (already built)
    └──requires──> keytar key retrieval (already built in editAgent)
    └──enhances──> listAgents() (adds 401 badge to relevant slots)
    └──performance note──> parallel probe of all slots on list; must cap to 5s timeout

Per-agent timeout tuning
    └──requires──> editAgent() timeout field (already built)
    └──requires──> perfRow MCP log data (already built in editAgent summary card)
    └──enhancement only──> surface suggested timeout at edit time with explicit label

Import/export config
    └──requires──> readClaudeJson + writeClaudeJson (already built)
    └──requires──> readProvidersJson + writeProvidersJson (already built)
    └──requires──> Key redaction on export (new: replace keytar values with __redacted__)
    └──requires──> Conflict detection on import (new: check if slot names collide)

Auto-update policy
    └──requires──> qgsd.json agent_config section (already built for auth_type)
    └──integrates with──> updateAgents() from update-agents.cjs (already built)
    └──stored in──> qgsd.json agent_config[slot].auto_update field (new field)
```

---

## MVP Definition

### Launch With (v0.10 — this milestone)

All 10 features are in scope for this milestone. Priority order reflects implementation risk and dependency chain.

- [ ] **Provider preset library** — lowest risk, highest payoff; no new infrastructure
- [ ] **Slot cloning** — pure data manipulation, builds on existing add/edit patterns
- [ ] **CCR routing visibility** — read-only display enhancement to existing list table
- [ ] **Quorum scoreboard inline** — read-only display enhancement; needs graceful degradation
- [ ] **Key expiry warnings** — probe enhancement to list; parallel probes with cap
- [ ] **Per-agent timeout tuning** — edit enhancement; surface perfRow suggestion with label
- [ ] **Auto-update policy** — new field in agent_config; integrates with update-agents.cjs
- [ ] **Batch key rotation** — new flow; builds on applyKeyUpdate, multi-select checkbox
- [ ] **Import/export config** — new flow; needs key redaction + conflict detection logic
- [ ] **Live health dashboard** — highest implementation complexity; ANSI rewrite pattern, separate from inquirer menu

### Suggested Phase Split

Based on complexity and dependency chains:

**Phase v0.10-01 (display + read-only):** Provider presets, slot cloning, CCR routing visibility, quorum scoreboard inline. These are all either read-only display enhancements or simple data manipulation with no new infrastructure.

**Phase v0.10-02 (key lifecycle):** Key expiry warnings, batch key rotation, per-agent timeout tuning, auto-update policy. These touch the credential layer and need careful sequencing.

**Phase v0.10-03 (portability + dashboard):** Import/export config, live health dashboard. These are the most novel patterns relative to existing code.

### Add After Validation (v0.10.x)

- [ ] **Scoreboard reset per slot** — wipe W/L counts for a slot; useful after provider swap changes performance baseline
- [ ] **Key health history** — track 401 timestamps, not just current state; surface "key failed 3 times this week"

### Future Consideration (v0.11+)

- [ ] **Live quorum vote streaming** — requires daemon architecture, out of scope for manage-agents.cjs
- [ ] **Export to shareable provider preset** — share a `providers.json` entry as a gist or file; deferred

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Provider preset library | HIGH | LOW | P1 |
| Slot cloning | HIGH | LOW | P1 |
| CCR routing visibility | MEDIUM | LOW | P1 |
| Quorum scoreboard inline | HIGH | MEDIUM | P1 |
| Key expiry warnings | HIGH | MEDIUM | P1 |
| Per-agent timeout tuning | MEDIUM | LOW | P1 |
| Auto-update policy | MEDIUM | LOW | P2 |
| Batch key rotation | HIGH | MEDIUM | P2 |
| Import/export config | HIGH | MEDIUM | P2 |
| Live health dashboard | HIGH | HIGH | P2 — novel pattern, separate from inquirer |

**Priority key:**
- P1: Must have — directly addresses a friction point in current daily use
- P2: Should have — significantly improves the tool but not a daily blocker
- P3: Nice to have — deferred

---

## Feature-by-Feature UX Pattern Research

### 1. Provider Preset Library

**How similar tools do it:** AWS CLI `aws configure` shows a list of regions from a hardcoded preset list. Heroku CLI `heroku regions` returns a list. The pattern is: `type: 'list'` prompt populated from a known-good set of options, with a "custom" escape hatch for advanced users.

**Recommended UX for QGSD:**
```
Select provider:
  > AkashML (api.akashml.com/v1)
    Together.xyz (api.together.xyz/v1)
    Fireworks (api.fireworks.ai/inference/v1)
    ── custom ──
    Enter URL manually
```
Selecting a preset auto-fills `ANTHROPIC_BASE_URL`. Probe still runs. Manual entry fallback preserved. Preset list sourced from a `KNOWN_PROVIDERS` constant in `manage-agents.cjs` (not from `providers.json` — that file covers subprocess providers, not MCP-server HTTP providers).

**Implementation note:** `KNOWN_PROVIDERS` array is about 5-10 entries. No fetch needed — these URLs are stable. Provider probe runs after selection.

**Dependency on existing code:** Slots into existing `addAgent()` and `editAgent()` `baseUrl` prompts — replaces free-form `input` with `list` + escape hatch to `input`.

---

### 2. Slot Cloning

**How similar tools do it:** `docker container cp`, `git checkout -b <name> <source>`, `kubectl copy`. Pattern: specify source, specify new name, optional modification of one field. The clone gets a new identity but copies all non-sensitive config.

**Recommended UX for QGSD:**
```
Select slot to clone: claude-3
New slot name: claude-7
Provider to use? [keep same / select preset / enter URL]
```
Clone copies: `command`, `args`, `env.ANTHROPIC_BASE_URL`, `env.CLAUDE_DEFAULT_MODEL`, `env.CLAUDE_MCP_TIMEOUT_MS`, `env.PROVIDER_SLOT`. Clone does NOT copy: any keytar key (new slot has `[no key]` until explicitly set). User is informed: "claude-7 created. API key not cloned — set one via Edit agent."

**Dependency on existing code:** Uses `readClaudeJson` + `writeClaudeJson`. Slot name validation reuses the same `validate()` logic from `addAgent()`. Provider preset library (feature 1) optionally slots into the clone flow.

---

### 3. Live Health Dashboard

**How similar tools do it:** `watch -n 5 curl ...` pattern (repeat command, full redraw). `htop`/`btop` use full-screen TUI with ncurses. `docker stats` uses ANSI cursor-up rewrite without a TUI library.

**Why not blessed or ink:**
- `blessed`: original repo (`chjj/blessed`) has zero commits since 2019. The forks (`neo-blessed`, `blessedjs/neo-blessed`, `neo-neo-blessed`) each have 2-5 recent commits but no unified active maintainer. Adding any of these as a dependency is a maintenance debt.
- `ink`: Requires React, JSX, a TypeScript compiler step, and incompatible stdin handling with inquirer's legacy prompt API. Cannot be mixed with existing inquirer flows without a full rewrite.
- Adding either library as a new dependency is an anti-feature (see anti-features section).

**Recommended UX for QGSD:** ANSI cursor-up rewrite pattern.

```javascript
// Pseudocode — not production code
async function healthDashboard() {
  process.stdout.write('\x1b[?25l'); // hide cursor
  let lines = 0;
  const refresh = async () => {
    const results = await Promise.all(slots.map(s => probeSlot(s)));
    const output = renderTable(results);
    if (lines > 0) process.stdout.write(`\x1b[${lines}A`);
    process.stdout.write(output);
    lines = output.split('\n').length;
  };
  await refresh();
  const timer = setInterval(refresh, 5000);
  // Press any key to exit
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.once('data', () => {
    clearInterval(timer);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\x1b[?25h'); // restore cursor
    console.log('\n  Exited health dashboard.\n');
  });
}
```

**Constraint:** This function must be invoked as a separate non-inquirer menu action. The `mainMenu()` loop must not call `inquirer.prompt()` while the dashboard's `setInterval` is active. The cleanest approach: menu dispatches to `healthDashboard()`, which blocks (stdin-trapped) until exit, then returns to `mainMenu()`.

**Probe parallelism:** `Promise.all` across all slots, each with the existing 7s `probeProviderUrl` timeout. Refresh period: 5 seconds between probe cycles (not 5 seconds between display updates — wait for all probes to complete, then wait 5s).

**Confidence:** MEDIUM. The cursor-up pattern is well-established (`docker stats` uses it, `npm install` uses it). The stdin conflict constraint is documented in Inquirer GitHub issue #894 (process.stdin conflicts when passing input/output streams). Risk: raw mode stdin on macOS vs Linux may behave slightly differently.

---

### 4. Quorum Scoreboard Inline

**How similar tools do it:** GitHub CLI `gh run list` appends status badges (`✓`, `✗`, `⏳`) inline with entity names. `kubectl get pods` adds `READY 2/3` and `STATUS Running` as columns. The pattern is: static data columns appended to an existing list table.

**Recommended UX for QGSD:** Add `W/L` column (7 chars wide) to `listAgents()` output. Parse `.planning/quorum-scoreboard.md` at list time. If file absent, column shows `—`. If slot found, show `12/3` (wins/losses). Column is informational only — no interactivity.

**Parsing approach:** The scoreboard file is gitignored and disk-only. Parse with a simple regex per slot name: find the slot's section, extract W/L counts. Do not crash if format changes — fail silently to `—`.

**Dependency on existing code:** Column added to the `W` width object and `header`/`row` construction in `listAgents()`. Scoreboard file path: `.planning/quorum-scoreboard.md` relative to `process.cwd()` (project-specific). Must handle "not in a project directory" gracefully (file not found = all `—`).

---

### 5. CCR Routing Visibility

**How similar tools do it:** Load balancers show "backend: server-3" per request log. Proxy tools show upstream selection in verbose mode. For a static config display, the pattern is simply surfacing the routing decision in the list view rather than burying it in a detail view.

**Recommended UX for QGSD:** For `display_type: "claude-code-router"` providers, the `args_template[0]` field contains the CCR slot name (e.g., `"claude-1"`). Add `CCR` column to list view showing this value for ccr-type entries, `—` for all others. Column width: 10 chars.

**Dependency on existing code:** `listAgents()` already cross-references `providers.json` via `PROVIDER_SLOT`. The `args_template[0]` field is available in the provider object. Add one conditional column to the display logic.

**Low risk:** Read-only, no new data source, no new prompts.

---

### 6. Batch Key Rotation

**How similar tools do it:** AWS IAM key rotation: generate new key → update all consumers → verify → delete old key. The "batch update consumers" step is the one CLI tools help with. Pattern: multi-select list of entities, then sequential prompts for new value per entity.

**Recommended UX for QGSD:**
```
Select slots to rotate keys for:
  [x] claude-1  (AkashML)
  [x] claude-2  (AkashML)
  [ ] claude-3  (Together.xyz)
  [x] claude-4  (Fireworks)
  [ ] claude-5  (Together.xyz)

Rotating 3 slots. For each, enter new key (blank = skip).

claude-1 — enter new key: ************
claude-2 — enter new key: ************
claude-4 — enter new key: (skipped)

Summary: 2 updated, 1 skipped.
Note: Old keys are still active. Revoke them from your provider dashboard once you confirm the new keys work.
```

**Critical UX principle:** Never auto-revoke. Always show the "old keys still active" note. Sequential key prompts (not parallel) so user has time to locate each key. `type: 'password'` for each key input.

**Dependency on existing code:** Uses `inquirer.Separator` + `checkbox` (already used in `editAgent()`). Calls `secretsLib.set()` (already used throughout). The `applyKeyUpdate()` pure function (already extracted) handles the keytar write.

---

### 7. Key Expiry Warnings

**How similar tools do it:** GitHub CLI shows `[expired]` for stale OAuth tokens inline with auth status. Vault shows `ttl: expired` in `vault token lookup`. The pattern is: probe once at list/display time, annotate inline with a colored badge.

**Recommended UX for QGSD:** When `listAgents()` is called, for each slot with an API key set (not `sub` billing), probe the provider with that key. If response is HTTP 401, override the key badge from `[key ✓]` to `[key 401]` in red. Probe happens in parallel with `Promise.all`, capped at 5s timeout.

**Performance caveat:** This adds N parallel HTTP probes on every `listAgents()` call. If user has 10 slots, that's 10 parallel 5s-max probes. Acceptable for an interactive management tool but must not hang. Solution: run probes with `Promise.allSettled` (never rejects), 5s per probe, timeout handled by existing `probeProviderUrl`.

**Implementation note:** 401 detection requires distinguishing "401 = key invalid" from "401 = wrong auth format" (some providers return 401 even without a key). The existing `probeProviderUrl` counts 401 as "healthy" (reachable). For expiry detection, a second probe layer is needed: if `statusCode === 401` AND a key IS configured, that is a key-invalid signal. If `statusCode === 401` AND no key, it's just "auth required" (expected, not an error).

---

### 8. Per-Agent Timeout Tuning

**How similar tools do it:** `kubectl edit deployment <name>` opens the full YAML for editing. `heroku config:set TIMEOUT=30` is direct. For CLI tools managing N entities, the pattern is a guided edit with current value displayed and a suggestion if available.

**Recommended UX for QGSD:** Already partially built — `editAgent()` has a `timeout` field. The enhancement is: surface `perfRow` suggestion at the top of the summary card (not buried at the bottom), and in the timeout edit prompt, pre-fill with the MCP-log-derived suggested value rather than the current configured value.

```
Timeout (currently 30000ms, suggested: 45000ms based on p95 29.3s):
```

For subprocess providers, `editSubprocessProvider()` already has `timeout_ms` and `quorum_timeout_ms` fields. Enhancement: fetch the suggested timeout from MCP logs (same `review-mcp-logs.cjs` call used in `editAgent()`) and display it in the summary card.

**Dependency on existing code:** `review-mcp-logs.cjs --json --tool <slot>` (already called in `editAgent()`). The suggestion logic (`Math.max(15000, Math.ceil(p95Ms * 1.5 / 5000) * 5000)`) is already implemented. This feature is mostly a display enhancement — surfacing the existing suggestion more prominently.

---

### 9. Import/Export Config

**How similar tools do it:**
- `heroku config:get --json` exports env vars as JSON.
- `docker export`/`docker import` dump container filesystems.
- Terraform's `terraform show -json` exports state as JSON with redaction.
- AWS CLI `aws configure export-credentials` redacts secret access keys.

**Recommended format:** JSON. Rationale: `~/.claude.json` is JSON, `providers.json` is JSON, `qgsd.json` is JSON. No format conversion needed. TOML has no ecosystem precedent here. Env files put secrets in plaintext.

**Export schema:**
```json
{
  "version": 1,
  "exported_at": "2026-02-24T...",
  "mcpServers": {
    "claude-1": { "type": "stdio", "command": "node", "args": [...], "env": { "ANTHROPIC_BASE_URL": "...", "ANTHROPIC_API_KEY": "__redacted__" } }
  },
  "providers": [...],
  "agent_config": { "claude-1": { "auth_type": "api", "auto_update": "ask" } }
}
```

**Key redaction:** On export, scan all `env` blocks for any key containing `API_KEY` or `KEY` — replace value with `"__redacted__"`. Do NOT read from keytar for export (keytar keys are not in the `env` block by design — the redaction is for any legacy entries that may still be there).

**Import conflict detection:** Before writing, compare imported slot names against existing slots. For each conflict: "Slot claude-1 already exists — overwrite? Keep existing? Rename imported?" Three-way choice. Defers to user per slot.

**Dependency on existing code:** `readClaudeJson` + `writeClaudeJson` + `readProvidersJson` + `writeProvidersJson` all already built. New logic: redaction pass on export, conflict resolution on import.

---

### 10. Auto-Update Policy

**How similar tools do it:**
- `npm config set update-notifier false` — global disable
- `apt-get unattended-upgrades` — always/ask/never for different package classes
- macOS Software Update: "Automatically check for updates" + "Automatically install updates" as separate toggles

**Recommended UX for QGSD:** Per-slot policy stored in `qgsd.json agent_config[slot].auto_update`. Three values: `"always"` (update on check, no prompt), `"ask"` (prompt before update — default), `"never"` (skip slot during `updateAgents()`).

Policy display in list view: add `AutoUpd` column (7 chars) showing `always`/`ask`/`never`. Or surface in `editAgent()` summary card as a new editable field.

Edit flow:
```
Auto-update policy  ← ask (current)
  always — update without asking
  > ask — prompt before each update
  never — skip this slot during updates
```

**Integration with `update-agents.cjs`:** `updateAgents()` must check `agent_config[slot].auto_update` before prompting or applying updates. Already has the infrastructure to read `qgsd.json`. Policy `"never"` skips the slot entirely. Policy `"always"` skips the confirm prompt. Policy `"ask"` (default) shows existing confirm behavior.

---

## Dependency Matrix: Existing Code Touchpoints

| Feature | Files Modified | Pattern |
|---------|---------------|---------|
| Provider preset library | `manage-agents.cjs` — `addAgent()`, `editAgent()` baseUrl prompt | List prompt replaces input prompt |
| Slot cloning | `manage-agents.cjs` — new `cloneAgent()` function | Reads existing slot, writes new slot |
| Live health dashboard | `manage-agents.cjs` — new `healthDashboard()` function | ANSI cursor-up, setInterval, stdin raw mode |
| Quorum scoreboard inline | `manage-agents.cjs` — `listAgents()` | Reads scoreboard file, adds W/L column |
| CCR routing visibility | `manage-agents.cjs` — `listAgents()` | Reads providers.json args_template[0] |
| Batch key rotation | `manage-agents.cjs` — new `batchRotateKeys()` function | Multi-select checkbox + sequential key prompts |
| Key expiry warnings | `manage-agents.cjs` — `listAgents()` | Parallel probeProviderUrl, 401 badge |
| Per-agent timeout tuning | `manage-agents.cjs` — `editAgent()`, `editSubprocessProvider()` | Surfacing existing perfRow suggestion |
| Import/export config | `manage-agents.cjs` — new `exportConfig()`, `importConfig()` | JSON serialization with redaction |
| Auto-update policy | `manage-agents.cjs` — `editAgent()`, `mainMenu()`; `update-agents.cjs` | New qgsd.json field, policy check in updateAgents |

All 10 features are additive modifications to `bin/manage-agents.cjs` or tight integrations with existing adjacent files. No file replacements. No new npm dependencies required (the ANSI cursor-up dashboard requires no library). The zero-new-dependencies constraint is achievable for all 10 features.

---

## Complexity Summary

| Feature | Phase Fit | Complexity | Reason |
|---------|-----------|------------|--------|
| Provider preset library | v0.10-01 | LOW | Replace one prompt type, add KNOWN_PROVIDERS const |
| Slot cloning | v0.10-01 | LOW | Data manipulation, existing validation patterns |
| CCR routing visibility | v0.10-01 | LOW | Read-only list column, data already in providers.json |
| Quorum scoreboard inline | v0.10-01 | MEDIUM | Parse scoreboard file, graceful degradation |
| Key expiry warnings | v0.10-02 | MEDIUM | Parallel probes on list, 401 detection logic |
| Per-agent timeout tuning | v0.10-02 | LOW | Display enhancement, logic already exists |
| Auto-update policy | v0.10-02 | LOW | New qgsd.json field, update-agents.cjs check |
| Batch key rotation | v0.10-02 | MEDIUM | Multi-select flow, sequential key prompts |
| Import/export config | v0.10-03 | MEDIUM | Key redaction, conflict detection on import |
| Live health dashboard | v0.10-03 | HIGH | ANSI cursor-up, stdin raw mode, setInterval |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` — PRIMARY SOURCE. Full existing implementation reviewed: listAgents, editAgent, addAgent, removeAgent, reorderAgents, checkAgentHealth, addSubprocessProvider, editSubprocessProvider, manageCcrProviders, mainMenu. Existing patterns (probeProviderUrl, fetchProviderModels, keytar via secretsLib, summary card box drawing, checkbox field picker) understood and mapped to each new feature.
- `/Users/jonathanborduas/code/QGSD/bin/providers.json` — PRIMARY SOURCE. Provider entries for claude-1..6, codex-1, gemini-1, opencode-1, copilot-1. CCR routing via `args_template[0]`, `display_type: "claude-code-router"`, `quorum_timeout_ms` fields verified.
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — PRIMARY SOURCE. v0.10 milestone goal and 10 target features confirmed.
- [Inquirer.js GitHub — process.stdin conflict issue #894](https://github.com/SBoudrias/Inquirer.js/issues/894) — MEDIUM confidence. Documents stdin conflict between inquirer and custom raw mode. Informs live dashboard architectural constraint.
- [blessed GitHub (chjj/blessed)](https://github.com/chjj/blessed) — HIGH confidence. Last commit 2019. Confirms unmaintained status. Anti-feature rationale validated.
- [ink GitHub (vadimdemedes/ink)](https://github.com/vadimdemedes/ink) — HIGH confidence. 28k+ stars, actively maintained. React-based, incompatible with existing inquirer-based code without full rewrite.
- [update-notifier — sindresorhus](https://github.com/sindresorhus/update-notifier) — HIGH confidence. "Automatic updating was first tried but wasn't popular" — validates ask/never policy pattern.
- [Docker stats ANSI rewrite pattern](https://github.com/docker/cli/blob/master/cli/command/container/stats.go) — MEDIUM confidence (pattern verified in multiple tools including npm install progress). Cursor-up rewrite is the standard approach for non-TUI live refresh.
- WebSearch: credential rotation batch UX, 401 detection patterns, JSON export redaction best practices — LOW confidence (WebSearch only, supporting general direction).

---

*Feature research for: QGSD v0.10 — Roster Toolkit (10 new manage-agents.cjs features)*
*Researched: 2026-02-24*
