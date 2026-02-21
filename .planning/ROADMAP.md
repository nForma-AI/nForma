# Roadmap: QGSD

## Overview

QGSD enforces multi-model quorum for GSD planning commands through Claude Code hooks. Phase 1 builds the core enforcement layer — the Stop hook hard gate and UserPromptSubmit injection — plus the meta-behavior that governs how this repo itself uses quorum during development. Phase 2 adds the config system and MCP auto-detection that makes the enforcement configurable and resilient to renamed servers. Phase 3 packages everything into a distributable npm installer that writes directly to `~/.claude/settings.json` and establishes the GSD version sync strategy.

v0.2 (Phases 6–8) moves R5 (Circuit Breaker) from CLAUDE.md behavioral policy into structural Claude Code hooks. Phase 6 delivers the PreToolUse hook with oscillation detection and state persistence. Phase 7 wires in execution blocking and extends the config system. Phase 8 integrates everything into the installer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Hook Enforcement** - Stop hook hard gate + UserPromptSubmit injection + meta quorum behavior for this repo (completed 2026-02-20)
- [x] **Phase 2: Config & MCP Detection** - User-editable config system with MCP auto-detection and fail-open behavior (completed 2026-02-20)
- [x] **Phase 3: Installer & Distribution** - npm installer that writes hooks to ~/.claude/settings.json and GSD version sync strategy (completed 2026-02-20)
- [x] **Phase 4: Narrow Quorum Scope** - Stop hook restricted to actual project decision turns via GUARD 5 (completed 2026-02-21)
- [x] **Phase 5: Fix GUARD 5 Delivery Gaps** - hooks/dist/ rebuilt + marker path propagated to installer users
- [x] **Phase 6: Circuit Breaker Detection & State** - PreToolUse hook detects oscillation in git history and persists breaker state across invocations
- [ ] **Phase 7: Enforcement & Config Integration** - Bash execution blocked when breaker is active; circuit_breaker config block added to config-loader
- [ ] **Phase 8: Installer Integration** - Installer registers PreToolUse hook and writes default circuit_breaker config block idempotently

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
- [x] 03-01-PLAN.md — Package identity: update package.json (name=qgsd, bin, peerDeps) + CHANGELOG.md v0.1.0 entry
- [x] 03-02-PLAN.md — Installer enhancements: INST-05 MCP validation warning + INST-06 reinstall summary + --redetect-mcps flag
- [x] 03-03-PLAN.md — Build dist + human verify checkpoint + mark Phase 3 complete

### Phase 4: Narrow Quorum Scope
**Goal:** Stop hook only fires quorum on turns where Claude delivers a project decision (plan, roadmap, research, verification report) — not on intermediate GSD-internal operations (agent spawning, routing, questioning, status messages)
**Depends on:** Phase 3
**Requirements**: SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-04, SCOPE-05, SCOPE-06, SCOPE-07
**Plans:** 2/2 plans complete

Plans:
- [x] 04-01-PLAN.md — Stop hook GUARD 5: decision turn detection (hasArtifactCommit + hasDecisionMarker) — TDD with TC14-TC19
- [x] 04-02-PLAN.md — UserPromptSubmit hook: inject decision marker instruction into quorum context

### Phase 5: Fix GUARD 5 Delivery Gaps
**Goal:** Phase 4 features reach installed users — buildQuorumInstructions() includes step 5 so hasDecisionMarker() fires for installer users, and hooks/dist/ is current so source installs get GUARD 5
**Depends on:** Phase 4
**Gap Closure:** Closes GAP-01 (hooks/dist/ stale for source installs) and GAP-02 (marker path disabled for all installer users) from v0.1 milestone audit
**Plans:** 1 plan

Plans:
- [ ] 05-01-PLAN.md — Three-surface quorum_instructions sync (bin/install.js + templates/qgsd.json) + hooks/dist/ rebuild (GAP-01 + GAP-02) + CHANGELOG [Unreleased] entry

### Phase 6: Circuit Breaker Detection & State
**Goal**: Claude cannot execute write Bash commands when oscillation has been detected — a PreToolUse hook reads git history and persists breaker state so the block survives across tool calls
**Depends on**: Phase 5
**Requirements**: DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05, STATE-01, STATE-02, STATE-03, STATE-04
**Success Criteria** (what must be TRUE):
  1. When a Bash command arrives and no state file exists (or state is inactive), the hook runs git log and correctly identifies whether the exact same file set (strict set equality, not intersection) has appeared in the configured number of commits in the window — a TDD cycle where different files are touched per commit does not trigger a false positive
  2. When a Bash command is a read-only operation (git log, git diff, grep, cat, ls, head, tail, find), the hook passes through without running oscillation detection or triggering a block
  3. When oscillation is detected, the hook writes `.claude/circuit-breaker-state.json` with the active flag, the oscillating file set, activation timestamp, and the commit window snapshot — and that state survives to the next tool call invocation
  4. When the hook reads an existing state file with `active: true`, it applies enforcement immediately without re-running git log — confirming that a persistent block requires no repeat detection
  5. When no git repository exists in the working directory, the hook passes without error
**Plans**: 1 plan

Plans:
- [ ] 06-01-PLAN.md -- Circuit breaker hook (TDD): oscillation detection, state persistence, 14 test cases

### Phase 7: Enforcement & Config Integration
**Goal**: An active circuit breaker makes further Bash execution impossible until Claude performs root cause analysis — and all circuit breaker thresholds are user-configurable through the existing config system
**Depends on**: Phase 6
**Requirements**: ENFC-01, ENFC-02, ENFC-03, CONF-06, CONF-07, CONF-08, CONF-09
**Success Criteria** (what must be TRUE):
  1. When the circuit breaker is active, any non-read-only Bash command returns `{"decision": "block", ...}` — Claude cannot execute it
  2. The block reason message names the oscillating file set, confirms the breaker is active, lists the operations Claude is allowed to perform (read-only Bash), instructs Claude to perform root cause analysis and dependency mapping before resuming, and explicitly tells the user to manually commit the fix (since Claude cannot run git commit while blocked)
  3. A user can set `circuit_breaker.oscillation_depth` and `circuit_breaker.commit_window` in qgsd.json and the hook uses those values; invalid values fall back to defaults (3 and 6 respectively) with a stderr warning
  4. A per-project `.claude/qgsd.json` `circuit_breaker` block overrides the global config using the same two-layer merge already in place for existing config keys
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — config-loader TDD: circuit_breaker sub-object in DEFAULT_CONFIG + validateConfig() with TC-CB1 through TC-CB7
- [ ] 07-02-PLAN.md — Hook enforcement TDD: blocking output (hookSpecificOutput.permissionDecision:deny) + config-driven thresholds, CB-TC7 update + CB-TC16 through CB-TC19

### Phase 8: Installer Integration
**Goal**: Running `npx qgsd@latest` registers the circuit breaker PreToolUse hook and writes a default circuit_breaker config block — idempotently, without overwriting user-modified values
**Depends on**: Phase 7
**Requirements**: INST-08, INST-09, INST-10, RECV-01
**Success Criteria** (what must be TRUE):
  1. After running `npx qgsd@latest` on a fresh install, `~/.claude/settings.json` contains a PreToolUse hook entry for the circuit breaker hook alongside the existing Stop and UserPromptSubmit entries
  2. After running `npx qgsd@latest` on a fresh install, `~/.claude/qgsd.json` contains a `circuit_breaker` block with `oscillation_depth: 3` and `commit_window: 6`
  3. Running `npx qgsd@latest` a second time when a `circuit_breaker` block already exists (with or without user modifications) does not overwrite it — a missing block is added, an existing block is left intact
  4. Running `npx qgsd --reset-breaker` deletes `.claude/circuit-breaker-state.json` and logs a confirmation message — the circuit breaker is cleared and Claude can resume Bash execution
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

**v0.2 Coverage:** 20 requirements across Phases 6–8 (DETECT: 5, STATE: 4, ENFC: 3, CONF: 4, INST: 3, RECV: 1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hook Enforcement | 5/5 | Complete   | 2026-02-20 |
| 2. Config & MCP Detection | 4/4 | Complete | 2026-02-20 |
| 3. Installer & Distribution | 3/3 | Complete   | 2026-02-20 |
| 4. Narrow Quorum Scope | 2/2 | Complete | 2026-02-21 |
| 5. Fix GUARD 5 Delivery Gaps | 0/1 | Not started | - |
| 6. Circuit Breaker Detection & State | 0/1 | Not started | - |
| 7. Enforcement & Config Integration | 0/2 | Not started | - |
| 8. Installer Integration | 0/TBD | Not started | - |
