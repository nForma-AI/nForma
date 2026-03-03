# Requirements: QGSD v0.26 Operational Completeness

**Defined:** 2026-03-03
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following

## v0.26 Requirements

Requirements for milestone v0.26. Each maps to roadmap phases.

### Installer & CLI

- [ ] **PORT-01**: User can export full roster config to a portable JSON file — all API key values replaced with `__redacted__` placeholders
- [ ] **PORT-02**: User can import roster config from JSON file — validates schema, prompts to re-enter any redacted key, confirms before applying
- [ ] **PORT-03**: Import creates a timestamped backup of `~/.claude.json` before applying any changes
- [ ] **PRST-01**: User can select a named provider preset (AkashML / Together.xyz / Fireworks.ai) in addAgent/editAgent flow instead of manually typing a URL
- [ ] **PRST-02**: User can clone an existing slot — copies provider URL and model config, prompts for new slot name
- [ ] **REN-03**: All hardcoded `get-shit-done/` path strings removed from `bin/gsd-tools.cjs`, workflow files, agent files, and template files

### Configuration

- [ ] **CRED-01**: User can rotate API keys across multiple slots in a single batch flow from the main menu
- [ ] **CRED-02**: Key validity status persists to `qgsd.json` after each health probe (enables DISP-03 badge to survive across sessions without re-probing)
- [ ] **PLCY-01**: User can set quorum timeout (ms) per slot from a dedicated menu shortcut — not buried inside editAgent
- [ ] **PLCY-02**: User can configure update policy per slot: auto / prompt / skip
- [ ] **PLCY-03**: Auto-update policy check runs on manage-agents startup for slots configured as `auto`

### Observability & Diagnostics

- [ ] **DASH-01**: User can open a live health dashboard from main menu showing all slots' provider, model, and health status
- [ ] **DASH-02**: Dashboard refreshes on keypress (space / r) with a visible "last updated" timestamp shown at bottom
- [ ] **DASH-03**: Dashboard exits cleanly on Q or Escape, returning to main menu with stdin fully restored (no character-swallowing)

### Architecture

- [ ] **ARCH-10**: QGSD, as a Claude Code plugin, MUST NOT bundle LLM SDKs; Haiku/Sonnet/Opus calls MUST use the Agent tool's model parameter

### Planning & Tracking

- [ ] **DECOMP-05**: `analyze-state-space.cjs` identifies model pairs sharing source files or requirement prefixes, estimates the merged state space, and recommends merge when combined TLC runtime < 5 minutes — or flags the interface contract needed when merge would exceed the time budget

## Future Requirements

Deferred — not in current milestone scope.

(None identified — all pending requirements included in v0.26)

## Out of Scope

Explicitly excluded from v0.26.

| Feature | Reason |
|---------|--------|
| Per-project install | Global-only in v0.x per Key Decision from v0.1 |
| Real-time WebSocket dashboard | Terminal TUI is sufficient; web dashboard deferred |
| Automated credential provisioning | Users manage their own API keys; QGSD only rotates/stores |
| UPPAAL timing model composition | Single-model UPPAAL sufficient; composition deferred |
| Mind map generation | Deferred from v0.16; not operational priority |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PORT-01 | — | Pending |
| PORT-02 | — | Pending |
| PORT-03 | — | Pending |
| PRST-01 | — | Pending |
| PRST-02 | — | Pending |
| REN-03 | — | Pending |
| CRED-01 | — | Pending |
| CRED-02 | — | Pending |
| PLCY-01 | — | Pending |
| PLCY-02 | — | Pending |
| PLCY-03 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| ARCH-10 | — | Pending |
| DECOMP-05 | — | Pending |

**Coverage:**
- v0.26 requirements: 16 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 16

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
