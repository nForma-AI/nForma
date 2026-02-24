# Project Research Summary

**Project:** QGSD v0.10 — Roster Toolkit
**Domain:** Node.js CJS CLI extension — interactive agent roster management (manage-agents.cjs)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

QGSD v0.10 adds 10 roster management features to an existing, stable CJS Node.js CLI tool (`bin/manage-agents.cjs`). The codebase is a well-structured 1569-line monolith with a proven pattern: inquirer@8 menus, `module.exports._pure` for testable pure functions, atomic JSON writes via tmp-rename, and keytar for credential storage. All 10 features are achievable as additive modifications to this single file — no new npm dependencies are required, and the monolith should not be split. The one new artifact is a static data file (`bin/provider-presets.json`) with no runtime library backing it.

The recommended build order is six phases ordered by dependency risk: read-only display enhancements first (zero write-path risk), then the `readQgsdJson`/`writeQgsdJson` helper that later phases depend on, then credential-touching features (slot cloning, batch key rotation, key expiry detection), then the live dashboard (highest implementation complexity), then policy UIs, and finally import/export (broadest data model coverage). This ordering ensures each phase validates a narrow surface area before the next phase builds on it, and the most novel pattern (the mode-switch dashboard) is introduced only after all credential and config infrastructure is stable.

The principal risks are all known and documented with precise prevention strategies: the `setInterval`/inquirer stdin conflict that corrupts the terminal if the dashboard is built incorrectly; API key leakage via the keytar fallback path in the export serializer; keychain concurrency errors if batch key rotation uses `Promise.all` instead of sequential iteration; fragile CCR provider name mapping due to a hardcoded name list; and silent partial-apply on import if schema validation is skipped. None of these are novel — they all stem from existing codebase patterns that must be respected rather than bypassed.

---

## Key Findings

### Recommended Stack

All 10 features are implementable with Node.js stdlib and extensions to existing in-file functions. Zero new npm packages are added to `package.json`. The constraint is CJS-only: inquirer@8.2.7 is installed and confirmed CJS; inquirer@9, `log-update@4+`, `ansi-escapes@5+`, `blessed`, and `ink` are all ESM-only or stdin-conflicting and must not be introduced. Pin inquirer to `~8.2.7` (tilde, not caret) to prevent minor-version drift.

**Core technologies:**

- `node:readline` (stdlib) — cursor movement, line clearing, and `emitKeypressEvents` for the live dashboard; replaces all ESM-only ANSI libraries; all methods verified present in Node v25.6.1
- `inquirer@8.2.7` (existing, CJS) — all interactive prompts; must not be upgraded; `~8.2.7` pin
- `node:fs` + atomic `renameSync` (existing pattern) — all config reads and writes; extend to cover `qgsd.json` with new `readQgsdJson`/`writeQgsdJson` helpers using the same tmp-rename pattern
- `probeProviderUrl()` (existing in-file function) — provider health probes; extended to classify 401 responses for key expiry detection via new `classifyProbeResult()` pure function
- `bin/provider-presets.json` (new static data file, no npm dep) — curated provider preset library; loaded via native CJS `require('./provider-presets.json')`

**Do not use:** `Promise.all` for keytar writes (causes keychain concurrency errors and index file race), background polling daemons for 401 detection (unnecessary complexity), schema validation libraries (`ajv`/`zod` are overkill for flat JSON with ~10 known fields), or any ESM-only library in a CJS file.

### Expected Features

All 10 features are in scope for v0.10. Priority ordering reflects implementation risk and dependency chain.

**Must have (table stakes — P1):**
- Provider preset library — name-based provider selection (`aws configure` pattern); auto-fills base URL; `Custom` escape hatch
- Slot cloning — "duplicate and modify" for any N-slot config manager; keytar keys are NOT cloned (new slot has no key until explicitly set)
- CCR routing visibility — read-only list column showing which CCR backend each slot routes through; cross-references `providers.json` `args_template[0]`
- Quorum scoreboard inline — W/L stats per slot in the main list from `.planning/quorum-scoreboard.json`; fail-silent when file absent
- Key expiry warnings — 401 probe badge (`[key invalid]`) in `listAgents()` using TTL cache; live probe in health dashboard only

**Should have (differentiators — P2):**
- Per-agent timeout tuning — surface existing `perfRow` MCP log suggestion more prominently in `editAgent()` summary card; mandatory restart note after every timeout write
- Auto-update policy — `"auto"` / `"ask"` / `"never"` per slot in `qgsd.json agent_config`; audit log at `~/.claude/qgsd-update.log`
- Batch key rotation — multi-select checkbox + sequential key prompts (`for...of`, never `Promise.all`) + single `syncToClaudeJson()` at end
- Import/export config — portable JSON with explicit credential stripping; per-slot three-way conflict resolution (overwrite/keep/rename)
- Live health dashboard — full-screen ANSI cursor-up rewrite; mode-switch architecture (exit inquirer before entering refresh loop); 5s `setInterval`; mandatory "Last updated" timestamp footer

**Defer to v0.10.x or v0.11+:**
- Scoreboard reset per slot — useful post-provider-swap; not blocking for launch
- Key health history — timestamp tracking of 401 events; additive to key expiry warnings
- Live quorum vote streaming — requires daemon/IPC; out of `manage-agents.cjs` scope
- Export to shareable provider preset (gist/file) — deferred

### Architecture Approach

The architecture decision is to extend `manage-agents.cjs` as a single CJS monolith. The `_pure` export pattern scales to 10+ new pure functions without any test infrastructure change. Splitting would require new `require()` chains, install-sync steps, and test file updates — high cost for cosmetic gain. Eight new pure functions are exported via `module.exports._pure` for unit testing. The new `readQgsdJson`/`writeQgsdJson` helper pair (using the existing atomic tmp-rename pattern) is the one structural addition that unlocks Group 2 features.

**Major components and responsibilities:**

1. `manage-agents.cjs` — interactive roster UI; all 10 new features as new functions + `_pure` exports; extends `mainMenu()` with 4+ new items
2. `secrets.cjs` — keytar wrapper; key index; `syncToClaudeJson`; unchanged for v0.10 (existing API sufficient for batch rotation)
3. `update-agents.cjs` — CLI update flow; gains policy check (`agent_config[slot].update_policy`) before each install; gains audit log writes
4. `check-provider-health.cjs` — HTTP probe + TTL cache; `listAgents()` reads cache read-only; no write path change
5. Config files (`~/.claude.json`, `~/.claude/qgsd.json`, `bin/providers.json`) — unchanged structure; new fields only (`update_policy`, `key_status`)

**Key patterns to follow:**

- Fail-silent reads for optional display data (scoreboard, CCR config): `try/catch` returns `null`; UI renders `—`
- Mode switch for non-inquirer UIs: exit inquirer loop, run raw stdin loop, re-enter `mainMenu()` on exit — never run `setInterval` while inquirer is active
- Collect-all-inputs-then-apply-once: batch operations show full change set and confirm before any write
- Atomic write via tmp-rename: all `writeXxx()` helpers use `.tmp` + `renameSync`; `writeQgsdJson()` must follow same pattern

### Critical Pitfalls

1. **setInterval inside inquirer corrupts stdin ownership** — `setInterval` writing to stdout while inquirer holds the TTY garbles the display with interleaved ANSI sequences. Prevention: mode-switch pattern is mandatory for the live dashboard — exit the inquirer menu loop before starting any refresh timer, re-enter `mainMenu()` on exit. Never call `inquirer.prompt()` while a timer has stdout write access.

2. **Export leaks API keys via keytar fallback path** — `addAgent()` has a keytar-unavailable fallback that writes `ANTHROPIC_API_KEY` directly into `~/.claude.json` env blocks; `syncToClaudeJson()` patches live key values back before serialization. Prevention: `buildExportPayload()` must call `sanitizeEnvForExport()` unconditionally, stripping any env key matching `/_KEY$|_SECRET$|_TOKEN$|_PASSWORD$/i`. Never call `syncToClaudeJson()` before reading for export. Unit test: assert zero credential keys in any export payload.

3. **Batch key rotation — keychain concurrency and index file race** — `Promise.all` with `secretsLib.set()` triggers macOS keychain lock contention; concurrent `writeIndex()` calls have a read-modify-write race that silently drops entries from `qgsd-key-index.json`. Prevention: sequential `for...of` loop only; print per-slot progress after each `await`; unit test verifies all entries appear in the index after a multi-slot run.

4. **CCR config name mismatch from hardcoded `CCR_KEY_NAMES`** — the current hardcoded list (`akashml`, `together`, `fireworks`) breaks silently when the user renames providers in `~/.claude-code-router/config.json`. Prevention: read CCR config dynamically via `readCcrConfigSafe()`; derive provider names from the live file; normalize to lowercase before matching.

5. **Import partial-apply with non-portable absolute paths** — imported slot configs from other machines contain absolute paths (e.g., `/Users/other-user/...`) in `args` arrays; these fail silently at agent startup. Prevention: `validateImportSlot()` checks all `args` entries for `/Users/` or `/home/` patterns; reports all validation errors before any write; zero partial applies.

---

## Implications for Roadmap

Based on the dependency build order in ARCHITECTURE.md and the phase groupings in FEATURES.md, 6 phases are recommended.

### Phase v0.10-01: Foundation — Read-Only Display and Helper Infrastructure

**Rationale:** These additions carry zero write-path risk. They only modify `listAgents()` output and add read-only helpers. Building them first validates the new column structure (scoreboard, CCR, key-expiry-from-cache) before any mutation feature builds on top. The `readQgsdJson`/`writeQgsdJson` helper pair is also introduced here as a precondition for all later phases.

**Delivers:** `PROVIDER_PRESETS` const and `bin/provider-presets.json`; `readQgsdJson`/`writeQgsdJson` atomic helper pair; `readScoreboardSafe()`; `readCcrConfigSafe()` + `buildCcrRouteMap()`; extended `listAgents()` table with Score (W/L), CCR, and stale-cache key status columns; all new `_pure` exports and unit tests including missing-file edge cases.

**Addresses:** Provider preset const (data layer), quorum scoreboard inline, CCR routing visibility.

**Avoids:** Scoreboard ENOENT crash on fresh install — `existsSync` guard required (Pitfall 9). CCR name mismatch — dynamic read from CCR config, not hardcoded list (Pitfall 4).

---

### Phase v0.10-02: Preset-Aware Add and Slot Cloning

**Rationale:** Provider presets slot into the existing `addAgent()` and `editAgent()` base-URL prompts as a `list` prompt replacing an `input` prompt. Slot cloning reuses the same `readClaudeJson`/`writeClaudeJson` data flow with a new function. Both are pure config manipulation with no credential writes except the optional new-key prompt in cloning.

**Delivers:** `PROVIDER_PRESETS` wired into `addAgent()` and `editAgent()` base-URL steps with pre-flight provider probe before committing; `cloneAgent()` function and menu item; post-clone prompt to set API key on new slot; slot name uniqueness validation reusing `addAgent()` pattern.

**Addresses:** Provider preset library (full UX), slot cloning.

**Avoids:** Cloned slot showing `[no key]` without explanation — explicit post-clone key prompt (UX Pitfalls table). Provider preset showing unreachable provider — probe runs on selection before slot is written (UX Pitfalls table).

---

### Phase v0.10-03: Key Credential Features (Expiry Detection + Batch Rotation)

**Rationale:** Both features touch the credential layer and share `probeProviderUrl()` and `secretsLib` as dependencies. Grouping them means `classifyProbeResult()` is available for both the key expiry badge (used here in `listAgents()` via TTL cache) and the live dashboard in the next phase.

**Delivers:** `classifyProbeResult()` pure function; `[key invalid]` badge in `listAgents()` driven by TTL cache (not live probe on every render); `batchKeyRotation()` function and menu item; sequential `for...of` key-set loop with per-slot progress output; unit test verifying all rotated slots appear in `qgsd-key-index.json`.

**Addresses:** Key expiry warnings, batch key rotation.

**Avoids:** `Promise.all` keychain concurrency and index race — sequential loop is the only acceptable pattern (Pitfall 3). Key expiry badge persisting after valid key rotation — badge derives from live probe in dashboard, cache-based in list; cache invalidated on rotation (Security Mistakes table).

---

### Phase v0.10-04: Live Health Dashboard

**Rationale:** The dashboard is the highest-complexity feature and depends on `classifyProbeResult()` (Phase 3) for key expiry badges and `readScoreboardSafe()` (Phase 1) for inline score display. Deferring it until all supporting helpers are stable ensures the render surface is complete before the non-trivial stdin/stdout architecture is introduced.

**Delivers:** `liveHealthDashboard()` with mode-switch architecture (exits inquirer, runs raw stdin loop, re-enters `mainMenu()` on exit); `Promise.all` parallel probes with shared 5s timeout; 5s `setInterval` refresh; mandatory "Last updated: HH:MM:SS" footer; yellow stale warning after 60s; `[q]` / Ctrl-C exit with `setRawMode(false)` + `removeAllListeners` teardown before returning; TTY guard falls back to static one-time print in non-TTY contexts.

**Addresses:** Live health dashboard.

**Avoids:** setInterval/inquirer stdin conflict — mode-switch pattern enforced by architecture (Pitfall 1). Missing "Last updated" timestamp — mandatory render element, not optional (Pitfall 6). Sequential probes blocking dashboard — `Promise.all` with shared timeout is required for parallelism (Performance Traps table).

---

### Phase v0.10-05: Policy UIs (Timeout Tuning + Auto-Update Policy)

**Rationale:** Both features read/write `qgsd.json` via the helper pair built in Phase 1. They are naturally grouped as the "per-slot policy settings" surface. Per-agent timeout is primarily a display enhancement on existing edit flows; auto-update policy introduces a new `qgsd.json` field and a light `update-agents.cjs` integration.

**Delivers:** Dedicated "Tune timeouts" sub-screen surfacing `perfRow` suggestion with explicit label at top of summary card; mandatory restart-required note after every timeout write; `agent_config[slot].update_policy` field (`"auto"` / `"ask"` / `"never"`); auto-update policy settings screen in `mainMenu()`; `update-agents.cjs` policy check before each CLI install; `~/.claude/qgsd-update.log` audit file with timestamped entries; `listAgents()` banner when log contains recent ERROR entries.

**Addresses:** Per-agent timeout tuning, auto-update policy.

**Avoids:** Timeout change with no restart note — restart note is mandatory after every timeout write (Pitfall 7). Auto-update silent failures — audit log is a mandatory component; banner surfaces failures on next `listAgents()` call (Pitfall 8).

---

### Phase v0.10-06: Import/Export and Milestone Verification

**Rationale:** Import/export has the broadest data model coverage — it touches every config source (`~/.claude.json`, `providers.json`, `qgsd.json`, CCR config). Building it last means all config write helpers and the complete `agent_config` schema (including `update_policy` from Phase 5) are stable before the export payload is defined. The verification step covers all 10 features end-to-end.

**Delivers:** `exportRoster()` and `importRoster()` functions; `buildExportPayload()`, `validateImportPayload()`, `mergeImportedSlots()` pure functions; `sanitizeEnvForExport()` with defense-in-depth credential stripping (regex + explicit key list); pre-import backup to `~/.claude.json.pre-import.<timestamp>`; per-slot three-way conflict resolution (overwrite/keep existing/rename incoming); `import` command whitelist (`command` must be `node` or `npx`); VERIFICATION.md for all v0.10 requirements.

**Addresses:** Import/export config.

**Avoids:** Export leaking API keys via keytar fallback path — `sanitizeEnvForExport()` runs unconditionally; tested against slot with known plaintext key (Pitfall 2). Import partial-apply with non-portable paths — `validateImportSlot()` checks all `args` before any write (Pitfall 5). Import overwriting production slots silently — per-slot three-way confirmation before write (Anti-Pattern 2 in ARCHITECTURE.md).

---

### Phase Ordering Rationale

- **Read-only first (Phases 1-2):** Zero write-path risk. If a column rendering bug exists, it cannot cause data loss. The new column structure is validated on a real roster before any mutation feature builds on top.
- **Credentials together (Phase 3):** All `secretsLib` write paths are in one phase. The sequential-write constraint and keychain behavior are validated once; the lesson is not spread across phases.
- **Dashboard after credential features (Phase 4):** The live dashboard incorporates key expiry badges and scoreboard inline — both helpers must be validated before the dashboard render loop uses them.
- **Policy after dashboard (Phase 5):** Policy settings write only to `qgsd.json`. Sequencing them after the most complex feature (dashboard) keeps each phase's risk surface bounded.
- **Import/export last (Phase 6):** The broadest data model coverage requires all prior schemas (agent_config, update_policy, providers, CCR routes) to be stable. The full `_pure` export surface is available for comprehensive verification.

### Research Flags

**Phases needing deeper research during planning:**

- **Phase v0.10-03 (Key Credential Features):** macOS keychain sequential write behavior under rapid `secretsLib.set()` calls needs a manual test to confirm the `for...of` loop is sufficient. The `qgsd-key-index.json` read-modify-write race has not been stress-tested with 5+ rapid writes. Validate before shipping batch rotation.
- **Phase v0.10-04 (Live Health Dashboard):** stdin raw mode teardown sequence (`setRawMode(false)`, `removeAllListeners`, cursor restore) on macOS has MEDIUM confidence from community sources. Linux raw mode behavior in non-TTY contexts (CI environments) is not validated. The TTY guard (`process.stdout.isTTY` check before entering dashboard) needs an explicit test.

**Phases with standard patterns (skip research-phase):**

- **Phase v0.10-01 (Foundation):** All patterns are read-only `listAgents()` column extensions. Fail-silent try/catch is a two-liner. No novel patterns.
- **Phase v0.10-02 (Preset + Cloning):** Provider preset is a `list` prompt replacing an `input` prompt — standard inquirer substitution. Slot cloning reuses `readClaudeJson`/`writeClaudeJson` exactly.
- **Phase v0.10-05 (Policy UIs):** Both features use the `readQgsdJson`/`writeQgsdJson` helper pair from Phase 1. Auto-update policy check in `update-agents.cjs` is a single conditional before the existing `runUpdate()` call.
- **Phase v0.10-06 (Import/Export):** Full data model documented in ARCHITECTURE.md with field-by-field export decisions. `sanitizeEnvForExport()` is a straightforward regex + allowlist pass.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technology decisions validated against live source files. Node.js stdlib methods verified against Node v25.6.1 runtime. inquirer@8.2.7 CJS confirmed from `node_modules`. ESM-only rejection of log-update/ansi-escapes/ink confirmed from GitHub release notes. Zero new npm deps. |
| Features | HIGH | All 10 features derived from direct read of `bin/manage-agents.cjs` and `bin/providers.json`. Existing patterns (probeProviderUrl, fetchProviderModels, keytar via secretsLib, summary card, checkbox picker) confirmed for each feature's implementation approach. Complexity estimates based on actual line-count analysis. |
| Architecture | HIGH | All source files read directly. All integration points traced from live code at specific line numbers. No novel external APIs. Build order derived from actual dependency graph, not assumptions. |
| Pitfalls | HIGH | All 10 pitfalls derived from direct inspection of specific line numbers in existing source (e.g., keytar fallback at lines 394-399, CCR_KEY_NAMES at lines 1295-1299, syncToClaudeJson at lines 117-127). Failure modes are documented from real codebase patterns, not hypothetical scenarios. |

**Overall confidence: HIGH**

### Gaps to Address

- **Dashboard raw mode teardown on Linux:** The `process.stdin.setRawMode(false)` + `removeAllListeners('keypress')` sequence is documented as safe for macOS. Linux behavior (particularly in non-TTY contexts like CI) has MEDIUM confidence only. Address during Phase v0.10-04 with an explicit TTY guard (`process.stdout.isTTY`) before entering dashboard mode and an explicit test covering a non-TTY fallback path.

- **Scoreboard composite key format for partial quorum history:** The scoreboard `slots{}` map uses `"<slot>:<model-id>"` composite keys. If a slot has never participated in a quorum round it has no key in the map. Validate `readScoreboardSafe()` against a project with partial quorum participation (some slots present, some absent) during Phase v0.10-01 testing.

- **CCR config absent (no CCR installed):** If `~/.claude-code-router/config.json` does not exist (user has no CCR), the CCR column must show `—` for all slots without any error banner. The `readCcrConfigSafe()` fail-silent pattern handles this, but the test should include a machine state where the CCR config file is absent entirely.

---

## Sources

### Primary (HIGH confidence — first-party source reads)

- `/Users/jonathanborduas/code/QGSD/bin/manage-agents.cjs` — full 1569-line source; all existing flows, data paths, `_pure` export pattern, keytar fallback at lines 394-399, CCR_KEY_NAMES at lines 1295-1299
- `/Users/jonathanborduas/code/QGSD/bin/secrets.cjs` — keytar wrapper, `syncToClaudeJson` credential patch at lines 117-127, key index read-modify-write pattern at lines 18-21
- `/Users/jonathanborduas/code/QGSD/bin/update-agents.cjs` — CLI update flow, `buildCliList()`, `spawnSync` pattern, `runUpdate()` error reporting
- `/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs` — TTL cache structure, probe logic, `quorum_active` filtering
- `/Users/jonathanborduas/code/QGSD/bin/ccr-secure-config.cjs` — CCR config path (line 15), hardcoded `providerKeyMap` (lines 69-73) identified as fragility
- `/Users/jonathanborduas/code/QGSD/bin/providers.json` — all 10 provider entries, CCR routing fields (`args_template`, `display_type`)
- `/Users/jonathanborduas/.claude/qgsd.json` — `agent_config` structure, quorum_active, circuit_breaker
- `/Users/jonathanborduas/.claude-code-router/config.json` — live CCR provider names and `Router.default`; `api_key` fields confirmed present (must not export)
- `/Users/jonathanborduas/code/QGSD/.planning/quorum-scoreboard.json` — `slots{}` composite key format `"<slot>:<model-id>"`, `models{}` family map
- `node_modules/inquirer/package.json` — confirmed version 8.2.7, `"type": "commonjs"`
- Node.js readline official docs — `cursorTo`, `moveCursor`, `clearLine`, `clearScreenDown`, `emitKeypressEvents` all confirmed present in Node v25.6.1 via `node -e` runtime verification

### Secondary (MEDIUM confidence — community sources)

- GitHub sindresorhus/log-update issue #54 — ESM-only from v4 confirmed; `require()` throws `ERR_REQUIRE_ESM`
- GitHub sindresorhus/ansi-escapes releases — ESM-only from v5.0.0 (April 2020); v4.3.2 last CJS
- GitHub SBoudrias/Inquirer.js discussion #1126 — v9 is ESM-only; v8 is CJS confirmed
- GitHub SBoudrias/Inquirer.js issues #495, #1358, #811, #870, #894 — stdin raw mode conflicts with concurrent TUI libraries; process.stdin ownership during active prompt
- GitHub chjj/blessed — last commit 2019; confirms unmaintained status; anti-feature rationale validated
- Docker stats ANSI cursor-up rewrite pattern — standard approach for non-TUI live refresh; confirmed in multiple tools (npm install progress, `docker stats` source)

### Tertiary (LOW confidence — general direction only)

- WebSearch results on credential rotation batch UX patterns (AWS IAM rotation flow)
- WebSearch results on JSON export redaction best practices (Terraform `show -json`, AWS CLI `export-credentials`)

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
