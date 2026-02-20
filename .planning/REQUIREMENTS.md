# Requirements: QGSD

**Defined:** 2026-02-20
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v1 Requirements

All features are v1. No deferral.

### Stop Hook — Core Gate

- [x] **STOP-01**: Stop hook reads transcript JSONL for tool_use entries matching configured quorum model names
- [x] **STOP-02**: Stop hook checks `stop_hook_active` flag first — if true, exits 0 immediately (infinite loop prevention)
- [x] **STOP-03**: Stop hook checks `hook_event_name` — if `SubagentStop`, exits 0 immediately (subagent exclusion)
- [x] **STOP-04**: Stop hook scopes transcript search to current turn only (lines since last user message boundary) — survives context compaction
- [x] **STOP-05**: Stop hook reads transcript JSONL as the authoritative source of quorum evidence — no fast-path pre-check (design decision: last_assistant_message substring matching is not a reliable signal; JSONL parse is synchronous and correct for all transcript sizes)
- [x] **STOP-06**: Stop hook verifies quorum only when a configured planning command was issued in the current turn (scope filtering)
- [x] **STOP-07**: Stop hook blocks with `{"decision": "block", "reason": "..."}` when quorum is missing — reason includes exact tool names and instructions
- [x] **STOP-08**: Block reason message format: "QUORUM REQUIRED: Before completing this /gsd:[command] response, call [tool1], [tool2], [tool3] with your current plan. Present their responses, then deliver your final output."
- [x] **STOP-09**: Stop hook passes (exits 0, no decision field) when quorum evidence found or no planning command in scope

### UserPromptSubmit Hook — Proactive Injection

- [x] **UPS-01**: UserPromptSubmit hook detects GSD planning commands via explicit allowlist regex match against prompt field
- [x] **UPS-02**: Allowlist contains exactly 6 commands: new-project, plan-phase, new-milestone, discuss-phase, verify-work, research-phase
- [x] **UPS-03**: UserPromptSubmit hook injects quorum instructions via `hookSpecificOutput.additionalContext` (not systemMessage — goes into Claude's context window)
- [x] **UPS-04**: Injected context names the exact MCP tools to call and instructs Claude to present model responses before delivering final output
- [x] **UPS-05**: UserPromptSubmit hook never fires on execute-phase or other non-planning commands

### Config System

- [ ] **CONF-01**: Global config at `~/.claude/qgsd.json` — installed once, applies to all projects
- [ ] **CONF-02**: Per-project override at `.claude/qgsd.json` — merged with global, project values take precedence
- [ ] **CONF-03**: Config contains: `quorum_commands` (array of command names), `quorum_models` (array of MCP tool name patterns), `fail_mode` (open|closed, default: open)
- [ ] **CONF-04**: Fail-open behavior: when a quorum model is unavailable, Stop hook passes and logs reduced quorum notification
- [ ] **CONF-05**: Config validates on read — malformed config falls back to hardcoded defaults with warning

### MCP Server Detection

- [ ] **MCP-01**: Installer reads `~/.claude/settings.json` (or `~/.claude/claude_desktop_config.json`) to auto-detect MCP server names for Codex, Gemini, OpenCode
- [ ] **MCP-02**: Detection matches server names containing "codex", "gemini", "opencode" (case-insensitive keyword match)
- [ ] **MCP-03**: Detected names written to `~/.claude/qgsd.json` as `quorum_models` on install
- [ ] **MCP-04**: If detection finds no matching servers, installer falls back to hardcoded defaults: `mcp__codex-cli__`, `mcp__gemini-cli__`, `mcp__opencode__`
- [ ] **MCP-05**: User can manually edit `qgsd.json` to override detected names
- [ ] **MCP-06**: Stop hook matches tool_use names by prefix (e.g. `mcp__codex-cli__` matches both `mcp__codex-cli__codex` and `mcp__codex-cli__review`)

### Installer

- [ ] **INST-01**: QGSD is the unified installer — `npx qgsd@latest` installs GSD + quorum hooks in one command
- [ ] **INST-02**: QGSD's package.json pins GSD version — version lockstep ensures hook compatibility
- [ ] **INST-03**: Installer writes hooks to `~/.claude/settings.json` directly (not plugin.json hooks — stdout is silently discarded per GitHub #10225)
- [ ] **INST-04**: Installer adds UserPromptSubmit and Stop hook entries to `~/.claude/settings.json` hooks section
- [ ] **INST-05**: Installer performs validation before registering hooks: checks MCPs are configured in Claude Code settings, warns if Codex/Gemini/OpenCode not found
- [ ] **INST-06**: Installer is idempotent — running `npx qgsd@latest` again updates hooks and config without duplicating entries
- [ ] **INST-07**: Installer respects existing per-project `.claude/qgsd.json` overrides during updates

### GSD Sync Strategy

- [ ] **SYNC-01**: QGSD ships as separate npm package (`qgsd` or `get-shit-done-quorum`) that wraps GSD
- [ ] **SYNC-02**: When GSD releases a new planning command, QGSD releases a patch update adding the command to the default `quorum_commands` list
- [ ] **SYNC-03**: QGSD changelog explicitly tracks which GSD version it is compatible with
- [ ] **SYNC-04**: No QGSD code modifies any GSD source files — all additions are in separate files (`hooks/qgsd-stop.js`, `hooks/qgsd-prompt.js`, `bin/qgsd-install.js`)

### Quorum-First Behavior (Meta — how QGSD itself uses quorum during development)

- [x] **META-01**: GSD planning commands within this repo (new-project, plan-phase, etc.) auto-resolve questions via quorum before escalating to user
- [x] **META-02**: Only questions where quorum fails to reach consensus are presented to the user
- [x] **META-03**: Auto-resolved questions are presented as a list of assumptions before escalated questions

## v2 Requirements

### Reliability Enhancements

- **REL-01**: Session cache — track quorum state per-session to avoid re-verifying completed quorum on subsequent Stop hook calls
- **REL-02**: Dry-run mode — `--dry-run` flag for installer that shows what would be installed without writing files
- **REL-03**: Runtime warning when configured MCP server names are no longer present in Claude Code settings (drift detection)
- **REL-04**: Re-detect command: `npx qgsd@latest --redetect-mcps` to update MCP names in qgsd.json without full reinstall

### Multi-Runtime Support

- **MULTI-01**: OpenCode runtime support — install hooks in OpenCode's settings equivalent
- **MULTI-02**: Gemini CLI runtime support — install hooks in Gemini CLI config

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hook calling model CLIs directly | Fragile, auth complexity, external dependencies — quorum prompt injection + Stop gate is sufficient (quorum consensus decision) |
| Fail-closed mode in v1 | Creates deadlocks during quota issues; fail-open matches CLAUDE.md R6 — can be added in v2 |
| Modifying GSD source files | Zero-coupling is a hard constraint — QGSD is additive only |
| Per-turn quorum caching in v1 | Added complexity; verify correctness of core enforcement first |
| Browser/web UI for quorum config | Out of scope for CLI tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOP-01 | Phase 1 | Complete |
| STOP-02 | Phase 1 | Complete |
| STOP-03 | Phase 1 | Complete |
| STOP-04 | Phase 1 | Complete |
| STOP-05 | Phase 1 | Complete |
| STOP-06 | Phase 1 | Complete |
| STOP-07 | Phase 1 | Complete |
| STOP-08 | Phase 1 | Complete |
| STOP-09 | Phase 1 | Complete |
| UPS-01 | Phase 1 | Complete |
| UPS-02 | Phase 1 | Complete |
| UPS-03 | Phase 1 | Complete |
| UPS-04 | Phase 1 | Complete |
| UPS-05 | Phase 1 | Complete |
| META-01 | Phase 1 | Complete |
| META-02 | Phase 1 | Complete |
| META-03 | Phase 1 | Complete |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| CONF-04 | Phase 2 | Pending |
| CONF-05 | Phase 2 | Pending |
| MCP-01 | Phase 2 | Pending |
| MCP-02 | Phase 2 | Pending |
| MCP-03 | Phase 2 | Pending |
| MCP-04 | Phase 2 | Pending |
| MCP-05 | Phase 2 | Pending |
| MCP-06 | Phase 2 | Pending |
| INST-01 | Phase 3 | Pending |
| INST-02 | Phase 3 | Pending |
| INST-03 | Phase 3 | Pending |
| INST-04 | Phase 3 | Pending |
| INST-05 | Phase 3 | Pending |
| INST-06 | Phase 3 | Pending |
| INST-07 | Phase 3 | Pending |
| SYNC-01 | Phase 3 | Pending |
| SYNC-02 | Phase 3 | Pending |
| SYNC-03 | Phase 3 | Pending |
| SYNC-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 (corrected from initial count of 40 — actual count is 39)

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 — STOP-05 revised: fast-path omitted by design; JSONL-only verification is authoritative (gap closure Plan 01-06)*
