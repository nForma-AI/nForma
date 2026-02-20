# Roadmap: QGSD

## Overview

QGSD enforces multi-model quorum for GSD planning commands through Claude Code hooks. Phase 1 builds the core enforcement layer — the Stop hook hard gate and UserPromptSubmit injection — plus the meta-behavior that governs how this repo itself uses quorum during development. Phase 2 adds the config system and MCP auto-detection that makes the enforcement configurable and resilient to renamed servers. Phase 3 packages everything into a distributable npm installer that writes directly to `~/.claude/settings.json` and establishes the GSD version sync strategy.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Hook Enforcement** - Stop hook hard gate + UserPromptSubmit injection + meta quorum behavior for this repo (completed 2026-02-20)
- [x] **Phase 2: Config & MCP Detection** - User-editable config system with MCP auto-detection and fail-open behavior (completed 2026-02-20)
- [ ] **Phase 3: Installer & Distribution** - npm installer that writes hooks to ~/.claude/settings.json and GSD version sync strategy

## Phase Details

### Phase 1: Hook Enforcement
**Goal**: Claude cannot deliver a GSD planning response without evidence of quorum in the transcript — enforced structurally, not behaviorally
**Depends on**: Nothing (first phase)
**Requirements**: STOP-01, STOP-02, STOP-03, STOP-04, STOP-05, STOP-06, STOP-07, STOP-08, STOP-09, UPS-01, UPS-02, UPS-03, UPS-04, UPS-05, META-01, META-02, META-03
**Success Criteria** (what must be TRUE):
  1. When a GSD planning command is invoked, Claude receives quorum instructions naming the exact MCP tools to call before it produces output
  2. When Claude attempts to deliver a planning response without tool_use evidence of Codex, Gemini, and OpenCode calls in the current turn, the Stop hook blocks with a message naming the missing models and the exact tool calls required
  3. When a planning response contains quorum evidence (or no planning command was issued), the Stop hook passes without interference
  4. The Stop hook never triggers an infinite loop — re-invocations when `stop_hook_active` is true exit immediately with no block
  5. GSD subagent Stop events (SubagentStop) are excluded — only the main session Stop is gated
  6. Stop hook correctly identifies planning commands with and without leading whitespace, aliased invocations, and mixed casing — no false positives from non-quorum commands
  7. Stop hook scans only the current turn (since last user message boundary) — correctly passes after context compaction even when prior quorum evidence no longer appears in transcript
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md — Stop hook (qgsd-stop.js) + config template — TDD with all 8 guard/logic test cases
- [x] 01-02-PLAN.md — UserPromptSubmit hook (qgsd-prompt.js) — allowlist injection
- [x] 01-03-PLAN.md — META behavior: CLAUDE.md R4 structural note + STATE.md decision entry
- [ ] 01-04-PLAN.md — Build script extension + installer integration (hook registration + config write)
- [ ] 01-05-PLAN.md — Install + live integration checkpoint (human verify)
- [ ] 01-06-PLAN.md — Gap closure: STOP-05 requirement revised to match JSONL-only implementation

### Phase 2: Config & MCP Detection
**Goal**: Quorum enforcement is configurable by the user and resilient to renamed or absent MCP servers — no silent failures
**Depends on**: Phase 1
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):
  1. A user can edit `~/.claude/qgsd.json` to change which commands require quorum and which MCP tool prefixes count as evidence, and the hooks respect those values without code changes
  2. A per-project `.claude/qgsd.json` overrides the global config for that project, with project values taking precedence on all overlapping keys
  3. When one or more quorum models are unavailable (no matching tool_use found), the Stop hook passes (fail-open) and the block message notes which models were absent
  4. When `qgsd.json` is malformed or missing, the hooks fall back to hardcoded defaults and surface a warning — no crash, no silent pass without reason
  5. Stop hook matches MCP tool names by prefix so that both `mcp__codex-cli__codex` and `mcp__codex-cli__review` satisfy the Codex quorum requirement
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Shared config-loader.js (TDD): two-layer merge, validation, stderr warnings + qgsd-prompt.js migration
- [x] 02-02-PLAN.md — Stop hook fail-open enhancement (TDD): unavailability detection, config-loader migration
- [x] 02-03-PLAN.md — MCP auto-detection in installer: read ~/.claude.json, write detected required_models to qgsd.json
- [x] 02-04-PLAN.md — Template documentation + human-verify checkpoint

### Phase 3: Installer & Distribution
**Goal**: A single `npx qgsd@latest` command installs GSD and quorum hooks globally, writes to `~/.claude/settings.json`, and establishes a versioned sync strategy with GSD
**Depends on**: Phase 2
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. Running `npx qgsd@latest` on a machine with Claude Code and GSD installs quorum hooks into `~/.claude/settings.json` — hooks are active in the next Claude Code session without manual configuration
  2. Running `npx qgsd@latest` a second time updates hooks and config without duplicating entries in `~/.claude/settings.json`
  3. The installer warns if Codex, Gemini, or OpenCode MCPs are not found in Claude Code settings — the user knows before hooks are active that quorum models are missing
  4. The installed package declares a pinned GSD version dependency and its changelog records which GSD version it is compatible with
  5. No QGSD file modifies any GSD source file — all additions are in separate files (`hooks/qgsd-stop.js`, `hooks/qgsd-prompt.js`, `bin/qgsd-install.js`)
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Package identity: update package.json (name=qgsd, bin, peerDeps) + CHANGELOG.md v0.1.0 entry
- [ ] 03-02-PLAN.md — Installer enhancements: INST-05 MCP validation warning + INST-06 reinstall summary + --redetect-mcps flag
- [ ] 03-03-PLAN.md — Build dist + human verify checkpoint + mark Phase 3 complete

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hook Enforcement | 5/5 | Complete   | 2026-02-20 |
| 2. Config & MCP Detection | 4/4 | Complete | 2026-02-20 |
| 3. Installer & Distribution | 0/3 | Planned | - |

### Phase 4: Narrow quorum scope to project decisions only

**Goal:** Stop hook only fires quorum on turns where Claude delivers a project decision (plan, roadmap, research, verification report) — not on intermediate GSD-internal operations (agent spawning, routing, questioning, status messages)
**Depends on:** Phase 3
**Requirements**: SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-04, SCOPE-05, SCOPE-06, SCOPE-07
**Plans:** 2 plans

Plans:
- [ ] 04-01-PLAN.md — Stop hook GUARD 5: decision turn detection (hasArtifactCommit + hasDecisionMarker) — TDD with TC14-TC19
- [ ] 04-02-PLAN.md — UserPromptSubmit hook: inject decision marker instruction into quorum context
