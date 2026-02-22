# Requirements: QGSD

**Defined:** 2026-02-22
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.5 Requirements

Requirements for the MCP Setup Wizard milestone. Each maps to roadmap phases 29–33.

### Wizard UX (WIZ)

- [ ] **WIZ-01**: User can run `/qgsd:mcp-setup` to start the MCP configuration wizard
- [ ] **WIZ-02**: First run (no configured agents) presents a guided linear onboarding flow step by step
- [ ] **WIZ-03**: Re-run shows the current agent roster as a navigable menu
- [ ] **WIZ-04**: Each agent in the menu shows current model, provider, and key status (present/missing)
- [ ] **WIZ-05**: User confirms before changes are applied; wizard restarts affected agents after apply

### API Key Management (KEY)

- [ ] **KEY-01**: User can set or update the API key for any agent through the wizard
- [ ] **KEY-02**: Key is stored securely via keytar (bin/secrets.cjs)
- [ ] **KEY-03**: Wizard writes key from keytar to `~/.claude.json` mcpServers env block during apply
- [ ] **KEY-04**: Wizard automatically restarts the agent after key changes take effect

### Provider Swap (PROV)

- [ ] **PROV-01**: User can change the base URL (provider) for an existing agent
- [ ] **PROV-02**: Wizard offers curated provider list (AkashML, Together.xyz, Fireworks) + custom entry
- [ ] **PROV-03**: Wizard updates `~/.claude.json` ANTHROPIC_BASE_URL and restarts agent on apply

### Agent Roster (AGENT)

- [ ] **AGENT-01**: User can add a new claude-mcp-server instance (name, provider, model, key)
- [ ] **AGENT-02**: User can remove an existing agent from the roster
- [ ] **AGENT-03**: Wizard runs identity ping to verify connectivity after provisioning new agent

### Install Integration (INST)

- [ ] **INST-01**: Installer detects no configured quorum agents and prompts user to run `/qgsd:mcp-setup`

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
| WIZ-01 | Phase 29 | Pending |
| WIZ-02 | Phase 29 | Pending |
| WIZ-03 | Phase 29 | Pending |
| WIZ-04 | Phase 29 | Pending |
| WIZ-05 | Phase 29 | Pending |
| KEY-01 | Phase 30 | Pending |
| KEY-02 | Phase 30 | Pending |
| KEY-03 | Phase 30 | Pending |
| KEY-04 | Phase 30 | Pending |
| PROV-01 | Phase 31 | Pending |
| PROV-02 | Phase 31 | Pending |
| PROV-03 | Phase 31 | Pending |
| AGENT-01 | Phase 32 | Pending |
| AGENT-02 | Phase 32 | Pending |
| AGENT-03 | Phase 32 | Pending |
| INST-01 | Phase 33 | Pending |

**Coverage:**
- v0.5 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after initial definition*
