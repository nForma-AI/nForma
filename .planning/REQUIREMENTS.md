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

- [x] **CONF-01**: Global config at `~/.claude/qgsd.json` — installed once, applies to all projects
- [x] **CONF-02**: Per-project override at `.claude/qgsd.json` — merged with global, project values take precedence
- [x] **CONF-03**: Config contains: `quorum_commands` (array of command names), `required_models` (dict of MCP tool entries: { tool_prefix, required }), `fail_mode` (open|closed, default: open)
- [x] **CONF-04**: Fail-open behavior: when a quorum model is unavailable, Stop hook passes and logs reduced quorum notification
- [x] **CONF-05**: Config validates on read — malformed config falls back to hardcoded defaults with warning

### MCP Server Detection

- [x] **MCP-01**: Installer reads `~/.claude.json` to auto-detect MCP server names for Codex, Gemini, OpenCode
- [x] **MCP-02**: Detection matches server names containing "codex", "gemini", "opencode" (case-insensitive keyword match)
- [x] **MCP-03**: Detected names written to `~/.claude/qgsd.json` as `required_models` on install
- [x] **MCP-04**: If detection finds no matching servers, installer falls back to hardcoded defaults: `mcp__codex-cli__`, `mcp__gemini-cli__`, `mcp__opencode__`
- [x] **MCP-05**: User can manually edit `qgsd.json` to override detected names
- [x] **MCP-06**: Stop hook matches tool_use names by prefix (e.g. `mcp__codex-cli__` matches both `mcp__codex-cli__codex` and `mcp__codex-cli__review`)

### Installer

- [x] **INST-01**: QGSD is the unified installer — `npx qgsd@latest` installs GSD + quorum hooks in one command
- [x] **INST-02**: QGSD's package.json pins GSD version — version lockstep ensures hook compatibility
- [x] **INST-03**: Installer writes hooks to `~/.claude/settings.json` directly (not plugin.json hooks — stdout is silently discarded per GitHub #10225)
- [x] **INST-04**: Installer adds UserPromptSubmit and Stop hook entries to `~/.claude/settings.json` hooks section
- [x] **INST-05**: Installer performs validation before registering hooks: checks MCPs are configured in Claude Code settings, warns if Codex/Gemini/OpenCode not found
- [x] **INST-06**: Installer is idempotent — running `npx qgsd@latest` again updates hooks and config without duplicating entries
- [x] **INST-07**: Installer respects existing per-project `.claude/qgsd.json` overrides during updates

### GSD Sync Strategy

- [x] **SYNC-01**: QGSD ships as separate npm package (`qgsd` or `get-shit-done-quorum`) that wraps GSD
- [x] **SYNC-02**: When GSD releases a new planning command, QGSD releases a patch update adding the command to the default `quorum_commands` list
- [x] **SYNC-03**: QGSD changelog explicitly tracks which GSD version it is compatible with
- [x] **SYNC-04**: No QGSD code modifies any GSD source files — all additions are in separate files (`hooks/qgsd-stop.js`, `hooks/qgsd-prompt.js`, `bin/qgsd-install.js`)

### Quorum-First Behavior (Meta — how QGSD itself uses quorum during development)

- [x] **META-01**: GSD planning commands within this repo (new-project, plan-phase, etc.) auto-resolve questions via quorum before escalating to user
- [x] **META-02**: Only questions where quorum fails to reach consensus are presented to the user
- [x] **META-03**: Auto-resolved questions are presented as a list of assumptions before escalated questions

## v0.2 Requirements — Anti-Oscillation Pattern

**Goal:** Move R5 (Circuit Breaker) from CLAUDE.md behavioral policy into structural Claude Code hooks.

### Detection (DETECT)

- [ ] **DETECT-01**: PreToolUse hook intercepts Bash tool calls and checks whether the current context has an active circuit breaker before running detection
- [ ] **DETECT-02**: Hook retrieves last N commits' changed files via `git log --name-only` (N = commit_window config) when detection is needed
- [ ] **DETECT-03**: Hook identifies oscillation when the exact same file set (strict set equality, not intersection) appears in ≥ oscillation_depth of the last commit_window commits — strict equality prevents false positives during TDD cycles where different files are touched per commit
- [ ] **DETECT-04**: Read-only Bash commands (git log, git diff, grep, cat, ls, head, tail, find) pass through without detection or blocking
- [ ] **DETECT-05**: Detection is skipped (returns pass) when no git repository exists in the current working directory

### State Management (STATE)

- [ ] **STATE-01**: Circuit breaker state persisted in `.claude/circuit-breaker-state.json` (relative to project root) so block survives across tool calls
- [ ] **STATE-02**: State schema: `{ active, file_set[], activated_at, commit_window_snapshot[] }` — captures what triggered the breaker
- [ ] **STATE-03**: Hook reads existing state first — if active, applies enforcement immediately without re-running git log detection
- [ ] **STATE-04**: State file created silently if absent; failure to write logs to stderr but never blocks execution

### Enforcement (ENFC)

- [ ] **ENFC-01**: When circuit breaker is active, hook returns `{ "decision": "block", "reason": "..." }` blocking Bash execution
- [ ] **ENFC-02**: Block reason names the oscillating file set, confirms circuit breaker is active, and lists allowed operations (read-only Bash)
- [ ] **ENFC-03**: Block reason instructs Claude to perform root cause analysis and map dependencies before resuming; explicitly instructs the user to manually commit the fix (since Claude cannot run git commit while blocked)

### Recovery (RECV)

- [ ] **RECV-01**: `npx qgsd --reset-breaker` CLI flag clears `.claude/circuit-breaker-state.json` and logs confirmation — enables manual recovery when circuit breaker deadlocks due to blocked git commit

### Config Extensions (CONF)

- [ ] **CONF-06**: qgsd.json schema extended with `circuit_breaker.oscillation_depth` (integer, default: 3) — minimum commits touching same file set to trigger breaker
- [ ] **CONF-07**: qgsd.json schema extended with `circuit_breaker.commit_window` (integer, default: 6) — number of recent commits to analyze
- [ ] **CONF-08**: Circuit breaker config values validated on load; invalid values fall back to defaults with stderr warning
- [ ] **CONF-09**: Two-layer config merge (global + project) applies to `circuit_breaker` settings identically to existing merge behavior

### Installer Extensions (INST)

- [ ] **INST-08**: Installer registers PreToolUse circuit breaker hook in `~/.claude/settings.json` alongside existing hooks
- [ ] **INST-09**: Installer writes default `circuit_breaker` config block to qgsd.json on first install
- [ ] **INST-10**: Reinstall (idempotent) adds missing `circuit_breaker` config block without overwriting user-modified values

## Future Requirements (v0.3+)

### Circuit Breaker Recovery

- **RECV-02**: Auto-clear: circuit breaker resets when a commit on the oscillating file set does not match the oscillation pattern (non-oscillating forward progress)

### Reliability Enhancements (from v0.1 v2 backlog)

- **REL-01**: Session cache — track quorum state per-session to avoid re-verifying completed quorum on subsequent Stop hook calls
- **REL-02**: Dry-run mode — `--dry-run` flag for installer that shows what would be installed without writing files
- **REL-03**: Runtime warning when configured MCP server names are no longer present in Claude Code settings (drift detection)

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
| CONF-01 | Phase 2 | Complete |
| CONF-02 | Phase 2 | Complete |
| CONF-03 | Phase 2 | Complete |
| CONF-04 | Phase 2 | Complete |
| CONF-05 | Phase 2 | Complete |
| MCP-01 | Phase 2 | Complete |
| MCP-02 | Phase 2 | Complete |
| MCP-03 | Phase 2 | Complete |
| MCP-04 | Phase 2 | Complete |
| MCP-05 | Phase 2 | Complete |
| MCP-06 | Phase 2 | Complete |
| INST-01 | Phase 3 | Complete |
| INST-02 | Phase 3 | Complete |
| INST-03 | Phase 3 | Complete |
| INST-04 | Phase 3 | Complete |
| INST-05 | Phase 3 | Complete |
| INST-06 | Phase 3 | Complete |
| INST-07 | Phase 3 | Complete |
| SYNC-01 | Phase 3 | Complete |
| SYNC-02 | Phase 3 | Complete |
| SYNC-03 | Phase 3 | Complete |
| SYNC-04 | Phase 3 | Complete |
| DETECT-01 | Phase 6 | Pending |
| DETECT-02 | Phase 6 | Pending |
| DETECT-03 | Phase 6 | Pending |
| DETECT-04 | Phase 6 | Pending |
| DETECT-05 | Phase 6 | Pending |
| STATE-01 | Phase 6 | Pending |
| STATE-02 | Phase 6 | Pending |
| STATE-03 | Phase 6 | Pending |
| STATE-04 | Phase 6 | Pending |
| ENFC-01 | Phase 7 | Pending |
| ENFC-02 | Phase 7 | Pending |
| ENFC-03 | Phase 7 | Pending |
| CONF-06 | Phase 7 | Pending |
| CONF-07 | Phase 7 | Pending |
| CONF-08 | Phase 7 | Pending |
| CONF-09 | Phase 7 | Pending |
| INST-08 | Phase 8 | Pending |
| INST-09 | Phase 8 | Pending |
| INST-10 | Phase 8 | Pending |
| RECV-01 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 39 total — all complete (v0.1)
- v0.2 requirements: 20 total — 20/20 mapped (Phases 6–8)
- Unmapped v0.2: 0 ✓

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-21 — v0.2 Anti-Oscillation Pattern: 20 requirements mapped to Phases 6–8. Quorum Round 1 revision: RECV-01 moved from Future to Phase 8 (deadlock fix, consensus: Gemini+OpenCode+Copilot); DETECT-03 clarified to strict set equality; ENFC-03 updated with explicit user commit instruction.*
