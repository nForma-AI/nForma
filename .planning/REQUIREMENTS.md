# Requirements: nForma

**Defined:** 2026-03-12
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following

## Milestone v0.35 Requirements

### Install
- [ ] **INST-01**: Source checkout install auto-rebuilds hooks/dist so hooks work without manual `npm run build:hooks`
- [ ] **INST-02**: Install detects missing hooks/dist files and either rebuilds or warns with clear instructions

### MCP Setup
- [ ] **SETUP-01**: `/nf:mcp-setup` re-run correctly identifies codex-1 (and other native CLI slots) as subscription agents, not API/provider-backed slots
- [ ] **SETUP-02**: Slot type classification uses `auth_type` from providers.json rather than inferring from slot name prefix

### Cross-Platform
- [ ] **XPLAT-01**: Provider definitions use runtime CLI path resolution (`resolve-cli.cjs` or `which`) instead of hardcoded `/opt/homebrew/bin/` paths
- [ ] **XPLAT-02**: Provider binary paths work on macOS (Homebrew), Linux (apt/snap), and WSL without manual configuration

### TUI
- [ ] **TUI-01**: TUI "Add Agent → CLI Agent" generates a working MCP entry that correctly specifies the CLI binary path and args for Codex/Gemini/OpenCode/Copilot slots
- [ ] **TUI-02**: Generated MCP entries match the format produced by `mcp-setup` wizard for the same slot types

## Out of Scope

| Feature | Reason |
|---------|--------|
| Windows support (GitHub #3) | Explicitly removed from supported platforms; enhancement, not bug fix |
| GSD plugin coexistence guards | Identified in quorum session but not a filed issue; future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INST-01 | — | Pending |
| INST-02 | — | Pending |
| SETUP-01 | — | Pending |
| SETUP-02 | — | Pending |
| XPLAT-01 | — | Pending |
| XPLAT-02 | — | Pending |
| TUI-01 | — | Pending |
| TUI-02 | — | Pending |

**Coverage:**
- v0.35 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8 (pending roadmap)

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after milestone v0.35 start*
