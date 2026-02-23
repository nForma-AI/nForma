# Requirements: QGSD

**Defined:** 2026-02-22
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.6 Requirements (Complete)

Requirements for the Agent Slots & Quorum Composition milestone. Phase 39 satisfied SLOT-01..04; COMP/SCBD/MULTI/WIZ carried to v0.7.

### Slot-based Naming (SLOT)

- [x] **SLOT-01**: User sees all quorum agents referred to by slot name (`claude-1`, `copilot-1`, `gemini-cli-1`, etc.) in all QGSD output and commands
- [x] **SLOT-02**: Migration script renames existing `~/.claude.json` mcpServers entries from model-based names to slot names automatically (non-destructive, invertible)
- [x] **SLOT-03**: All QGSD source files (hooks, orchestrator, commands, scoreboard tooling) updated to use new slot names — no old names remain
- [x] **SLOT-04**: `mcp-status`, `mcp-set-model`, `mcp-update`, `mcp-restart` accept and display slot names correctly

## v0.7 Requirements (Pending)

Requirements for the Composition Config & Multi-Slot milestone. Phases 40–42.

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
- [x] **WIZ-10**: User can add a new slot for any family (claude, copilot, opencode, codex-cli, gemini-cli) from within the wizard, which writes the new entry to `~/.claude.json` and triggers restart

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
| SLOT-01 | Phase 39 | Complete |
| SLOT-02 | Phase 39 | Complete |
| SLOT-03 | Phase 39 | Complete |
| SLOT-04 | Phase 39 | Complete |
| COMP-01 | Phase 40 | Pending |
| COMP-02 | Phase 40 | Pending |
| COMP-03 | Phase 40 | Pending |
| COMP-04 | Phase 40 | Pending |
| SCBD-01 | Phase 40 | Pending |
| SCBD-02 | Phase 40 | Pending |
| SCBD-03 | Phase 40 | Pending |
| MULTI-01 | Phase 41 | Pending |
| MULTI-02 | Phase 41 | Pending |
| MULTI-03 | Phase 41 | Pending |
| WIZ-08 | Phase 42 | Pending |
| WIZ-09 | Phase 42 | Pending |
| WIZ-10 | Phase 42 | Complete |

**Coverage:**
- v0.6 SLOT requirements: 4 total — all Complete ✓
- v0.7 requirements: 13 total
- Mapped to phases: 13 (Phases 40–42)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-23 — v0.7 active requirements file created from v0.6 archive; SLOT-01..04 marked [x] per Phase 39 VERIFICATION.md; COMP/SCBD/MULTI/WIZ-08..10 Phase assignments confirmed as gap closure from v0.6 audit*
