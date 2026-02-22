# Requirements: QGSD

**Defined:** 2026-02-22
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.5 Requirements

Requirements for the MCP Setup Wizard milestone. Covered by phases 32–36; gap closure phases 37–38.

### Wizard UX (WIZ)

- [x] **WIZ-01**: User can run `/qgsd:mcp-setup` to start the MCP configuration wizard
- [x] **WIZ-02**: First run (no configured agents) presents a guided linear onboarding flow step by step
- [x] **WIZ-03**: Re-run shows the current agent roster as a navigable menu
- [x] **WIZ-04**: Each agent in the menu shows current model, provider, and key status (present/missing)
- [x] **WIZ-05**: User confirms before changes are applied; wizard restarts affected agents after apply

### API Key Management (KEY)

- [x] **KEY-01**: User can set or update the API key for any agent through the wizard
- [x] **KEY-02**: Key is stored securely via keytar (bin/secrets.cjs)
- [x] **KEY-03**: Wizard writes key from keytar to `~/.claude.json` mcpServers env block during apply
- [x] **KEY-04**: Wizard automatically restarts the agent after key changes take effect

### Provider Swap (PROV)

- [x] **PROV-01**: User can change the base URL (provider) for an existing agent
- [x] **PROV-02**: Wizard offers curated provider list (AkashML, Together.xyz, Fireworks) + custom entry
- [x] **PROV-03**: Wizard updates `~/.claude.json` ANTHROPIC_BASE_URL and restarts agent on apply

### Agent Roster (AGENT)

- [x] **AGENT-01**: User can add a new claude-mcp-server instance (name, provider, model, key)
- [x] **AGENT-02**: User can remove an existing agent from the roster
- [x] **AGENT-03**: Wizard runs identity ping to verify connectivity after provisioning new agent

### Install Integration (INST)

- [x] **INST-01**: Installer detects no configured quorum agents and prompts user to run `/qgsd:mcp-setup`

## v0.4 Requirements (Complete)

Requirements satisfied during v0.4 MCP Ecosystem milestone.

### Observability (OBS)

- [x] **OBS-01**: User can run `/qgsd:mcp-status` to see all connected MCPs with name, version, current model, and availability
- [x] **OBS-02**: Status display shows health state (available / quota-exceeded / error) derived from scoreboard data
- [x] **OBS-03**: Status shows available models for each agent (from `identity` tool response)
- [x] **OBS-04**: Status shows recent UNAVAIL count per agent from quorum scoreboard

### Standardization (STD)

- [x] **STD-02**: All 4 Gen1 MCP server repos (claude, codex, copilot, openhands) ported to Gen2 per-tool architecture (`*.tool.ts` + `registry.ts`) with Gen1 files (`definitions.ts`, `handlers.ts`) removed — all repos on main branch
- [x] **STD-10**: gemini-mcp-server npm package name is unscoped (`gemini-mcp-server`, not `@tuannvm/gemini-mcp-server`) — `~/.claude.json` mcpServers["gemini-cli"].args reflects the unscoped name

## v0.6 Requirements (Upcoming)

Requirements for the Agent Slots & Quorum Composition milestone. Maps to phases 39–42.

### Slot-based Naming (SLOT)

- [ ] **SLOT-01**: User sees all quorum agents referred to by slot name (`claude-1`, `copilot-1`, `gemini-cli-1`, etc.) in all QGSD output and commands
- [ ] **SLOT-02**: Migration script renames existing `~/.claude.json` mcpServers entries from model-based names to slot names automatically (non-destructive, invertible)
- [ ] **SLOT-03**: All QGSD source files (hooks, orchestrator, commands, scoreboard tooling) updated to use new slot names — no old names remain
- [ ] **SLOT-04**: `mcp-status`, `mcp-set-model`, `mcp-update`, `mcp-restart` accept and display slot names correctly

### Composition Config (COMP)

- [ ] **COMP-01**: User can define a `quorum.active` array in `qgsd.json` listing which slots participate in quorum
- [ ] **COMP-02**: Quorum orchestrator reads `quorum.active` from config instead of a hardcoded agent list; only active slots are called
- [ ] **COMP-03**: `check-provider-health.cjs` and scoreboard tooling derive agent list from `quorum.active` rather than hardcoded arrays
- [ ] **COMP-04**: Default `quorum.active` is auto-populated at install/migration time based on discovered slots in `~/.claude.json`

### Multiple Slots (MULTI)

- [ ] **MULTI-01**: User can have multiple `claude-*` slots (`claude-1` through `claude-N`) each running a different model or provider
- [ ] **MULTI-02**: User can have multiple `copilot-N`, `opencode-N`, `codex-cli-N`, and `gemini-cli-N` slots as separate `~/.claude.json` entries
- [ ] **MULTI-03**: Adding a new slot of any family is supported by both direct config edit and via the mcp-setup wizard

### Wizard Composition Screen (WIZ)

- [ ] **WIZ-08**: `/qgsd:mcp-setup` re-run menu includes an "Edit Quorum Composition" option
- [ ] **WIZ-09**: Composition screen shows all discovered slots with on/off toggle for `quorum.active` inclusion
- [ ] **WIZ-10**: User can add a new slot for any family (claude, copilot, opencode, codex-cli, gemini-cli) from within the wizard, which writes the new entry to `~/.claude.json` and triggers restart

### Scoreboard Slot Tracking (SCBD)

- [ ] **SCBD-01**: Scoreboard tracks performance by slot name (`claude-1`, `copilot-1`) — slot is the stable key
- [ ] **SCBD-02**: Each scoreboard entry displays the current model loaded in that slot as context
- [ ] **SCBD-03**: When a slot's model changes, a new scoreboard row is created for that slot

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Wizard UX

- **WIZ-06**: Wizard supports undo — user can revert a change applied in the same session
- **WIZ-07**: Wizard exports current configuration as a shareable config file

### Agent Roster

- **AGENT-04**: Wizard supports non-claude-mcp-server agents (opencode, copilot, codex native CLIs)
- **AGENT-05**: Wizard can bulk-import a roster from a config file

### Secrets

- **KEY-05**: claude-mcp-server reads API key from keytar at startup (removes key from ~/.claude.json env)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI for configuration | Claude Code slash commands are the interface — no separate web app |
| Per-project agent roster | Global config only — matches GSD's install pattern and v0.x constraint |
| Non-quorum MCP server management | Scope is quorum agents (claude-mcp-server instances) only |
| Automatic provider selection / benchmarking | Too complex for v0.5; user chooses provider explicitly |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WIZ-01 | Phase 32 | Complete |
| WIZ-02 | Phase 32 | Complete |
| WIZ-03 | Phase 32 | Complete |
| WIZ-04 | Phase 32 | Complete |
| WIZ-05 | Phase 32 | Complete |
| KEY-01 | Phase 33 | Complete |
| KEY-02 | Phase 33 | Complete |
| KEY-03 | Phase 33 | Complete |
| KEY-04 | Phase 33 | Complete |
| PROV-01 | Phase 34 | Complete |
| PROV-02 | Phase 34 | Complete |
| PROV-03 | Phase 34 | Complete |
| AGENT-01 | Phase 35 | Complete |
| AGENT-02 | Phase 35 | Complete |
| AGENT-03 | Phase 35 | Complete |
| INST-01 | Phase 36 | Complete |
| OBS-01 | Phase 29 (gap closure) | Complete |
| OBS-02 | Phase 29 (gap closure) | Complete |
| OBS-03 | Phase 29 (gap closure) | Complete |
| OBS-04 | Phase 29 (gap closure) | Complete |
| STD-02 | Phase 24 + Phase 31 (gap closure) | Complete |
| STD-10 | Phase 23 + Phase 30 (gap closure) | Complete |

| SLOT-01 | Phase 39 | Pending |
| SLOT-02 | Phase 39 | Pending |
| SLOT-03 | Phase 39 | Pending |
| SLOT-04 | Phase 39 | Pending |
| COMP-01 | Phase 40 | Pending |
| COMP-02 | Phase 40 | Pending |
| COMP-03 | Phase 40 | Pending |
| COMP-04 | Phase 40 | Pending |
| MULTI-01 | Phase 41 | Pending |
| MULTI-02 | Phase 41 | Pending |
| MULTI-03 | Phase 41 | Pending |
| WIZ-08 | Phase 42 | Pending |
| WIZ-09 | Phase 42 | Pending |
| WIZ-10 | Phase 42 | Pending |
| SCBD-01 | Phase 40 | Pending |
| SCBD-02 | Phase 40 | Pending |
| SCBD-03 | Phase 40 | Pending |

**Coverage:**
- v0.5 requirements: 16 total — all Complete ✓
- Mapped to phases: 16 (Phases 32–36)
- v0.4 requirements completed: 6 (OBS-01–04, STD-02, STD-10)
- v0.6 requirements: 17 total
- Mapped to phases: 17 (Phases 39–42)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 — v0.5 gap closure phases 37–38 added; v0.6 phases renumbered 39–42; v0.5 checkboxes marked complete*
