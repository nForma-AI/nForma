# Roadmap: QGSD

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23–31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32–38 (shipped 2026-02-23)
- ✅ **v0.6 — Agent Slots & Quorum Composition** — Phase 39 (shipped 2026-02-23)
- ✅ **v0.7 — Composition Config & Multi-Slot** — Phases v0.7-01..v0.7-04 (shipped 2026-02-23)
- ✅ **v0.8 — fix-tests ddmin Pipeline** — Phase v0.8-01 (shipped 2026-02-23)
- 🚧 **v0.9 — GSD Sync** — Phases v0.9-01..v0.9-04 (in progress)

## Phases

<details>
<summary>✅ v0.2 — Gap Closure & Activity Resume Routing (Phases 1–17) — SHIPPED 2026-02-21</summary>

- [x] **Phase 1: Hook Enforcement** — Stop hook hard gate + UserPromptSubmit injection + meta quorum behavior (completed 2026-02-20)
- [x] **Phase 2: Config & MCP Detection** — User-editable config system with MCP auto-detection and fail-open behavior (completed 2026-02-20)
- [x] **Phase 3: Installer & Distribution** — npm installer that writes hooks to ~/.claude/settings.json and GSD version sync strategy (completed 2026-02-20)
- [x] **Phase 4: Narrow Quorum Scope** — Stop hook restricted to actual project decision turns via GUARD 5 (completed 2026-02-21)
- [x] **Phase 5: Fix GUARD 5 Delivery Gaps** — hooks/dist/ rebuilt + marker path propagated to installer users (completed 2026-02-21)
- [x] **Phase 6: Circuit Breaker Detection & State** — PreToolUse hook detects oscillation in git history and persists breaker state across invocations (completed 2026-02-21)
- [x] **Phase 7: Enforcement & Config Integration** — Bash execution blocked when breaker is active; circuit_breaker config block added to config-loader (completed 2026-02-21)
- [x] **Phase 8: Installer Integration** — Installer registers PreToolUse hook and writes default circuit_breaker config block idempotently (completed 2026-02-21)
- [x] **Phase 9: Verify Phases 5-6** — VERIFICATION.md for Phases 5 and 6; DETECT-01..05 and STATE-01..04 closed (completed 2026-02-21)
- [x] **Phase 10: Fix Bugs + Verify Phases 7-8** — Fix INST-08/RECV-01/INST-10 bugs + VERIFICATION.md for Phases 7 and 8 (completed 2026-02-21)
- [x] **Phase 11: Changelog & Build** — CHANGELOG [0.2.0] entry, hooks/dist/ rebuilt, npm test 141/141 (completed 2026-02-21)
- [x] **Phase 12: Version & Publish** — package.json 0.2.0, MILESTONES.md, git tag v0.2.0 pushed; npm publish deferred (completed 2026-02-21)
- [x] **Phase 13: Circuit Breaker Oscillation Resolution Mode** — Structured quorum resolution when breaker fires; unified solution approval gate (completed 2026-02-21)
- [x] **Phase 14: Activity Tracking** — current-activity.json sidecar + activity-set/clear/get CLI + resume-work 15-row routing table (completed 2026-02-21)
- [x] **Phase 15: v0.4 Gap Closure — Activity Resume Routing** — Fix ACT-02 schema violations + ACT-04 routing gaps (completed 2026-02-21)
- [x] **Phase 16: Verify Phase 15** — 15-VERIFICATION.md + ACT-02/ACT-04 traceability closed (completed 2026-02-21)
- [x] **Phase 17: Fix Agent Name Typos** — qqgsd-* → qgsd-* across 12 files (completed 2026-02-21)

**Archive:** `.planning/milestones/v0.2-ROADMAP.md`

</details>

<details>
<summary>✅ v0.3 — Test Suite Maintenance Tool (Phases 18–22) — SHIPPED 2026-02-22</summary>

- [x] **Phase 18: CLI Foundation** — gsd-tools.cjs maintain-tests sub-commands: discover, batch, run-batch + integration tests (completed 2026-02-22)
- [x] **Phase 19: State Schema & Activity Integration** — maintain-tests-state.json schema + resume-work routing rows (completed 2026-02-22)
- [x] **Phase 20: Workflow Orchestrator** — fix-tests.md command + orchestrator: batch loop, circuit breaker lifecycle, loop termination (completed 2026-02-22)
- [x] **Phase 21: Categorization Engine** — 5-category AI diagnosis, git pickaxe context, quick task dispatch grouping (completed 2026-02-22)
- [x] **Phase 22: Integration Test** — End-to-end validation of the full fix-tests loop (completed 2026-02-22)

**Archive:** `.planning/milestones/v0.3-ROADMAP.md`

</details>

<details>
<summary>✅ v0.4 — MCP Ecosystem (Phases 23–31) — SHIPPED 2026-02-22</summary>

- [x] **Phase 23: MCP Repo Surface Fixes** — openhands rename, dynamic versioning, MIT license, package.json metadata, Makefile, CHANGELOG/CLAUDE.md, npm scoping across all 6 repos (completed 2026-02-22)
- [x] **Phase 24: Gen1→Gen2 Architecture Port** — Per-tool *.tool.ts + registry.ts structure for claude/codex/copilot/openhands repos (completed 2026-02-22)
- [x] **Phase 25: Identity Tool & Shared Utilities** — identity tool + constants.ts + Logger utility in src/utils/logger.ts across all 6 repos (completed 2026-02-22)
- [x] **Phase 26: MCP Status Command** — /qgsd:mcp-status showing all agents, models, health state, and UNAVAIL counts (completed 2026-02-22)
- [x] **Phase 27: Model Switching** — /qgsd:mcp-set-model with qgsd.json persistence and quorum call injection (completed 2026-02-22)
- [x] **Phase 28: Update & Restart Commands** — /qgsd:mcp-update (all install methods) + /qgsd:mcp-restart (completed 2026-02-22)
- [x] **Phase 29: Restore mcp-status v2 + Requirements Checkbox Cleanup** — Restore v2 mcp-status.md (regression fix) + mark OBS-01–04 complete in REQUIREMENTS.md (completed 2026-02-22)
- [x] **Phase 30: Fix gemini-cli Package Reference** — Update ~/.claude.json gemini-cli args to unscoped package name; mark STD-10 complete (completed 2026-02-22)
- [x] **Phase 31: Merge Gen2 Branches + Phase 24 Verification** — Merge codex/copilot Gen2 branches to main + create Phase 24 VERIFICATION.md; close STD-02 (completed 2026-02-22)

**Archive:** `.planning/milestones/v0.4-ROADMAP.md`

</details>

<details>
<summary>✅ v0.5 — MCP Setup Wizard (Phases 32–38) — SHIPPED 2026-02-23</summary>

- [x] **Phase 32: Wizard Scaffold** — /qgsd:mcp-setup command: first-run vs re-run detection, main menu with live status, confirm+apply+restart flow (WIZ-01..05) (completed 2026-02-22)
- [x] **Phase 33: API Key Management** — Wizard flow for set/update API keys via keytar; writes to ~/.claude.json env block and restarts agent (KEY-01..04) (completed 2026-02-22)
- [x] **Phase 34: Provider Swap** — Wizard flow for changing agent base URL; curated provider list + custom entry; writes ANTHROPIC_BASE_URL and restarts (PROV-01..03) (completed 2026-02-22)
- [x] **Phase 35: Agent Roster** — Wizard flow for add/remove claude-mcp-server instances; identity ping after provisioning (AGENT-01..03) (completed 2026-02-22)
- [x] **Phase 36: Install Integration** — Installer detects no configured quorum agents and prompts user to run /qgsd:mcp-setup (INST-01) (completed 2026-02-22)
- [x] **Phase 37: Fix mcp-setup.md Distribution Issues** — Replace 9 hardcoded secrets.cjs absolute paths; add syncToClaudeJson to provider swap; add CLAUDE_MCP_PATH guard; add-agent keytar fallback bash snippet (INTEGRATION-01, INTEGRATION-02) (completed 2026-02-22)
- [x] **Phase 38: v0.5 Bookkeeping — Requirements & SUMMARY Updates** — Mark 16 v0.5 checkboxes [x]; correct traceability phase assignments; add requirements frontmatter to Phase 32/35/36 SUMMARY files (completed 2026-02-23)

**Archive:** `.planning/milestones/v0.5-ROADMAP.md`

</details>

<details>
<summary>✅ v0.6 — Agent Slots & Quorum Composition (Phase 39) — SHIPPED 2026-02-23</summary>

- [x] **Phase 39: Rename and Migration** — Rename all 10 agents to `<family>-<N>` slot names; non-destructive idempotent migration script for `~/.claude.json`; all QGSD hooks, commands, and agents updated (SLOT-01..04) (completed 2026-02-23)

**Note:** COMP-01..04, MULTI-01..03, WIZ-08..10, SCBD-01..03 deferred to v0.7.

**Archive:** `.planning/milestones/v0.6-ROADMAP.md`

</details>

<details>
<summary>✅ v0.7 — Composition Config & Multi-Slot (Phases v0.7-01..v0.7-04) — SHIPPED 2026-02-23</summary>

- [x] **Phase v0.7-01: Composition Architecture** — `quorum_active` config array; orchestrator reads it dynamically; scoreboard tracks by slot name with model as context (COMP-01..04, SCBD-01..03) (completed 2026-02-23)
- [x] **Phase v0.7-02: Multiple Slots** — Support N instances per family; `~/.claude.json` entries for copilot-1/2, opencode-1/2, etc.; add-slot supported by config and wizard (MULTI-01..03) (completed 2026-02-23)
- [x] **Phase v0.7-03: Wizard Composition Screen** — "Edit Quorum Composition" option in mcp-setup re-run menu; slot toggle on/off; add new slot from within wizard (WIZ-08..10) (completed 2026-02-23)
- [x] **Phase v0.7-04: Orchestrator Scoreboard Slot Wiring** — Propagate INT-04 fix to orchestrator Mode A; use --slot + --model-id for claude-mcp servers so SCBD-01..03 slot tracking works on all quorum paths (SCBD-01, SCBD-02, SCBD-03) (completed 2026-02-23)

**Archive:** `.planning/milestones/v0.7-ROADMAP.md`

</details>

<details>
<summary>✅ v0.8 — fix-tests ddmin Pipeline (Phase v0.8-01) — SHIPPED 2026-02-24</summary>

- [x] **Phase v0.8-01: fix-tests ddmin Pipeline** — Replace batch-based approach with 4-phase autonomous pipeline: ddmin isolation, AI quorum triage report, sequential fixing with quorum approval, final quorum-verified report (completed 2026-02-24)

**Archive:** `.planning/milestones/v0.8-ROADMAP.md`

</details>

### 🚧 v0.9 — GSD Sync (In Progress)

**Milestone Goal:** Port GSD 1.20.6 improvements into QGSD — context window self-monitoring hook, Nyquist validation layer, discuss-phase UX refinements, and Tier 3 fixes.

- [x] **Phase v0.9-01: Context Window Monitor** — New PostToolUse hook that injects WARNING/CRITICAL into `additionalContext` at configurable thresholds + install sync (completed 2026-02-24)
- [ ] **Phase v0.9-02: Nyquist Validation Layer** — VALIDATION.md template + plan-phase step 5.5 insertion + gsd-tools init field
- [ ] **Phase v0.9-03: Discuss-Phase UX** — Recommended option highlighting per choice + gray-area loop-back instead of hard stop
- [ ] **Phase v0.9-04: Tier 3 Fixes** — Skill tool spawn guards, Gemini TOML fix, decimal phase number parsing consistency

## Phase Details

### Phase v0.9-01: Context Window Monitor
**Goal**: Users have a context window monitor hook that automatically warns them during long quorum sessions before they hit limits
**Depends on**: Nothing (first v0.9 phase)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05
**Success Criteria** (what must be TRUE):
  1. `hooks/gsd-context-monitor.js` exists and is registered as PostToolUse in `bin/install.js`
  2. Running `node bin/install.js --claude --global` after the hook is added installs the context monitor hook to `~/.claude/settings.json`
  3. When context usage exceeds the warn threshold (default 70%), `additionalContext` in the next hook invocation contains a WARNING message
  4. When context usage exceeds the critical threshold (default 90%), `additionalContext` contains a CRITICAL message
  5. Both thresholds are overridable via `context_monitor.warn_pct` and `context_monitor.critical_pct` in `qgsd.json` with two-layer merge applied
**Plans**: TBD

Plans:
- [ ] v0.9-01-01: Create `hooks/gsd-context-monitor.js`, register in `bin/install.js`, copy to `hooks/dist/`, run install sync

### Phase v0.9-02: Nyquist Validation Layer
**Goal**: Plan-phase generates a VALIDATION.md test-map before producing plans, and gsd-tools reports whether Nyquist validation is enabled
**Depends on**: Phase v0.9-01
**Requirements**: NYQ-01, NYQ-02, NYQ-03, NYQ-04
**Success Criteria** (what must be TRUE):
  1. `get-shit-done/templates/VALIDATION.md` exists with per-task test-map structure, Wave 0 pre-execution requirements, and sampling rate spec
  2. `plan-phase.md` step 5.5 appears after the research step and before roadmap creation — it generates `VALIDATION.md` for the phase
  3. Running `gsd-tools.cjs init plan-phase` produces JSON that includes a `nyquist_validation_enabled` boolean field (defaults true)
  4. A plan-phase session with Nyquist enabled produces a VALIDATION.md covering all tasks identified in the plan
**Plans**: TBD

Plans:
- [ ] v0.9-02-01: Create `VALIDATION.md` template + insert step 5.5 into `plan-phase.md` + add `nyquist_validation_enabled` to `gsd-tools.cjs`

### Phase v0.9-03: Discuss-Phase UX
**Goal**: Discuss-phase presents clearer recommendations per option and allows users to keep exploring gray areas before finalizing
**Depends on**: Phase v0.9-02
**Requirements**: DSC-01, DSC-02, DSC-03
**Success Criteria** (what must be TRUE):
  1. Each option presented in `present_gray_areas` includes a recommended choice with brief reasoning explaining why it is preferred
  2. After all selected gray areas conclude, the user sees an "Explore more gray areas" option rather than being hard-stopped at "I'm ready for context"
  3. Choosing "Explore more gray areas" re-runs `present_gray_areas` with 2-4 newly identified areas that were not already explored — previously explored areas do not reappear
**Plans**: TBD

Plans:
- [ ] v0.9-03-01: Update `discuss-phase.md` — add recommended choice + rationale to each option in `present_gray_areas`; replace hard-stop with loop-back option; implement deduplication of already-explored areas on re-entry

### Phase v0.9-04: Tier 3 Fixes
**Goal**: Skill tool spawn guards, Gemini TOML correctness, and decimal phase parsing are all consistent and correct
**Depends on**: Phase v0.9-03
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. Every Task spawn point in `plan-phase.md` has an explicit guard note instructing Claude not to use the Skill tool
  2. Every Task spawn point in `discuss-phase.md` has an explicit guard note instructing Claude not to use the Skill tool
  3. All QGSD Gemini quorum templates are free of TOML conversion issues that would break quorum consistency
  4. `gsd-tools.cjs` parses decimal phase numbers (N.M format) consistently with integer phase numbers across all subcommands — no subcommand treats N.M as invalid or strips the decimal part
**Plans**: TBD

Plans:
- [ ] v0.9-04-01: Add Skill tool guards to `plan-phase.md` and `discuss-phase.md`; audit and fix Gemini TOML templates; fix decimal phase parsing in `gsd-tools.cjs`

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hook Enforcement | v0.2 | 6/6 | Complete | 2026-02-20 |
| 2. Config & MCP Detection | v0.2 | 4/4 | Complete | 2026-02-20 |
| 3. Installer & Distribution | v0.2 | 3/3 | Complete | 2026-02-20 |
| 4. Narrow Quorum Scope | v0.2 | 2/2 | Complete | 2026-02-21 |
| 5. Fix GUARD 5 Delivery Gaps | v0.2 | 1/1 | Complete | 2026-02-21 |
| 6. Circuit Breaker Detection & State | v0.2 | 1/1 | Complete | 2026-02-21 |
| 7. Enforcement & Config Integration | v0.2 | 2/2 | Complete | 2026-02-21 |
| 8. Installer Integration | v0.2 | 1/1 | Complete | 2026-02-21 |
| 9. Verify Phases 5-6 | v0.2 | 3/3 | Complete | 2026-02-21 |
| 10. Fix Bugs + Verify Phases 7-8 | v0.2 | 4/4 | Complete | 2026-02-21 |
| 11. Changelog & Build | v0.2 | 2/2 | Complete | 2026-02-21 |
| 12. Version & Publish | v0.2 | 2/2 | Complete (RLS-04 deferred) | 2026-02-21 |
| 13. Circuit Breaker Oscillation Resolution Mode | v0.2 | 2/2 | Complete | 2026-02-21 |
| 14. Activity Tracking | v0.2 | 4/4 | Complete | 2026-02-21 |
| 15. v0.4 Gap Closure — Activity Resume Routing | v0.2 | 1/1 | Complete | 2026-02-21 |
| 16. Verify Phase 15 | v0.2 | 1/1 | Complete | 2026-02-21 |
| 17. Fix Agent Name Typos | v0.2 | 1/1 | Complete | 2026-02-21 |
| 18. CLI Foundation | v0.3 | 4/4 | Complete | 2026-02-22 |
| 19. State Schema & Activity Integration | v0.3 | 2/2 | Complete | 2026-02-22 |
| 20. Workflow Orchestrator | v0.3 | 1/1 | Complete | 2026-02-22 |
| 21. Categorization Engine | v0.3 | 2/2 | Complete | 2026-02-22 |
| 22. Integration Test | v0.3 | 2/2 | Complete | 2026-02-22 |
| 23. MCP Repo Surface Fixes | v0.4 | 3/3 | Complete | 2026-02-22 |
| 24. Gen1 to Gen2 Architecture Port | v0.4 | 4/4 | Complete | 2026-02-22 |
| 25. Identity Tool and Shared Utilities | v0.4 | 3/3 | Complete | 2026-02-22 |
| 26. MCP Status Command | v0.4 | 1/1 | Complete | 2026-02-22 |
| 27. Model Switching | v0.4 | 2/2 | Complete | 2026-02-22 |
| 28. Update and Restart Commands | v0.4 | TBD | Complete | 2026-02-22 |
| 29. Restore mcp-status v2 + Checkbox Cleanup | v0.4 | 1/1 | Complete | 2026-02-22 |
| 30. Fix gemini-cli Package Reference | v0.4 | 1/1 | Complete | 2026-02-22 |
| 31. Merge Gen2 Branches + Phase 24 Verification | v0.4 | 2/2 | Complete | 2026-02-22 |
| 32. Wizard Scaffold | v0.5 | 1/1 | Complete | 2026-02-22 |
| 33. API Key Management | v0.5 | 1/1 | Complete | 2026-02-22 |
| 34. Provider Swap | v0.5 | 1/1 | Complete | 2026-02-22 |
| 35. Agent Roster | v0.5 | 1/1 | Complete | 2026-02-22 |
| 36. Install Integration | v0.5 | 1/1 | Complete | 2026-02-22 |
| 37. Fix mcp-setup.md Distribution Issues | v0.5 | 1/1 | Complete | 2026-02-22 |
| 38. v0.5 Bookkeeping — Requirements & SUMMARY | v0.5 | 1/1 | Complete | 2026-02-23 |
| 39. Rename and Migration | v0.6 | 3/3 | Complete | 2026-02-23 |
| v0.7-01. Composition Architecture | v0.7 | 4/4 | Complete | 2026-02-23 |
| v0.7-02. Multiple Slots | v0.7 | 2/2 | Complete | 2026-02-23 |
| v0.7-03. Wizard Composition Screen | v0.7 | 2/2 | Complete | 2026-02-23 |
| v0.7-04. Orchestrator Scoreboard Slot Wiring | v0.7 | 2/2 | Complete | 2026-02-23 |
| v0.8-01. fix-tests ddmin Pipeline | v0.8 | 2/2 | Complete | 2026-02-24 |
| v0.9-01. Context Window Monitor | 1/1 | Complete    | 2026-02-24 | - |
| v0.9-02. Nyquist Validation Layer | v0.9 | 0/1 | Not started | - |
| v0.9-03. Discuss-Phase UX | v0.9 | 0/1 | Not started | - |
| v0.9-04. Tier 3 Fixes | v0.9 | 0/1 | Not started | - |
