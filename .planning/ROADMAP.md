# Roadmap: QGSD

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23–31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32–38 (shipped 2026-02-23)
- ✅ **v0.6 — Agent Slots & Quorum Composition** — Phase 39 (shipped 2026-02-23)
- ✅ **v0.7 — Composition Config & Multi-Slot** — Phases v0.7-01..v0.7-04 (shipped 2026-02-23)
- ✅ **v0.8 — fix-tests ddmin Pipeline** — Phase v0.8-01 (shipped 2026-02-23)
- ✅ **v0.9 — GSD Sync** — Phases v0.9-01..v0.9-09 (shipped 2026-02-27)
- ✅ **v0.10 — Roster Toolkit** — Phases v0.10-01..v0.10-08 (shipped 2026-02-25)
- ✅ **v0.11 — Parallel Quorum** — Phase v0.11-01 (shipped 2026-02-24)
- 🚧 **v0.12 — Formal Verification** — Phases v0.12-01..v0.12-08 (in progress)
- ✅ **v0.13 — Autonomous Milestone Execution** — Phases v0.13-01..v0.13-06 (shipped 2026-02-25)
- ✅ **v0.14 — FV Pipeline Integration** — Phases v0.14-01..v0.14-05 (shipped 2026-02-26)
- 🚧 **v0.15 — Health & Tooling Modernization** — Phases v0.15-01..v0.15-04 (in progress)
- 🚧 **v0.18 — Token Efficiency** — Phases v0.18-01..v0.18-04 (in progress)

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

<details>
<summary>✅ v0.9 — GSD Sync (Phases v0.9-01..v0.9-09) — SHIPPED 2026-02-27</summary>

- [x] **Phase v0.9-01: Context Window Monitor** — New PostToolUse hook that injects WARNING/CRITICAL into `additionalContext` at configurable thresholds + install sync (completed 2026-02-24)
- [x] **Phase v0.9-02: Nyquist Validation Layer** — VALIDATION.md template + plan-phase step 5.5 insertion + gsd-tools init field (2 plans) (completed 2026-02-24)
- [x] **Phase v0.9-03: Discuss-Phase UX** — Recommended option highlighting per choice + gray-area loop-back instead of hard stop (completed 2026-02-24)
- [x] **Phase v0.9-04: Tier 3 Fixes** — Skill tool spawn guards, Gemini TOML fix, decimal phase number parsing consistency (completed 2026-02-26)
- [x] **Phase v0.9-05: Rename get-shit-done/ → qgsd-core/** — Rename the source directory to match QGSD identity; update all path references in installer, gsd-tools, and workflows; re-sync installed runtime (completed 2026-02-25)
- [x] **Phase v0.9-06: v0.9-03 Retroactive Verification** — Create formal VERIFICATION.md for v0.9-03 from SUMMARY.md inline evidence; closes DSC-01, DSC-02, DSC-03 requirement gaps (Gap Closure) (completed 2026-02-26)
- [x] **Phase v0.9-07: Nyquist Parse-List Correction + Path Portability** — Add `nyquist_validation_enabled` to plan-phase.md Step 1 parse list; replace hardcoded absolute paths in step 5.5 with portable `~`-relative reference; closes NYQ-04 integration gap (Gap Closure) (completed 2026-02-26)
- [x] **Phase v0.9-08: Post-v0.9 Install Sync** — Run install sync for model=haiku quorum dispatch flag added in quick-110; verify installed runtime matches source; closes post-v0.9 drift tech debt (Gap Closure) (completed 2026-02-27)
- [x] **Phase v0.9-09: SC-4 End-to-End Nyquist Demo** — Run a live plan-phase session with Nyquist enabled; capture VALIDATION.md output; document in a demo artifact; closes SC-4 undemonstrated tech debt (Gap Closure) (completed 2026-02-27)

**Archive:** `.planning/milestones/v0.9-ROADMAP.md`

</details>

### ✅ v0.10 — Roster Toolkit (SHIPPED 2026-02-25)

**Milestone Goal:** Extend `bin/manage-agents.cjs` into a full-featured agent roster management UI — provider presets, slot cloning, live health dashboard, key lifecycle management, scoreboard visibility, CCR routing, per-agent tuning, import/export, and auto-update policy.

- [x] **Phase v0.10-01: Foundation** — Read-only display columns (quorum W/L, CCR routing, key-invalid badge) + readQgsdJson/writeQgsdJson helper pair infrastructure (completed 2026-02-24)
- [x] **Phase v0.10-02: Presets and Cloning** — Provider preset library wired into addAgent/editAgent + slot cloning flow (completed 2026-02-24)
- [x] **Phase v0.10-03: Credential Management** — Key expiry detection with classifyProbeResult() + batch key rotation with sequential-only write loop (completed 2026-02-24)
- [x] **Phase v0.10-04: Live Health Dashboard** — Full-screen auto-refreshing status view with readline mode-switch architecture and keypress exit (completed 2026-02-24)
- [x] **Phase v0.10-05: Policy UIs** — Per-slot quorum timeout tuning + auto-update policy configuration + startup auto-update check (completed 2026-02-24)
- [x] **Phase v0.10-06: Import/Export** — Portable roster export with unconditional API key redaction + schema-validated import with pre-import backup (completed 2026-02-25)
- [x] **Phase v0.10-07: Retroactive Verification Closure** — VERIFICATION.md for v0.10-02/03/04 + _pure exports for probeAllSlots/liveDashboard + integration smoke test + menu numbering fix (Gap Closure) (completed 2026-02-25)
- [x] **Phase v0.10-08: PLCY-03 Auto-Update Bug Fix** — Fix Map bracket notation bug in runAutoUpdateCheck() + regression test + clear critical bug flag (Gap Closure) (completed 2026-02-25)

<details>
<summary>✅ v0.11 — Parallel Quorum (Phase v0.11-01) — SHIPPED 2026-02-24</summary>

- [x] **Phase v0.11-01: Parallel Quorum Wave-Barrier** — `qgsd-quorum-worker.md` + `qgsd-quorum-synthesizer.md` agents; atomic rename at all scoreboard write sites; `merge-wave` subcommand; orchestrator rewritten with wave-barrier pattern (PAR-01..PAR-05) (completed 2026-02-24)

**Archive:** `.planning/milestones/v0.11-ROADMAP.md`
</details>

### 🚧 v0.12 — Formal Verification (In Progress)

**Milestone Goal:** Implement formal verification tooling for QGSD's agent state machine — conformance event logger shipped as a bin/ script, TLA+ specification with TLC model checking, XState executable TypeScript machine, and Alloy/PRISM/Petri models for vote-counting and probabilistic analysis.

- [x] **Phase v0.12-01: Conformance Event Infrastructure** — Shared schema module, appendConformanceEvent() helper in hooks, hook instrumentation across all three hooks, XState machine compiled to CJS, and validate-traces.cjs user CLI (LOG-01..03, XST-01..03, VAL-01..03)
- [x] **Phase v0.12-02: TLA+ Formal Spec** — QGSDQuorum.tla spec with named invariants, safety and liveness TLC configs, and bin/run-tlc.cjs runner (TLA-01..04)
- [x] **Phase v0.12-03: Static Analysis Suite** — Alloy vote-counting model + runner, PRISM probabilistic DTMC + scoreboard rate exporter, Petri Net generator with WASM SVG rendering and structural deadlock detection (ALY-01..02, PRM-01..03, PET-01..03)
- [x] **Phase v0.12-04: Circuit Breaker Algorithm Verification** — TLA+ models for run-collapse oscillation detection algorithm and circuit breaker state persistence + Haiku convergence (GAP-1, GAP-5) (completed 2026-02-25)
- [x] **Phase v0.12-05: Protocol Termination Proofs** — TLA+ bounded termination specs for R3 deliberation loop (max 10 rounds + 10 improvement iterations) and R4 pre-filter protocol (max 3 rounds) (GAP-2, GAP-6) (completed 2026-02-25)
- [x] **Phase v0.12-06: Audit Trail Invariants** — Alloy models for scoreboard recomputation idempotency/no-vote-loss/no-double-counting and availability hint date arithmetic (GAP-3, GAP-9) (completed 2026-02-25)
- [x] **Phase v0.12-07: Hook Transcript Verification** — Alloy model for qgsd-stop.js transcript scanning: boundary detection, tool_use/tool_result pairing uniqueness, ceiling enforcement (GAP-4) (completed 2026-02-25)
- [x] **Phase v0.12-08: Installer and Taxonomy Extensions** — Alloy extension to install-scope.als (rollback soundness, config sync completeness) and new taxonomy-safety.als (injection prevention, closed/open taxonomy consistency) (GAP-7, GAP-8) (completed 2026-02-25)
- [x] **Phase v0.12-09: Verification Infrastructure Quick Fixes** — workers bug fix in run-oscillation-tlc.cjs, conditional-skip guards for JAR-not-found tests, stale assertion name in run-alloy.cjs, rates.const/quorum.pm variable alignment, deadlock condition fix (GAP-5, TLA-04, ALY-02, PRM-02, PET-03) (completed 2026-02-25)
- [ ] **Phase v0.12-10: Conformance Score Redesign** — Add DECIDING to VALID_PHASES in conformance-schema.cjs, refactor validate-traces.cjs to multi-step session replay so conformance score reflects real violations not structural artifacts (LOG-03, VAL-01, VAL-02)

<details>
<summary>✅ v0.13 — Autonomous Milestone Execution (Phases v0.13-01..v0.13-06) — SHIPPED 2026-02-25</summary>

- [x] **Phase v0.13-01: Loop Wiring** — Wire audit-milestone into the last-phase transition chain; detect gap-closure re-audit vs. primary completion path; audit-milestone auto-spawns plan-milestone-gaps on gaps_found; STATE.md updated with audit result (LOOP-01, LOOP-02, LOOP-03, STATE-01) (completed 2026-02-25)
- [x] **Phase v0.13-02: Quorum Gates** — Replace every AskUserQuestion in the autonomous loop with R3 quorum: plan-milestone-gaps confirmation gate, execute-phase gap resolution, discuss-phase gray-area routing in auto mode (QUORUM-01, LOOP-04, QUORUM-02, QUORUM-03) (completed 2026-02-25)
- [x] **Phase v0.13-03: Write VERIFICATION.md + Bookkeeping** — Write formal VERIFICATION.md artifacts for v0.13-01 and v0.13-02; update REQUIREMENTS.md traceability (all 8 → Complete) (Gap Closure) (completed 2026-02-25)
- [x] **Phase v0.13-04: Fix Integration Issues** — Align update-scoreboard.cjs binary path; add --auto bypass guards to plan-milestone-gaps.md (INT-01/INT-02) (Gap Closure) (completed 2026-02-25)
- [x] **Phase v0.13-05: Fix IS_GAP_CLOSURE Pattern** — Anchor IS_GAP_CLOSURE grep from `-A 15` to `-A 4` with `^### Phase` anchor (TECH-01) (Gap Closure) (completed 2026-02-25)
- [x] **Phase v0.13-06: Deploy IS_GAP_CLOSURE Fix to Installed Copy** — Sync corrected transition.md to ~/.claude/qgsd/; LOOP-02 closed at runtime (Gap Closure) (completed 2026-02-25)

**Archive:** `.planning/milestones/v0.13-ROADMAP.md`

</details>

<details>
<summary>✅ v0.14 — FV Pipeline Integration (Phases v0.14-01..v0.14-05) — SHIPPED 2026-02-26 (5/5 complete)</summary>

- [x] **Phase v0.14-01: FV Tool Integration** — Commit and wire xstate-to-tla.cjs and run-formal-verify.cjs into source tree with test coverage; CI formal-verify.yml committed and end-to-end pipeline wired (INTG-01, INTG-02, INTG-03, INTG-04) (completed 2026-02-26)
- [x] **Phase v0.14-02: Drift Detection + TLA+ Canonicalization** — Resolve BROKEN-01 (xstate-to-tla.cjs writes QGSDQuorum_xstate.tla not QGSDQuorum.tla, Option A); wire check-spec-sync.cjs into npm test; upgrade XState parsing from regex to AST; detect orphaned handwritten specs; remove CI continue-on-error masking; add missing CI path triggers (DRFT-01, DRFT-02, DRFT-03 + BROKEN-01 + MISSING-02) (completed 2026-02-26)
- [x] **Phase v0.14-03: Parallelization** — Replace sequential for..of loop with two-phase parallel execution: generate group sequential first, then tla/alloy/prism/petri groups concurrent via Promise.all; add wall-clock timing in summary; 333 tests passing (PERF-01, PERF-02) (completed 2026-02-26)
- [x] **Phase v0.14-04: PRISM Config Injection** — Scoreboard TP/TN rates auto-fed to PRISM model parameters at runtime; no manual .pm file editing required (PRISM-01, PRISM-02) (completed 2026-02-26)
- [x] **Phase v0.14-05: Watch Mode** — --watch flag re-runs formal verification automatically on XState machine file changes (DX-01) (completed 2026-02-26)

</details>

### 🚧 v0.15 — Health & Tooling Modernization (In Progress)

**Milestone Goal:** Fix the GSD health checker to recognize QGSD's versioned phase naming convention, guard `--repair` against rich STATE.md data loss, archive legacy pre-versioning phase dirs, and surface quorum failure patterns in the health report.

- [x] **Phase v0.15-01: Health Checker Regex Fix** — Fix gsd-tools.cjs W005/W007/W002 regex patterns to recognize QGSD versioned phase naming `v0.X-YY-name` — eliminates 33 W005 + 22 W007 false positives (HLTH-01, HLTH-02, HLTH-03) (completed 2026-02-27)
- [x] **Phase v0.15-02: Repair Safety Guard** — Guard `--repair` regenerateState action against overwriting rich STATE.md without explicit --force flag (SAFE-01) (completed 2026-02-27)
- [ ] **Phase v0.15-03: Legacy Dir Archive** — Archive pre-versioning legacy phase dirs 18-39 to `.planning/archive/legacy/` — eliminates W007 orphan noise (SAFE-02)
- [ ] **Phase v0.15-04: Health Quorum Failure Visibility** — Integrate quorum-failures.json data into `/qgsd:health` output as health warnings when recurring patterns detected (VIS-01)

### 🚧 v0.18 — Token Efficiency (In Progress)

**Milestone Goal:** Reduce QGSD's per-run token consumption (currently 380k+ tokens per Nyquist-class run) by establishing per-slot token observability, enforcing tiered model sizing, introducing a structured task envelope context handoff, and making quorum fan-out risk-adaptive.

- [ ] **Phase v0.18-01: Token Observability Foundation** — New SubagentStop hook reads agent_transcript_path to sum token usage per slot; appends structured records to .planning/token-usage.jsonl; /qgsd:health displays ranked token consumption (OBSV-01, OBSV-02, OBSV-03, OBSV-04)
- [x] **Phase v0.18-02: Tiered Model Sizing** — Researcher and plan-checker sub-agents in plan-phase.md use model=haiku; user-configurable tier keys model_tier_planner/model_tier_worker in qgsd.json; config-loader.js updated with flat keys (TIER-01, TIER-02, TIER-03) (completed 2026-02-27)
- [ ] **Phase v0.18-03: Task Envelope** — bin/task-envelope.cjs writes task-envelope.json sidecar after research and planning with objective/constraints/risk_level/target_files/plan_path/key_decisions; quorum.md reads risk_level with fail-open (ENV-01, ENV-02, ENV-03, ENV-04)
- [ ] **Phase v0.18-04: Adaptive Fan-Out** — qgsd-prompt.js readEnvelopeWorkerCount() helper; priority chain --n N > envelope > maxSize > pool; 2/3/max workers for routine/medium/high risk; --n N emitted for Stop hook R3.5 compliance; R6.4 reduced-quorum note (FAN-01, FAN-02, FAN-03, FAN-04, FAN-05, FAN-06)


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
**Plans**: 3 plans

Plans:
- [ ] v0.9-01-01: Create `hooks/gsd-context-monitor.js`, register in `bin/install.js`, copy to `hooks/dist/`, run install sync

### Phase v0.9-02: Nyquist Validation Layer
**Goal**: Plan-phase generates a VALIDATION.md test-map before producing plans, and gsd-tools reports whether Nyquist validation is enabled
**Depends on**: Phase v0.9-01
**Requirements**: NYQ-01, NYQ-02, NYQ-03, NYQ-04, NYQ-05
**Success Criteria** (what must be TRUE):
  1. `get-shit-done/templates/VALIDATION.md` exists with per-task test-map structure, Wave 0 pre-execution requirements, and sampling rate spec
  2. `plan-phase.md` step 5.5 appears after the research step and before roadmap creation — it generates `VALIDATION.md` for the phase
  3. Running `gsd-tools.cjs init plan-phase` produces JSON that includes a `nyquist_validation_enabled` boolean field (defaults true)
  4. A plan-phase session with Nyquist enabled produces a VALIDATION.md covering all tasks identified in the plan
**Plans**: 2 plans

Plans:
- [ ] v0.9-02-01-PLAN.md — Create VALIDATION.md template + insert step 5.5 into plan-phase.md (NYQ-01, NYQ-02, NYQ-03, NYQ-05)
- [ ] v0.9-02-02-PLAN.md — Add nyquist_validation to gsd-tools.cjs + config.json files (NYQ-04)

### Phase v0.9-03: Discuss-Phase UX
**Goal**: Discuss-phase presents clearer recommendations per option and allows users to keep exploring gray areas before finalizing
**Depends on**: Phase v0.9-02
**Requirements**: DSC-01, DSC-02, DSC-03
**Success Criteria** (what must be TRUE):
  1. Each option presented in `present_gray_areas` includes a recommended choice with brief reasoning explaining why it is preferred
  2. After all selected gray areas conclude, the user sees an "Explore more gray areas" option rather than being hard-stopped at "I'm ready for context"
  3. Choosing "Explore more gray areas" re-runs `present_gray_areas` with 2-4 newly identified areas that were not already explored — previously explored areas do not reappear
**Plans**: 1 plan

Plans:
- [x] v0.9-03-01-PLAN.md — Apply DSC-01, DSC-02, DSC-03 to `discuss-phase.md` + update command wrapper + install sync

### Phase v0.9-04: Tier 3 Fixes
**Goal**: Skill tool spawn guards, Gemini TOML correctness, and decimal phase parsing are all consistent and correct
**Depends on**: Phase v0.9-03
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. Every Task spawn point in `plan-phase.md` has an explicit guard note instructing Claude not to use the Skill tool
  2. Every Task spawn point in `discuss-phase.md` has an explicit guard note instructing Claude not to use the Skill tool
  3. All QGSD Gemini quorum templates are free of TOML conversion issues that would break quorum consistency
  4. `gsd-tools.cjs` parses decimal phase numbers (N.M format) consistently with integer phase numbers across all subcommands — no subcommand treats N.M as invalid or strips the decimal part
**Plans**: 2 plans

Plans:
- [ ] v0.9-04-01-PLAN.md — RED stubs for decimal phase parsing (FIX-04)
- [ ] v0.9-04-02-PLAN.md — Guard notes (FIX-01, FIX-02), Gemini install (FIX-03), parseInt fix + install sync (FIX-04)

### Phase v0.9-05: Rename get-shit-done/ → qgsd-core/
**Goal**: The QGSD source directory is named `qgsd-core/` (not `get-shit-done/`), all references updated, and the installed runtime continues working correctly
**Depends on**: Phase v0.9-04
**Requirements**: REN-01, REN-02, REN-03, REN-04
**Success Criteria** (what must be TRUE):
  1. `get-shit-done/` directory does not exist; `qgsd-core/` exists in its place with all the same files
  2. `bin/install.js` copies from `qgsd-core/` (not `get-shit-done/`) — running `node bin/install.js --claude --global` succeeds
  3. All hardcoded `get-shit-done/` path strings removed from `bin/gsd-tools.cjs`, workflows, agents, and templates
  4. `~/.claude/qgsd/` runtime is identical before and after rename+install (verified by diff)
**Plans**: 3 plans

Plans:
- [ ] v0.9-05-01-PLAN.md — git mv rename + bin/install.js skillSrc + package.json test path + pre-rename runtime baseline
- [ ] v0.9-05-02-PLAN.md — agents/*.md 43 path refs + templates/phase-prompt.md + hooks/qgsd-circuit-breaker.js message strings
- [ ] v0.9-05-03-PLAN.md — hooks/dist/ sync + node bin/install.js --claude --global + runtime verification

### Phase v0.9-06: v0.9-03 Retroactive Verification
**Goal**: v0.9-03 has a formal VERIFICATION.md artifact derived from its SUMMARY.md inline evidence, closing the audit gap for DSC-01, DSC-02, DSC-03
**Depends on**: Phase v0.9-05
**Requirements**: DSC-01, DSC-02, DSC-03
**Gap Closure**: Closes gaps from v0.9-MILESTONE-AUDIT.md (missing VERIFICATION.md tech debt + DSC requirement partial status)
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/v0.9-03-discuss-phase-ux/v0.9-03-VERIFICATION.md` exists with DSC-01, DSC-02, DSC-03 success criteria evaluated
  2. All three DSC requirements show SATISFIED status in the VERIFICATION.md (evidence drawn from SUMMARY.md grep confirmations and npm test 260/260)
  3. Re-running `/qgsd:audit-milestone v0.9` after this phase shows DSC-01, DSC-02, DSC-03 as satisfied (not partial)
**Plans**: 1 plan

Plans:
- [ ] v0.9-06-01-PLAN.md — Write VERIFICATION.md for v0.9-03 from SUMMARY.md inline evidence; confirm DSC-01/02/03 satisfied

### Phase v0.9-07: Nyquist Parse-List Correction + Path Portability
**Goal**: `plan-phase.md` Step 1 explicitly names `nyquist_validation_enabled` in its parse list, and step 5.5 uses a portable path instead of a hardcoded absolute path
**Depends on**: Phase v0.9-06
**Requirements**: NYQ-04
**Gap Closure**: Closes gaps from v0.9-MILESTONE-AUDIT.md (NYQ-04 integration gap + hardcoded-path tech debt)
**Success Criteria** (what must be TRUE):
  1. `qgsd-core/workflows/plan-phase.md` Step 1 "Parse JSON for:" list includes `nyquist_validation_enabled` as an explicit named field
  2. Step 5.5 in `plan-phase.md` references the VALIDATION.md template via `~/.claude/qgsd/templates/VALIDATION.md` (or equivalent portable expression) — no hardcoded `/Users/jonathanborduas/` prefix
  3. Changes are synced to `hooks/dist/` and the installed runtime via `node bin/install.js --claude --global`
**Plans**: 1 plan

Plans:
- [ ] v0.9-07-01-PLAN.md — Add nyquist_validation_enabled to plan-phase.md Step 1 parse list; replace hardcoded path in step 5.5; install sync

### Phase v0.9-08: Post-v0.9 Install Sync
**Goal**: The model=haiku quorum dispatch flag added in quick-110 is present in the installed runtime, closing the source/runtime drift introduced post-v0.9
**Depends on**: Phase v0.9-07
**Requirements**: (integration — no standalone REQ-ID)
**Gap Closure**: Closes post-v0.9 drift tech debt from v0.9-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. `qgsd-core/workflows/plan-phase.md` and `qgsd-core/workflows/discuss-phase.md` source files contain the `model="haiku"` quorum dispatch flag from quick-110
  2. `~/.claude/qgsd/workflows/plan-phase.md` and `~/.claude/qgsd/workflows/discuss-phase.md` installed copies match the source (verified by diff)
  3. `node bin/install.js --claude --global` runs cleanly and reports success
**Plans**: 1 plan

Plans:
- [ ] v0.9-08-01-PLAN.md — Verify source has model=haiku flag; run install sync; diff installed vs source to confirm no drift

### Phase v0.9-09: SC-4 End-to-End Nyquist Demo
**Goal**: A live plan-phase session with Nyquist enabled has been run end-to-end, producing a VALIDATION.md artifact, demonstrating SC-4
**Depends on**: Phase v0.9-08
**Requirements**: NYQ-02, NYQ-04, NYQ-05
**Gap Closure**: Closes SC-4 undemonstrated tech debt from v0.9-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. A plan-phase session is run with `nyquist_validation_enabled=true` in the INIT JSON
  2. The session produces a `VALIDATION.md` covering all tasks identified in the plan (SC-4 demonstrated)
  3. A demo artifact (e.g., a brief SUMMARY.md or inline record) documents the session outcome, confirming the end-to-end Nyquist pipeline worked
**Plans**: 1 plan

Plans:
- [ ] v0.9-09-01-PLAN.md — Run live plan-phase with Nyquist enabled; capture VALIDATION.md output; write demo artifact

### Phase v0.10-01: Foundation
**Goal**: The manage-agents list view shows quorum W/L, CCR routing, and key-invalid status per slot, and the readQgsdJson/writeQgsdJson helper pair is available for all later phases
**Depends on**: Nothing (first v0.10 phase)
**Requirements**: DISP-01, DISP-02, DISP-03
**Success Criteria** (what must be TRUE):
  1. Running `listAgents()` on a project with a populated quorum-scoreboard.json shows a W/L column with win and loss counts per slot; when the scoreboard file is absent (fresh install), the column shows `—` for all slots with no crash — an existsSync guard prevents ENOENT from propagating
  2. Running `listAgents()` on a machine with CCR routing configured shows the CCR provider name in a dedicated column per slot derived dynamically from `readCcrConfigSafe()`; slots with no CCR route show `—`; when `~/.claude-code-router/config.json` is absent entirely, all slots show `—` with no error banner
  3. Running `listAgents()` after a slot's last health probe returned 401 AND that slot has a configured key shows a `[key invalid]` badge for that slot; slots with no key or a valid last probe show no badge; badge state derives from `key_status` in `qgsd.json` (survives restart without re-probing)
  4. `readQgsdJson()` and `writeQgsdJson()` helpers exist in `manage-agents.cjs`, use the existing atomic tmp-rename write pattern, and are exported via `module.exports._pure` for unit testing
  5. Unit tests cover all three absent-file edge cases: no scoreboard file, no CCR config file, no `key_status` field in `qgsd.json`
**Plans**: 2 plans

Plans:
- [x] v0.10-01-01-PLAN.md — Add readQgsdJson/writeQgsdJson helpers + slotToFamily/getWlDisplay/readCcrConfigSafe/getCcrProviderForSlot/getKeyInvalidBadge pure functions + TDD unit tests (DISP-01, DISP-02, DISP-03) — COMPLETE 2026-02-24
- [x] v0.10-01-02-PLAN.md — Integrate helpers into listAgents() to render W/L, CCR, and key-invalid columns; manual visual verification (DISP-01, DISP-02, DISP-03) — COMPLETE 2026-02-24 (checkpoint:human-verify pending)

### Phase v0.10-02: Presets and Cloning
**Goal**: Users can select a provider by name instead of typing a URL, and can duplicate any existing slot in one flow
**Depends on**: Phase v0.10-01
**Requirements**: PRST-01, PRST-02
**Success Criteria** (what must be TRUE):
  1. When adding or editing an agent, the base URL step presents a named provider list (AkashML, Together.xyz, Fireworks.ai) plus a Custom escape hatch via an inquirer `list` prompt replacing the previous free-text `input` prompt; selecting a preset auto-fills the base URL without manual typing; inquirer@8.2.7 CJS is used — the package is not upgraded
  2. Selecting a provider preset triggers a pre-flight provider probe before the slot is written; if the probe fails the user sees an error and is offered a retry or cancel — no partial slot is written on probe failure
  3. A "Clone slot" option appears in the main menu; selecting it presents the existing slot list, copies the chosen slot's provider URL and model config to a new slot name the user provides, and validates that the new slot name is unique before writing
  4. After cloning, the user is prompted to set an API key for the new slot; skipping is allowed but the slot is shown with `[no key]`; the original slot's key is never copied to the clone (keytar isolation)
**Plans**: 2 plans

Plans:
- [ ] v0.10-02-01-PLAN.md — TDD: buildPresetChoices + findPresetForUrl + buildCloneEntry pure functions + unit tests (PRST-01, PRST-02)
- [ ] v0.10-02-02-PLAN.md — Integration: preset selector in addAgent/editAgent + probeWithRetryOrCancel + cloneSlot + mainMenu wiring (PRST-01, PRST-02)

### Phase v0.10-03: Credential Management
**Goal**: Users can rotate API keys across multiple slots in one flow, and key validity status persists across sessions without requiring a re-probe on restart
**Depends on**: Phase v0.10-02
**Requirements**: CRED-01, CRED-02
**Success Criteria** (what must be TRUE):
  1. A "Batch rotate keys" option appears in the main menu; the user selects multiple slots via a checkbox picker, then enters a new key for each selected slot one at a time; the rotation loop uses a sequential `for...of` — never `Promise.all` — to avoid keychain concurrency errors and key-index read-modify-write race conditions
  2. After each individual slot's key is updated within the batch flow, a per-slot confirmation line is displayed (e.g., `claude-1: key updated`) before the next slot's prompt appears; a single `syncToClaudeJson()` call is made after all slots are processed
  3. After a health probe returns a 401 for any slot, `key_status` for that slot is written to `qgsd.json` as `{ "status": "invalid", "checkedAt": "<ISO timestamp>" }`; this value persists to disk so the `[key invalid]` badge survives a process restart without requiring a new probe
  4. After a subsequent successful health probe for the same slot, `key_status` is updated to `{ "status": "ok", "checkedAt": "<ISO timestamp>" }`, causing the badge to clear on the next `listAgents()` call
**Plans**: 3 plans

Plans:
- [ ] v0.10-03-01-PLAN.md — Wave 0: failing test stubs for classifyProbeResult and writeKeyStatus (CRED-01, CRED-02)
- [ ] v0.10-03-02-PLAN.md — TDD: implement classifyProbeResult() pure function + writeKeyStatus() helper (CRED-02)
- [ ] v0.10-03-03-PLAN.md — Integration: checkAgentHealth() key_status persistence + batchRotateKeys() + mainMenu() wiring (CRED-01, CRED-02)

### Phase v0.10-04: Live Health Dashboard
**Goal**: Users can open a live health view from the main menu that refreshes on keypress and exits cleanly back to the menu with no stdin side effects
**Depends on**: Phase v0.10-03
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. Selecting "Live health dashboard" from the main menu enters a full-screen health view showing each slot's provider, model, and health status; the view uses a readline mode-switch architecture (inquirer is fully exited before the raw stdin loop starts) — no setInterval timer runs while inquirer holds the TTY
  2. Pressing space or `r` triggers an immediate refresh of all slots' health status; a "Last updated: HH:MM:SS" timestamp is shown at the bottom of the screen after every refresh; if the displayed data becomes more than 60 seconds old without a refresh, a yellow "stale" warning appears next to the timestamp
  3. Pressing `q` or Escape exits the dashboard and returns to the main menu with stdin fully restored — `setRawMode(false)` and `removeAllListeners('keypress')` are called before `mainMenu()` is re-entered, and no characters typed after exit are swallowed by a stale raw-mode listener
  4. When the dashboard is invoked in a non-TTY context (piped output, CI), it falls back to a single static one-time health print and returns immediately rather than entering raw mode; the TTY guard checks `process.stdout.isTTY` before entering dashboard mode
**Plans**: 3 plans

Plans:
- [x] v0.10-04-01-PLAN.md — Wave 0: failing stubs for buildDashboardLines (8 cases) + formatTimestamp (3 cases) (DASH-01, DASH-02)
- [x] v0.10-04-02-PLAN.md — Wave 1 GREEN: implement buildDashboardLines + formatTimestamp pure functions + _pure export (DASH-01, DASH-02)
- [ ] v0.10-04-03-PLAN.md — Wave 2 integration: probeAllSlots + liveDashboard raw mode loop + mainMenu wiring + non-TTY fallback + human verify (DASH-01, DASH-02, DASH-03)

### Phase v0.10-05: Policy UIs
**Goal**: Users can configure quorum timeout and update policy per slot from the main menu, and slots set to auto are checked for updates on startup
**Depends on**: Phase v0.10-04
**Requirements**: PLCY-01, PLCY-02, PLCY-03
**Success Criteria** (what must be TRUE):
  1. A "Tune timeouts" option is accessible directly from the main menu (not nested inside editAgent); selecting it shows each slot with its current timeout value and allows entry of a new value; after saving, a "restart required" note is shown — a timeout change without this note is a defect
  2. A "Set update policy" option is accessible from the main menu; the user can set each slot's policy to `auto`, `prompt`, or `skip`; the selected value is persisted under `agent_config[slot].update_policy` in `qgsd.json` via `writeQgsdJson()`
  3. When `manage-agents.cjs` starts and at least one slot has `update_policy: "auto"`, those slots are checked for available updates before the main menu is shown; the check outcome is written to `~/.claude/qgsd-update.log` with a timestamped entry per slot
  4. If `~/.claude/qgsd-update.log` contains recent ERROR entries, a warning banner is displayed at the top of the `listAgents()` output on the next run — users are not silently failing on auto-update errors
**Plans**: 3 plans

Plans:
- [x] v0.10-05-01-PLAN.md — Wave 0: 22 failing test stubs for 5 pure functions (buildTimeoutChoices, applyTimeoutUpdate, buildPolicyChoices, buildUpdateLogEntry, parseUpdateLogErrors)
- [x] v0.10-05-02-PLAN.md — Wave 1: implement pure functions (stubs turn GREEN, 118 tests pass)
- [ ] v0.10-05-03-PLAN.md — Wave 2: integration wiring + checkpoint:human-verify (tuneTimeouts, setUpdatePolicy, runAutoUpdateCheck, listAgents banner)

### Phase v0.10-06: Import/Export
**Goal**: Users can save the full roster to a portable JSON file and restore it on any machine, with API keys unconditionally stripped on export and a timestamped backup created before any import applies
**Depends on**: Phase v0.10-05
**Requirements**: PORT-01, PORT-02, PORT-03
**Gap Closure:** Closes PORT-01/02/03 unsatisfied gaps from v0.10 audit — phase was never planned or implemented
**Success Criteria** (what must be TRUE):
  1. An "Export roster" option in the main menu writes a portable JSON file; every env value matching `/_KEY$|_SECRET$|_TOKEN$|_PASSWORD$/i` is replaced with `__redacted__` unconditionally — the export path never calls `syncToClaudeJson()` before reading, so keytar fallback plaintext values cannot leak into the export file
  2. An "Import roster" option reads a JSON file, validates the schema before writing anything (all `command` fields must be `node` or `npx`; no `args` entries may contain absolute user home paths like `/Users/` or `/home/`), and reports all validation errors up front — zero partial applies occur when validation fails
  3. Any `__redacted__` key value in an imported file triggers a per-slot prompt asking the user to enter the real key; the user can skip individual slots, which are then imported with no key configured and shown as `[no key]` in the list view
  4. Before any import changes are written, a timestamped backup of `~/.claude.json` is created at `~/.claude.json.pre-import.<ISO-timestamp>` and the backup path is displayed to the user; if the backup write fails, the import is aborted entirely
**Plans**: 3 plans

Plans:
- [x] v0.10-06-01-PLAN.md — Wave 0: 15 failing test stubs for buildBackupPath, buildRedactedEnv, buildExportData, validateImportSchema (PORT-01, PORT-02, PORT-03) — commit 9ea3c4d
- [x] v0.10-06-02-PLAN.md — Wave 1: implement 4 pure functions + add to _pure export block, 140 tests GREEN (PORT-01, PORT-02, PORT-03) — commit 946e7d3
- [x] v0.10-06-03-PLAN.md — Wave 2: backupClaudeJson + performExport + performImport I/O functions + mainMenu items 16/17 + checkpoint:human-verify (PORT-01, PORT-02, PORT-03) — commit 5d3ee91

### Phase v0.10-07: Retroactive Verification Closure
**Goal**: Phases v0.10-02, v0.10-03, and v0.10-04 each have a VERIFICATION.md with explicit requirement traceability and implementing commit references; probeAllSlots and liveDashboard are unit-testable via _pure exports with an integration smoke test; menu numbering is sequential
**Depends on**: Phase v0.10-05
**Requirements**: PRST-01, PRST-02, CRED-01, CRED-02, DASH-01, DASH-02, DASH-03
**Gap Closure:** Closes orphaned requirements from v0.10 audit — phases completed implementation without producing VERIFICATION.md artifacts
**Success Criteria** (what must be TRUE):
  1. `v0.10-02-VERIFICATION.md` exists in `.planning/phases/v0.10-02-presets-and-cloning/` — references PRST-01, PRST-02, the implementing commits, and specifies which checks are auto vs. human_verification
  2. `v0.10-03-VERIFICATION.md` exists in `.planning/phases/v0.10-03-credential-management/` — references CRED-01, CRED-02, implementing commits, auto/human split; menu numbering corrected (11, 12, 13 sequential — item 12 no longer absent)
  3. `v0.10-04-VERIFICATION.md` exists in `.planning/phases/v0.10-04-live-health-dashboard/` — references DASH-01, DASH-02, DASH-03, implementing commits, auto/human split; `probeAllSlots` and `liveDashboard` exported via `module.exports._pure`
  4. Unit tests cover `probeAllSlots` and `liveDashboard` via `_pure` exports; an integration smoke test for `liveDashboard` validates entry, keypress refresh, and exit flow using mock stdin (no interactive TTY required)
**Plans**: 3 plans

Plans:
- [x] v0.10-07-01-PLAN.md — Wave 0: 4 failing test stubs for probeAllSlots (3 unit) + liveDashboard (1 smoke) — documents RED state before _pure export fix (DASH-01, DASH-02, DASH-03)
- [x] v0.10-07-02-PLAN.md — Wave 1: add probeAllSlots + liveDashboard to _pure; fix menu numbering 13→12 cascade; confirm 122 tests pass (CRED-01, DASH-01, DASH-02, DASH-03)
- [x] v0.10-07-03-PLAN.md — Wave 2: write v0.10-02/03/04-VERIFICATION.md + update v0.10-05-VERIFICATION.md menu numbers (PRST-01, PRST-02, CRED-01, CRED-02, DASH-01, DASH-02, DASH-03)

### Phase v0.10-08: PLCY-03 Auto-Update Bug Fix
**Goal**: The critical Map bracket notation bug in `runAutoUpdateCheck()` is fixed, covered by a regression test, and the v0.10-05 VERIFICATION.md critical bug flag is cleared
**Depends on**: Phase v0.10-07
**Requirements**: PLCY-03
**Gap Closure:** Closes PLCY-03 critical bug — `statuses[slot]` bracket notation on a Map always returns undefined; all auto-update entries were logged as SKIP
**Success Criteria** (what must be TRUE):
  1. `bin/manage-agents.cjs` line 1445 uses `statuses.get(binName)` with correct slot→CLI binary name mapping — not `statuses[slot]` — and the auto-update check logs real status entries instead of SKIP for all slots
  2. A unit test for `runAutoUpdateCheck()` demonstrates RED behavior with `statuses[slot]` (test fails — always SKIP) and GREEN behavior with `statuses.get(binName)` (test passes — correct status logged); this test is a permanent regression guard
  3. `v0.10-05-VERIFICATION.md` is updated to clear the `gaps_found` / critical bug flag; PLCY-03 status is updated from `unsatisfied` to `satisfied` or `human_needed` per remaining TTY checks
**Plans**: 2 plans

Plans:
- [ ] v0.10-08-01-PLAN.md — Wave 0: 3 RED regression test stubs proving Map bracket notation bug and fix direction (PLCY-03)
- [ ] v0.10-08-02-PLAN.md — Wave 1: fix statuses.get(binName) + providerMap lookup + getStatusesFn injection + field name fixes + update VERIFICATION.md and MILESTONE-AUDIT.md (PLCY-03)

### Phase v0.12-01: Conformance Event Infrastructure
**Goal**: Hooks emit structured conformance events to a shared NDJSON log, the XState machine is compiled and available for replay, and developers and users can run validate-traces.cjs to check execution conformance
**Depends on**: Nothing (first v0.12 phase)
**Requirements**: LOG-01, LOG-02, LOG-03, XST-01, XST-02, XST-03, VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):
  1. Developer can `require('./bin/conformance-schema.cjs')` and get `VALID_ACTIONS`, `VALID_PHASES`, `VALID_OUTCOMES`, and `schema_version` — both hooks and validate-traces.cjs import from this single module with no independent field lists
  2. After a quorum decision turn, `.planning/conformance-events.jsonl` contains a new NDJSON line with `{ ts, phase, action, slots_available, vote_result, outcome }` — confirmed by reading the file; the hook critical path shows no timing regression and no stdout output added
  3. Developer can find `src/machines/qgsd-workflow.machine.ts` with 4 states (`IDLE`, `COLLECTING_VOTES`, `DELIBERATING`, `DECIDED`) and 3 guards (`minQuorumMet`, `noInfiniteDeliberation`, `phaseMonotonicallyAdvances`); `tsup` build compiles it to CJS without touching any hook file
  4. User can run `node ~/.claude/qgsd-bin/validate-traces.cjs` and see a deviation score (% of valid XState executions) plus any flagged divergences — exit code 0 on clean log, non-zero on violations
**Plans**: 3 plans

Plans:
- [ ] v0.12-01-01-PLAN.md — Wave 0 stubs + conformance-schema.cjs + hook instrumentation in qgsd-stop.js and qgsd-prompt.js (LOG-01, LOG-02, LOG-03)
- [ ] v0.12-01-02-PLAN.md — XState v5 machine TypeScript source + tsconfig.formal.json + tsup CJS build (XST-01, XST-02, XST-03)
- [ ] v0.12-01-03-PLAN.md — validate-traces.cjs implementation + integration tests + install distribution (VAL-01, VAL-02, VAL-03)

### Phase v0.12-02: TLA+ Formal Spec
**Goal**: A TLA+ specification of QGSD's quorum workflow exists with named safety and liveness invariants, two TLC model configurations are verified, and developers can invoke TLC via a bin/ script
**Depends on**: Phase v0.12-01
**Requirements**: TLA-01, TLA-02, TLA-03, TLA-04
**Success Criteria** (what must be TRUE):
  1. Developer can find `formal/tla/QGSDQuorum.tla` with named invariants `MinQuorumMet`, `NoInvalidTransition`, and `EventualConsensus` — state names mirror the XState machine from v0.12-01
  2. Running TLC with `formal/tla/MCsafety.cfg` (symmetry sets, N=5) completes with no violations; running TLC with `formal/tla/MCliveness.cfg` (no symmetry, N=3) completes with no liveness violations
  3. Developer can run `node bin/run-tlc.cjs` — the script checks for Java ≥17, invokes the TLC JAR, and exits with a clear error message if `JAVA_HOME` is unset; `npm test` passes without Java installed
**Plans**: 3 plans

Plans:
- [ ] v0.12-02-01-PLAN.md — Wave 0 RED stubs for bin/run-tlc.test.cjs + package.json update (TLA-04)
- [ ] v0.12-02-02-PLAN.md — Author QGSDQuorum.tla + MCsafety.cfg + MCliveness.cfg + formal/tla/ scaffolding (TLA-01, TLA-02, TLA-03)
- [ ] v0.12-02-03-PLAN.md — Implement bin/run-tlc.cjs (GREEN phase) + full npm test verification (TLA-04)

### Phase v0.12-03: Static Analysis Suite
**Goal**: Alloy vote-counting model, PRISM probabilistic DTMC, and Petri Net token model are all authored and runnable; Java ≥17 is documented once as the shared prerequisite for all three JVM tools
**Depends on**: Phase v0.12-01
**Requirements**: ALY-01, ALY-02, PRM-01, PRM-02, PRM-03, PET-01, PET-02, PET-03
**Success Criteria** (what must be TRUE):
  1. Developer can find `formal/alloy/quorum-votes.als` with `pred`-based vote-counting predicates (not `fact`) and a `check` assertion for `NoSpuriousApproval`; running `bin/run-alloy.cjs` invokes Alloy 6 JAR headless and is gated on `JAVA_HOME`
  2. Developer can find `formal/prism/quorum.pm` — a DTMC model of quorum convergence; running `bin/export-prism-constants.cjs` reads scoreboard TP/TN/UNAVAIL data and writes a `.const` file; the script warns and uses conservative priors when any slot has fewer than 30 rounds
  3. Developer can run `bin/generate-petri-net.cjs` to get a DOT-format Petri Net rendered to SVG via `@hpcc-js/wasm-graphviz` with no system Graphviz install; the script prints a structural deadlock warning if `min_quorum_size > available_slots`
  4. `VERIFICATION_TOOLS.md` documents Java 17 as the single installation prerequisite for TLA+, Alloy, and PRISM; all three JVM invocations are gated on `JAVA_HOME`/`PRISM_BIN`; `npm test` passes on a machine without Java
**Plans**: 4 plans

Plans:
- [ ] v0.12-03-01-PLAN.md — Wave 0: RED test stubs for all 3 scripts + formal/ directory scaffolding + .gitignore entries (ALY-02, PRM-02, PRM-03, PET-01, PET-02, PET-03)
- [ ] v0.12-03-02-PLAN.md — Wave 1: formal/alloy/quorum-votes.als spec + bin/run-alloy.cjs wrapper + GREEN tests (ALY-01, ALY-02)
- [ ] v0.12-03-03-PLAN.md — Wave 1 (parallel): formal/prism/quorum.pm DTMC + bin/export-prism-constants.cjs + GREEN tests (PRM-01, PRM-02, PRM-03)
- [ ] v0.12-03-04-PLAN.md — Wave 2: bin/generate-petri-net.cjs + VERIFICATION_TOOLS.md + npm test update (PET-01, PET-02, PET-03)

### Phase v0.12-04: Circuit Breaker Algorithm Verification
**Goal**: The run-collapse oscillation detection algorithm and circuit breaker state persistence are formally verified — oscillation is flagged correctly (iff ≥3 alternating groups with net-negative diff), the algorithm terminates, resolvedAt is write-once, and Haiku unavailability cannot corrupt persisted state
**Depends on**: Phase v0.12-03
**Requirements**: GAP-1, GAP-5
**Success Criteria** (what must be TRUE):
  1. `formal/tla/QGSDOscillation.tla` exists with state vars `commits`, `runs`, `flagCount`; invariant `OscillationFlaggedCorrectly` (flag iff ≥3 alternating groups with net-negative diff); liveness property `AlgorithmTerminates`
  2. TLC verifies `MCoscillation.cfg` with INVARIANT + PROPERTY — no violations
  3. `formal/tla/QGSDConvergence.tla` exists with `resolvedAt` write-once invariant; log-write-before-state-delete ordering; Haiku unavailability cannot corrupt state
  4. `bin/run-oscillation-tlc.cjs` exists, is gated on JAVA_HOME, and `npm test` passes without Java installed; 4 error-path tests in `bin/run-oscillation-tlc.test.cjs` are GREEN
**Plans**: 3 plans

Plans:
- [ ] v0.12-04-01-PLAN.md — Wave 0 RED stubs for run-oscillation-tlc.test.cjs + package.json side-fix (GAP-1, GAP-5)
- [ ] v0.12-04-02-PLAN.md — Author QGSDOscillation.tla + MCoscillation.cfg + QGSDConvergence.tla + MCconvergence.cfg (GAP-1, GAP-5)
- [ ] v0.12-04-03-PLAN.md — Implement bin/run-oscillation-tlc.cjs + GREEN tests (GAP-1, GAP-5)

### Phase v0.12-05: Protocol Termination Proofs
**Goal**: The R3 deliberation loop (max 10 rounds) and R3.6 improvement iteration loop (max 10 iterations) are provably bounded and eventually terminate; the R4 pre-filter protocol terminates within 3 rounds; regression handling and auto-resolution soundness are formally specified
**Depends on**: Phase v0.12-04
**Requirements**: GAP-2, GAP-6
**Success Criteria** (what must be TRUE):
  1. `formal/tla/QGSDDeliberation.tla` exists with vars `deliberationRound`, `improvementIteration`, `voteState`; invariant `TotalRoundsBounded` (deliberationRound + improvementIteration ≤ 20); liveness `ProtocolTerminates` (<>(phase = "ESCALATED" \/ phase = "CONSENSUS")); regression rule: APPROVE→BLOCK transition treated as new blocker
  2. TLC verifies `MCdeliberation.cfg` — no violations
  3. `formal/tla/QGSDPreFilter.tla` exists with invariant `AutoResolutionSound` (auto-resolved iff all models agree + same answer) and liveness `PreFilterTerminates` (≤3 rounds)
  4. `bin/run-protocol-tlc.cjs` exists, gated on JAVA_HOME; `npm test` passes without Java; `bin/run-protocol-tlc.test.cjs` has error-path tests GREEN
**Plans**: 3 plans

Plans:
- [x] v0.12-05-01-PLAN.md — Wave 0 RED stubs for run-protocol-tlc.test.cjs (GAP-2, GAP-6)
- [x] v0.12-05-02-PLAN.md — Author QGSDDeliberation.tla + MCdeliberation.cfg + QGSDPreFilter.tla + MCprefilter.cfg (GAP-2, GAP-6)
- [x] v0.12-05-03-PLAN.md — Implement bin/run-protocol-tlc.cjs + GREEN tests (GAP-2, GAP-6)

### Phase v0.12-06: Audit Trail Invariants
**Goal**: The scoreboard recomputation function is formally verified as idempotent with no vote loss and no double counting; the availability hint date arithmetic handles year rollover and returns null on unrecognized format
**Depends on**: Phase v0.12-03
**Requirements**: GAP-3, GAP-9
**Success Criteria** (what must be TRUE):
  1. `formal/alloy/scoreboard-recompute.als` exists with assertions `RecomputeIdempotent` (applying recompute twice = once), `NoVoteLoss` (every vote in rounds appears in final score), `NoDoubleCounting` (no vote counted twice); uses Alloy integer arithmetic for delta accumulation
  2. `formal/alloy/availability-parsing.als` exists with assertions `ParseCorrect` (parsed timestamp ≥ now), `YearRolloverHandled` (Dec→Jan crossing), `FallbackIsNull` (unrecognized format → null, not crash)
  3. `bin/run-audit-alloy.cjs` targets both .als files, is gated on JAVA_HOME; `npm test` passes without Java; `bin/run-audit-alloy.test.cjs` has error-path tests GREEN
**Plans**: 3 plans

Plans:
- [ ] v0.12-06-01-PLAN.md — Wave 0 RED stubs for run-audit-alloy.test.cjs (GAP-3, GAP-9)
- [ ] v0.12-06-02-PLAN.md — Author scoreboard-recompute.als + availability-parsing.als (GAP-3, GAP-9)
- [ ] v0.12-06-03-PLAN.md — Implement bin/run-audit-alloy.cjs + GREEN tests (GAP-3, GAP-9)

### Phase v0.12-07: Hook Transcript Verification
**Goal**: The qgsd-stop.js transcript scanning algorithm is formally verified — the last human message boundary is correctly identified, every tool_use_id matches at most one tool_result, no tool_result is double-counted, and successCount never exceeds minSize
**Depends on**: Phase v0.12-06
**Requirements**: GAP-4
**Success Criteria** (what must be TRUE):
  1. `formal/alloy/transcript-scan.als` exists with sigs `Entry`, `ToolUse extends Entry`, `ToolResult extends Entry`, `HumanMessage extends Entry` modeling JSONL transcript as ordered sequence; predicates `BoundaryCorrect`, `PairingUnique`, `NoDuplicateCounting`, `SuccessCountNeverExceedsMinSize` (renamed from CeilingEnforced per quorum deliberation — clarifies upper-bound semantics)
  2. All 4 predicates are asserted as checks — Alloy Analyzer finds no counterexamples
  3. `bin/run-transcript-alloy.cjs` exists, gated on JAVA_HOME; `npm test` passes without Java; `bin/run-transcript-alloy.test.cjs` has error-path tests GREEN
**Plans**: 3 plans

Plans:
- [x] v0.12-07-01-PLAN.md — Wave 0 RED stubs for run-transcript-alloy.test.cjs (GAP-4)
- [x] v0.12-07-02-PLAN.md — Author formal/alloy/transcript-scan.als (GAP-4)
- [x] v0.12-07-03-PLAN.md — Implement bin/run-transcript-alloy.cjs + GREEN tests (GAP-4)

### Phase v0.12-08: Installer and Taxonomy Extensions
**Goal**: The install.js rollback is formally verified as sound (uninstall restores previous state) and config sync is verified complete (hooks/dist/ and ~/.claude/hooks/ in sync after install); the Haiku classification taxonomy is verified injection-safe and maintains closed/open category consistency
**Depends on**: Phase v0.12-07
**Requirements**: GAP-7, GAP-8
**Success Criteria** (what must be TRUE):
  1. `formal/alloy/install-scope.als` is extended with pred `RollbackSound` (uninstall restores previous state) and pred `ConfigSyncComplete` (after install, hooks/dist/ and ~/.claude/hooks/ are identical)
  2. `formal/alloy/taxonomy-safety.als` exists with sigs `TaskDescription`, `Category`, `Subcategory`; asserts `NoInjection` (taskDescription content cannot alter category structure), `TaxonomyClosed` (is_new=false implies category already in sig), `NewCategoryConsistent` (is_new=true implies category not previously in sig)
  3. `bin/run-installer-alloy.cjs` exists, targets both install-scope.als and taxonomy-safety.als, is gated on JAVA_HOME; `npm test` passes without Java; `bin/run-installer-alloy.test.cjs` has error-path tests GREEN
**Plans**: 3 plans

Plans:
- [x] v0.12-08-01-PLAN.md — Wave 0 RED stubs for run-installer-alloy.test.cjs (GAP-7, GAP-8)
- [x] v0.12-08-02-PLAN.md — Extend install-scope.als + author taxonomy-safety.als (GAP-7, GAP-8)
- [x] v0.12-08-03-PLAN.md — Implement bin/run-installer-alloy.cjs + GREEN tests (GAP-7, GAP-8)

### Phase v0.12-09: Verification Infrastructure Quick Fixes
**Goal**: All 5 isolated verification infrastructure bugs are fixed: MCconvergence runs with -workers 1 (liveness-safe), JAR-not-found tests in run-tlc.test.cjs and run-alloy.test.cjs have conditional-skip guards, stale "NoSpuriousApproval" error message in run-alloy.cjs is corrected, rates.const variable names align with quorum.pm (or aggregation is documented), and the Petri net deadlock condition uses a runtime-parameterizable threshold
**Depends on**: Phase v0.12-08
**Requirements**: GAP-5, TLA-04, ALY-02, PRM-02, PET-03
**Gap Closure:** Closes gaps from v0.12 audit
**Success Criteria** (what must be TRUE):
  1. `bin/run-oscillation-tlc.cjs`: MCconvergence branch uses `-workers 1` (not `'auto'`) — liveness PROPERTY verified safely
  2. `bin/run-tlc.test.cjs`: JAR-not-found test skips (not fails) when `formal/tla/tla2tools.jar` is present — consistent with pattern in run-audit-alloy.test.cjs
  3. `bin/run-alloy.test.cjs`: JAR-not-found test skips (not fails) when `formal/alloy/org.alloytools.alloy.dist.jar` is present
  4. `bin/run-alloy.cjs`: error message uses the actual assertion name from `quorum-votes.als` (not the stale "NoSpuriousApproval")
  5. Either: `bin/export-prism-constants.cjs` generates aggregate `tp_rate`/`unavail` variables matching `quorum.pm`, OR `VERIFICATION_TOOLS.md` documents the manual aggregation step with a concrete example
  6. `bin/generate-petri-net.cjs`: deadlock condition uses a runtime-visible threshold (not hardcoded `MIN_QUORUM_SIZE=3` vs `SLOTS=5`); `npm test` 312/312 pass
**Plans**: 5 plans

Plans:
- [ ] v0.12-09-01-PLAN.md — GAP-5: change MCconvergence workers '1' (liveness-safe) (GAP-5)
- [ ] v0.12-09-02-PLAN.md — TLA-04: conditional-skip guard for tla2tools.jar JAR-not-found test (TLA-04)
- [ ] v0.12-09-03-PLAN.md — ALY-02: fix stale "NoSpuriousApproval" assertion name + alloy JAR skip guard (ALY-02)
- [ ] v0.12-09-04-PLAN.md — PRM-02: document manual aggregation step in VERIFICATION_TOOLS.md (PRM-02)
- [ ] v0.12-09-05-PLAN.md — PET-03: add --min-quorum CLI flag for runtime-parameterizable deadlock threshold (PET-03)

### Phase v0.12-10: Conformance Score Redesign
**Goal**: The conformance score in validate-traces.cjs accurately reflects protocol violations rather than structural replay artifacts; VALID_PHASES includes "DECIDING" so the schema validator catches actual phase violations; the multi-step replay groups events into quorum sessions before evaluating state transitions
**Depends on**: Phase v0.12-09
**Requirements**: LOG-03, VAL-01, VAL-02
**Gap Closure:** Closes gaps from v0.12 audit
**Success Criteria** (what must be TRUE):
  1. `formal/shared/conformance-schema.cjs` VALID_PHASES includes "DECIDING" — hooks no longer emit schema-violating phase values
  2. `bin/validate-traces.cjs` groups conformance events by quorum session (quorum_id field) before replay — each session replayed as a full state sequence (quorum_start → quorum_block* → quorum_complete), not one fresh-IDLE actor per event
  3. The conformance score reported by validate-traces.cjs reflects only genuine state transition violations (events that do not follow valid sequences), not structural artifacts from single-step replay
  4. quorum_start events validate to COLLECTING_VOTES, quorum_block to DELIBERATING, quorum_complete to DECIDED — transitions correct in multi-step context
  5. `npm test` passes; `bin/validate-traces.test.cjs` updated for new multi-step replay behavior
**Plans**: 3 plans

Plans:
- [ ] v0.12-10-01-PLAN.md — Wave 0 RED stubs for updated validate-traces.test.cjs + LOG-03 schema fix (LOG-03, VAL-01)
- [ ] v0.12-10-02-PLAN.md — Refactor validate-traces.cjs: session-grouping replay engine replacing per-event IDLE replay (VAL-01, VAL-02)
- [ ] v0.12-10-03-PLAN.md — GREEN tests + conformance score verification + install sync (VAL-01, VAL-02)

### Phase v0.13-01: Loop Wiring
**Goal**: The milestone execution chain runs audit-milestone automatically at the last-phase boundary, detects whether a re-audit or fresh completion is needed, and advances to plan-milestone-gaps without human input when gaps are found; STATE.md always reflects the current audit result
**Depends on**: Nothing (first v0.13 phase)
**Requirements**: LOOP-01, LOOP-02, LOOP-03, STATE-01
**Success Criteria** (what must be TRUE):
  1. Running the last-phase transition invokes audit-milestone before complete-milestone — no human prompt required to initiate the audit step
  2. When the completed phase's ROADMAP entry contains the `**Gap Closure:**` marker, the transition routes to audit-milestone instead of complete-milestone — the re-audit path fires automatically
  3. When audit-milestone produces a gaps_found result with at least one phase classified missing_no_plan, it auto-spawns a plan-milestone-gaps Task — no user confirmation step intervenes
  4. After audit-milestone writes the MILESTONE-AUDIT.md artifact, STATE.md "Stopped at" and "Current Position" fields are updated to reflect the audit result (passed / gaps_found / tech_debt) before the workflow exits
**Plans**: 1 plan

Plans:
- [ ] v0.13-01-01-PLAN.md — Wire Route B audit gate + Gap Closure detection in transition.md; auto-spawn and STATE.md update in audit-milestone.md (LOOP-01, LOOP-02, LOOP-03, STATE-01)

### Phase v0.13-02: Quorum Gates
**Goal**: Every decision point in the autonomous loop that previously halted execution and asked the user a question now calls R3 quorum instead — gap phase approval, plan-phase auto-spawn, gap resolution during execution, and gray-area decisions during discuss-phase all proceed without human checkpoints
**Depends on**: Phase v0.13-01
**Requirements**: QUORUM-01, LOOP-04, QUORUM-02, QUORUM-03
**Success Criteria** (what must be TRUE):
  1. When plan-milestone-gaps proposes new gap closure phases, it submits them to R3 quorum for approval before updating ROADMAP.md — the previous AskUserQuestion confirmation gate is gone; quorum APPROVE triggers the ROADMAP update; quorum BLOCK surfaces the objection for resolution
  2. After quorum approves the proposed gap phases in plan-milestone-gaps, it auto-spawns a plan-phase Task for the first gap phase — no human prompt required to begin planning the first gap phase
  3. When execute-phase detects a gaps_found condition mid-execution, it routes to quorum diagnosis and auto-resolution instead of halting the chain — quorum proposes the fix; execution resumes after APPROVE
  4. When discuss-phase has remaining user_questions after the R4 pre-filter, it routes them to quorum in auto mode instead of presenting them to the user — quorum answers the gray areas; execution continues without any AskUserQuestion call
**Plans**: 3 plans

Plans:
- [x] v0.13-02-01-PLAN.md — Replace plan-milestone-gaps Step 5 confirmation gate with R3 quorum approval; replace Step 10 text suggestion with plan-phase auto-spawn Task (QUORUM-01, LOOP-04)
- [x] v0.13-02-02-PLAN.md — Replace execute-phase gaps_found manual suggestion with quorum diagnosis + plan-phase --gaps auto-spawn; update offer_next Exception note (QUORUM-02)
- [x] v0.13-02-03-PLAN.md — Add second quorum pass on for_user[] survivors in auto mode at discuss-phase present_gray_areas step (QUORUM-03)

### Phase v0.13-03: Write VERIFICATION.md + Bookkeeping
**Goal**: Produce formal VERIFICATION.md artifacts for both v0.13-01 and v0.13-02, closing the orphaned-requirement status for all 8 v0.13 requirements and completing the audit trail required by the QGSD trust+audit enforcement model
**Depends on**: Phase v0.13-02
**Requirements**: LOOP-01, LOOP-02, LOOP-03, STATE-01, QUORUM-01, LOOP-04, QUORUM-02, QUORUM-03
**Gap Closure:** Closes gaps from audit — v0.13-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/v0.13-01-loop-wiring/VERIFICATION.md` exists with a per-requirement checklist covering LOOP-01, LOOP-02, LOOP-03, STATE-01 and evidence citations pointing to the actual workflow files where each requirement is implemented
  2. `.planning/phases/v0.13-02-quorum-gates/VERIFICATION.md` exists with a per-requirement checklist covering QUORUM-01, LOOP-04, QUORUM-02, QUORUM-03 and evidence citations
  3. `REQUIREMENTS.md` traceability table updated: all 8 requirements show Status = `Complete` (not `Pending`)
  4. ROADMAP.md Phase v0.13-02 checkbox is `[x]` (complete) in the Progress table
**Plans**: 2 plans

Plans:
- [x] v0.13-03-01-PLAN.md — Write VERIFICATION.md for v0.13-01 (LOOP-01..03, STATE-01) with per-requirement checklists and evidence citations from transition.md and audit-milestone.md
- [x] v0.13-03-02-PLAN.md — Write VERIFICATION.md for v0.13-02 (QUORUM-01, LOOP-04, QUORUM-02, QUORUM-03) with per-requirement checklists; update REQUIREMENTS.md traceability (all 8 → Complete); update ROADMAP.md Progress table

### Phase v0.13-04: Fix Integration Issues
**Goal**: Eliminate the two integration issues (INT-01 binary path inconsistency, INT-02 residual user-gate text) that the audit identified as portability risks and autonomous-execution blockers in the v0.13 workflow files
**Depends on**: Phase v0.13-03
**Requirements**: QUORUM-01, QUORUM-02, QUORUM-03 (integration correctness)
**Gap Closure:** Closes gaps from audit — v0.13-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. All `update-scoreboard.cjs` calls in `plan-milestone-gaps.md`, `execute-phase.md`, and `discuss-phase.md` use `$HOME/.claude/qgsd-bin/update-scoreboard.cjs` — grep for `qgsd/bin/update-scoreboard` returns zero matches across these three files (INT-01)
  2. `plan-milestone-gaps.md` Step 5 presentation block contains an `--auto` bypass guard that skips the "Create these {X} phases? (yes / adjust / defer all optional)" user-dialog line when running in autonomous context (INT-02)
  3. `plan-milestone-gaps.md` priority table nice-to-have row no longer contains the bare "Ask user: include or defer?" text without an `--auto` guard (INT-02)
  4. `plan-milestone-gaps.md` `<success_criteria>` replaces "User confirmed phase plan" with an automation-compatible criterion (INT-02)
  5. Validation commands confirm each fix: per-INT grep check returns expected result
**Plans**: 2 plans

Plans:
- [x] v0.13-04-01-PLAN.md — Verify INT-01: confirm qgsd-bin/update-scoreboard.cjs path is already correct across all three workflow files; document canonical path finding
- [x] v0.13-04-02-PLAN.md — Fix INT-02: remove 3 user-gate text fragments from plan-milestone-gaps.md (nice-row, bare user-dialog line, stale success_criteria); add auto-mode guard to nice section

### Phase v0.13-05: Fix IS_GAP_CLOSURE Pattern
**Goal**: Eliminate the false-positive IS_GAP_CLOSURE detection in transition.md by anchoring the grep to the target phase's heading block, preventing wrong-but-recoverable routing when primary phases have downstream gap-closure dependents
**Depends on**: Phase v0.13-04
**Requirements**: LOOP-01, LOOP-02 (behavioral correctness)
**Gap Closure:** Closes gaps from audit — v0.13-MILESTONE-AUDIT.md (TECH-01)
**Success Criteria** (what must be TRUE):
  1. `transition.md` IS_GAP_CLOSURE grep uses `-A 4 "^### Phase ${COMPLETED_PHASE}:"` instead of `-A 15 "Phase ${COMPLETED_PHASE}"`
  2. `grep -c '\-A 15.*Phase.*COMPLETED_PHASE' transition.md` returns 0 (old pattern gone)
  3. `grep -c 'A 4.*\^###.*Phase.*COMPLETED_PHASE' transition.md` returns 1 (new pattern present)
  4. SUMMARY.md written with status: complete
**Plans**: 1 plan

Plans:
- [ ] v0.13-05-01-PLAN.md — Fix TECH-01: change transition.md IS_GAP_CLOSURE grep from -A 15 to -A 4 anchored to ^### Phase heading block; verify fix with grep checks

### Phase v0.13-06: Deploy IS_GAP_CLOSURE Fix to Installed Copy
**Goal**: Deploy the v0.13-05 IS_GAP_CLOSURE grep fix to the runtime-active installed copy at ~/.claude/qgsd/workflows/transition.md so LOOP-02 is satisfied at runtime (Claude Code reads the installed copy, not qgsd-core/)
**Depends on**: Phase v0.13-05
**Requirements**: LOOP-02
**Gap Closure:** Closes gaps from audit — v0.13-MILESTONE-AUDIT.md (INT-03)
**Success Criteria** (what must be TRUE):
  1. `~/.claude/qgsd/workflows/transition.md` IS_GAP_CLOSURE grep uses `-A 4 "^### Phase ${COMPLETED_PHASE}:"` (not `-A 15`)
  2. `grep -c '\-A 15.*Phase.*COMPLETED_PHASE' ~/.claude/qgsd/workflows/transition.md` returns 0
  3. `grep -c 'A 4.*\^###.*Phase.*COMPLETED_PHASE' ~/.claude/qgsd/workflows/transition.md` returns 1
  4. SUMMARY.md written with status: complete
**Plans**: 1 plan

Plans:
- [x] v0.13-06-01-PLAN.md — Sync qgsd-core/workflows/transition.md to ~/.claude/qgsd/workflows/transition.md via node bin/install.js --claude --global; verify installed copy uses anchored -A 4 pattern (LOOP-02)

### Phase v0.14-01: FV Tool Integration
**Goal**: The formal verification tools that exist on disk but are untracked are committed into source control with test coverage, wired end-to-end so run-formal-verify.cjs calls xstate-to-tla.cjs as its spec generation step, and CI runs the full pipeline on push and PR
**Depends on**: Nothing (first v0.14 phase)
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. User can run `node bin/xstate-to-tla.cjs` from the repo root and it transpiles the XState machine to a TLA+ spec + TLC model config without error
  2. User can run `node bin/run-formal-verify.cjs` and it executes the full formal verification pipeline end-to-end, including calling xstate-to-tla.cjs as its first step
  3. `.github/workflows/formal-verify.yml` is committed and a push to the repo triggers the formal verification CI job
  4. `npm test` includes xstate-to-tla.cjs and run-formal-verify.cjs in its test suite and those tests pass
**Plans**: TBD

### Phase v0.14-02: Drift Detection + TLA+ Canonicalization
**Goal**: Any divergence between the XState machine (source of truth) and the formal specs is caught automatically by npm test, using a proper AST walk rather than regex so structural changes like renamed guards and transitions are detected; critical BROKEN-01 integration gap resolved by adopting Option A (generated model writes QGSDQuorum_xstate.tla, preserving hand-authored QGSDQuorum.tla); CI hardened by removing continue-on-error masking and adding missing path triggers
**Depends on**: Phase v0.14-01
**Requirements**: DRFT-01, DRFT-02, DRFT-03
**Gap Closure**: Closes gaps from v0.14 audit — DRFT-01, DRFT-02, DRFT-03 (requirements), BROKEN-01 (critical integration gap), MISSING-02 (CI path trigger warning)
**Success Criteria** (what must be TRUE):
  1. `npm test` fails when a state name, transition, or guard in the XState machine does not appear in TLA+/Alloy/PRISM specs
  2. `npm test` fails when TLA+ or Alloy specs reference a state or guard name that no longer exists in the XState machine
  3. The drift detector uses the TypeScript compiler API to parse the XState machine — not a regex pattern match against raw source text
  4. `npm test` passes with no drift when the XState machine and all specs are in sync
  5. `node bin/run-formal-verify.cjs` runs without overwriting `formal/tla/QGSDQuorum.tla` — xstate-to-tla.cjs writes to `formal/tla/QGSDQuorum_xstate.tla`
  6. `formal-verify.yml` CI job fails (does not silently continue) when any formal verification step fails
**Plans**:
  - TASK-00: Implement BROKEN-01 Option A — update xstate-to-tla.cjs `--output` default to `formal/tla/QGSDQuorum_xstate.tla`; update run-formal-verify.cjs STEPS[0] to reference `QGSDQuorum_xstate.tla`; update MCQGSDQuorum.cfg SPECIFICATION reference accordingly. Hand-authored `QGSDQuorum.tla` (with `phase`, CONSTANTS Agents/MaxDeliberation, AgentSymmetry, MinQuorumMet) remains canonical.
  - TASK-01: Wire `check-spec-sync.cjs` into `npm test` — add as a step in package.json test script or as a test file loaded by the test runner (DRFT-01)
  - TASK-02: Replace regex-based XState state extraction in check-spec-sync.cjs (lines 39-48) with TypeScript compiler API / AST walk — catches transition and guard names, not just state list (DRFT-02)
  - TASK-03: Add orphaned spec detection to check-spec-sync.cjs — flag TLA+/Alloy/PRISM states or guards that have no corresponding XState state (DRFT-03)
  - TASK-04: Add `bin/xstate-to-tla.cjs`, `bin/run-formal-verify.cjs`, `bin/run-oauth-rotation-prism.cjs`, `bin/run-account-pool-alloy.cjs`, `bin/run-account-manager-tlc.cjs` to `paths:` block in `.github/workflows/formal-verify.yml` (MISSING-02)
  - TASK-05: Remove `continue-on-error: true` from all steps in `.github/workflows/formal-verify.yml` so formal verification failures halt the CI pipeline rather than being silently masked

### Phase v0.14-03: Parallelization
**Goal**: run-formal-verify.cjs executes the 20-step verification pipeline in parallel tool groups rather than sequentially, cutting wall-clock runtime from ~10 minutes to ~2 minutes
**Depends on**: Phase v0.14-01
**Requirements**: PERF-01, PERF-02
**Gap Closure**: Closes gaps from v0.14 audit — PERF-01, PERF-02 (requirements)
**Success Criteria** (what must be TRUE):
  1. TLA+ model checking, Alloy analysis, and PRISM verification run concurrently (observable via process timing — they start within seconds of each other, not sequentially)
  2. Total wall-clock time for `node bin/run-formal-verify.cjs` on a standard machine completes in approximately 2 minutes or less (down from approximately 10 minutes)
  3. All verification results are still correct after parallelization — no tool group skipped or silently failed
**Plans**: 2 plans
Plans:
- [ ] v0.14-03-01-PLAN.md — Refactor sequential for..of loop to grouped Promise.all parallel execution (generate first, then tla/alloy/prism/petri concurrently)
- [ ] v0.14-03-02-PLAN.md — Add wall-clock timing instrumentation + timing assertion test + integration smoke test for step completeness

### Phase v0.14-04: PRISM Config Injection
**Goal**: The PRISM probabilistic model receives empirically-grounded TP/TN rates from the quorum scoreboard automatically at run time, eliminating the manual step of editing .pm files between quorum runs
**Depends on**: Phase v0.14-01
**Requirements**: PRISM-01, PRISM-02
**Gap Closure**: Closes gaps from v0.14 audit — PRISM-01, PRISM-02 (requirements)
**Success Criteria** (what must be TRUE):
  1. Running `node bin/run-formal-verify.cjs` reads TP/TN rates from the quorum scoreboard and passes them to the PRISM model as parameters — no manual editing of any .pm file is required
  2. After a quorum round updates the scoreboard, the next run of run-formal-verify.cjs automatically uses the updated rates without any user intervention
**Plans**: 2 plans
Plans:
- [ ] v0.14-04-01-PLAN.md — Add readScoreboardRates() to run-prism.cjs and inject -const tp_rate/unavail at invocation time
- [ ] v0.14-04-02-PLAN.md — Integration tests: fixture scoreboard, assert -const params, caller-override wins

### Phase v0.14-05: Watch Mode
**Goal**: Developers iterating on the XState machine get continuous feedback — run-formal-verify.cjs re-runs verification automatically whenever the machine file changes, without manual re-invocation
**Depends on**: Phase v0.14-01
**Requirements**: DX-01
**Gap Closure**: Closes gaps from v0.14 audit — DX-01 (requirement)
**Success Criteria** (what must be TRUE):
  1. `node bin/run-formal-verify.cjs --watch` starts and does not exit — it watches the XState machine file for changes
  2. When the XState machine file is saved, verification re-runs automatically within a few seconds and prints updated results
  3. Watch mode terminates cleanly on Ctrl+C without hanging processes
**Plans**: 2 plans

Plans:
- [ ] v0.14-05-01-PLAN.md — Wave 0 test scaffolding: add 3 placeholder watch-mode tests to run-formal-verify.test.cjs that fail until --watch is implemented (DX-01)
- [ ] v0.14-05-02-PLAN.md — Implementation: extract runOnce() from IIFE, add --watch branch with fs.watch(machineDir) + 300ms debounce + SIGINT handler; replace placeholder tests with 3 real spawn+SIGINT integration tests (DX-01)


### Phase v0.15-01: Health Checker Regex Fix
**Goal**: gsd-tools.cjs W005, W007, and W002 checks produce zero false positives for QGSD versioned phase dirs — any `v0.X-YY-name` directory or `### Phase v0.X-YY:` ROADMAP header is recognized as valid
**Depends on**: Nothing (first v0.15 phase)
**Requirements**: HLTH-01, HLTH-02, HLTH-03
**Success Criteria** (what must be TRUE):
  1. Running `node bin/gsd-tools.cjs validate health` on the QGSD repo produces zero W005 warnings for any `v0.X-YY-name` directory under `.planning/phases/`
  2. W007 ROADMAP extractor matches `### Phase v0.X-YY:` headers — no versioned phase appears as "on disk but not in ROADMAP"
  3. W002 STATE.md extractor correctly parses `Phase v0.X-YY` references — current position reported without "invalid phase" warnings
  4. All three regex fixes are covered by tests or verifiable by a before/after run of `validate health` on the QGSD repo itself
**Plans**: 1 plan

Plans:
- [ ] v0.15-01-01-PLAN.md — Fix W005/W007/W002 regex in gsd-tools.cjs + test scaffolding + install sync (HLTH-01, HLTH-02, HLTH-03)

### Phase v0.15-02: Repair Safety Guard
**Goal**: The `--repair` flag cannot silently overwrite a rich STATE.md — the user sees a content-length warning and must pass `--force` explicitly before regenerateState runs
**Depends on**: Phase v0.15-01
**Requirements**: SAFE-01
**Success Criteria** (what must be TRUE):
  1. Running `node bin/gsd-tools.cjs validate health --repair` on a STATE.md with more than 50 lines prints a warning showing the current line count and exits without overwriting
  2. Running `node bin/gsd-tools.cjs validate health --repair --force` on the same STATE.md proceeds with regenerateState and overwrites the file
  3. A STATE.md with 50 lines or fewer is overwritten normally by `--repair` without requiring `--force`
**Plans**: 1 plan
Plans:
- [ ] v0.15-02-01-PLAN.md — Content-length safety gate for --repair regenerateState + --force flag + install sync (SAFE-01)

### Phase v0.15-03: Legacy Dir Archive
**Goal**: The pre-versioning legacy numeric phase dirs (18 through 39) are moved to `.planning/archive/legacy/` so W007 stops reporting them as orphaned phases not referenced in the ROADMAP
**Depends on**: Nothing (independent — can run parallel to v0.15-02)
**Requirements**: SAFE-02
**Success Criteria** (what must be TRUE):
  1. All directories `.planning/phases/18` through `.planning/phases/39` (or their equivalents) are moved to `.planning/archive/legacy/` and no longer appear under `.planning/phases/`
  2. Running `node bin/gsd-tools.cjs validate health` produces zero W007 warnings for the archived legacy dirs
  3. The `.planning/archive/legacy/` directory exists and contains the moved dirs
**Plans**: 1 plan
Plans:
- [ ] v0.15-03-01-PLAN.md — SAFE-02 test scaffold + archive 22 legacy dirs to .planning/archive/legacy/ + full suite green

### Phase v0.15-04: Health Quorum Failure Visibility
**Goal**: When `.planning/quorum-failures.json` exists and any slot has 3 or more failures logged, the `/qgsd:health` workflow output surfaces those patterns as named health warnings alongside standard W/E/I items
**Depends on**: Phase v0.15-01
**Requirements**: VIS-01
**Success Criteria** (what must be TRUE):
  1. Running `/qgsd:health` when `.planning/quorum-failures.json` contains a slot with count >= 3 prints a health warning identifying the slot name and failure count
  2. Running `/qgsd:health` when `.planning/quorum-failures.json` does not exist or all slot counts are < 3 produces no quorum-failure warning
  3. The quorum-failure warnings appear in the same output section as other W/E/I health items — not as a separate unrelated block
**Plans**: 1 plan
Plans:
- [ ] v0.15-04-01-PLAN.md — VIS-01 test scaffold + Check 9 W008 implementation + install sync (VIS-01)

### Phase v0.18-01: Token Observability Foundation
**Goal**: Users can see per-slot token consumption ranked by usage in /qgsd:health, and every quorum slot-worker run appends a structured token record to .planning/token-usage.jsonl
**Depends on**: Nothing (first v0.18 phase; architecturally independent)
**Requirements**: OBSV-01, OBSV-02, OBSV-03, OBSV-04
**Success Criteria** (what must be TRUE):
  1. Running /qgsd:health after any quorum round shows a token consumption section listing each active slot with input/output token counts ranked by total usage
  2. After a quorum round completes, .planning/token-usage.jsonl contains a new line with slot, stage, input_tokens, output_tokens, and session_id fields
  3. Token records for MCP-based slots (claude-1..claude-6) contain non-null token counts correctly attributed to the slot name that dispatched them
  4. Token records for CLI-based slots (gemini-1, codex-1) are present in the log with tokens: null — the slot is logged, not omitted
  5. The SubagentStop hook is registered in ~/.claude/settings.json after node bin/install.js --claude --global runs
**Plans**: 2 plans

Plans:
- [ ] v0.18-01-01-PLAN.md — Token collection hooks (SubagentStop + SubagentStart) + test scaffolds + call-quorum-slot.cjs sentinel (OBSV-02, OBSV-03, OBSV-04)
- [ ] v0.18-01-02-PLAN.md — install.js hook registration + health.md token display + install sync (OBSV-01)

### Phase v0.18-02: Tiered Model Sizing
**Goal**: Researcher and plan-checker sub-agents in plan-phase.md run on haiku by default, reducing per-plan-phase cost 15-20x for those two spawn sites, with user override via flat config keys
**Depends on**: Phase v0.18-01
**Requirements**: TIER-01, TIER-02, TIER-03
**Success Criteria** (what must be TRUE):
  1. A plan-phase session with default config dispatches the researcher Task with model="haiku" visible in the Task call
  2. A plan-phase session with default config dispatches the plan-checker Task with model="haiku" visible in the Task call
  3. Setting model_tier_planner: "sonnet" in qgsd.json causes the planner (not researcher/checker) to use sonnet — no regression on planner model selection
  4. Setting model_tier_worker: "sonnet" in qgsd.json causes researcher and checker Tasks to use sonnet instead of haiku
  5. Running node bin/install.js --claude --global after the config-loader.js change deploys the updated config-loader to ~/.claude/hooks/config-loader.js
**Plans**: 3 plans

Plans:
- [x] v0.18-02-01-PLAN.md — Tier key defaults and validation in config-loader.js (TDD: TIER-03)
- [x] v0.18-02-02-PLAN.md — resolveModelInternal tier lookup in gsd-tools.cjs + unit tests (TIER-01, TIER-02)
- [ ] v0.18-02-03-PLAN.md — dist sync, install deploy, full npm test suite (TIER-01, TIER-02, TIER-03)

### Phase v0.18-03: Task Envelope
**Goal**: After research completes and after planning completes, a task-envelope.json sidecar is written to .planning/phases/<phase>/ containing structured context; quorum.md reads risk_level from it with fail-open behavior; feature is config-gated
**Depends on**: Phase v0.18-02
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. After plan-phase research step completes, .planning/phases/<phase>/task-envelope.json exists with objective, constraints, risk_level, and target_files fields populated
  2. After plan-phase planning step completes, the same envelope file contains plan_path and key_decisions fields (updated, not replaced)
  3. When task-envelope.json exists and contains a valid risk_level, quorum.md pre-flight log shows the envelope-derived risk level
  4. When task-envelope.json is absent or malformed, quorum proceeds without error using static max_quorum_size — fail-open behavior verified
  5. Setting task_envelope.enabled: false in qgsd.json disables envelope writes; quorum proceeds without envelope as if it were absent
**Plans**: TBD

### Phase v0.18-04: Adaptive Fan-Out
**Goal**: Quorum dispatches 2/3/max workers for routine/medium/high risk_level tasks, emits --n N for Stop hook R3.5 compliance, logs a reduced-quorum note when below maxSize, and respects --n N user override as highest priority
**Depends on**: Phase v0.18-03
**Requirements**: FAN-01, FAN-02, FAN-03, FAN-04, FAN-05, FAN-06
**Success Criteria** (what must be TRUE):
  1. A quorum round with risk_level: "routine" from the envelope dispatches exactly 2 slot-worker Tasks (not max_quorum_size)
  2. A quorum round with risk_level: "medium" from the envelope dispatches exactly 3 slot-worker Tasks
  3. A quorum round with risk_level: "high" (or no envelope) dispatches max_quorum_size workers — unchanged baseline behavior
  4. The quorum prompt text injected by qgsd-prompt.js contains --n N matching the actual worker count dispatched, so qgsd-stop.js passes the ceiling check correctly
  5. When fan-out is below max_quorum_size, the quorum output contains an R6.4 reduced-quorum note identifying how many workers were used vs. max
  6. Passing --n 5 explicitly overrides envelope-driven fan-out — 5 workers are dispatched regardless of risk_level
**Plans**: TBD

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
| v0.9-01. Context Window Monitor | v0.9 | 1/1 | Complete   | 2026-02-26 |
| v0.9-02. Nyquist Validation Layer | v0.9 | 2/2 | Complete | 2026-02-24 |
| v0.9-03. Discuss-Phase UX | v0.9 | 1/1 | Complete | 2026-02-24 |
| v0.9-04. Tier 3 Fixes | v0.9 | Complete    | 2026-02-26 | - |
| v0.9-05. Rename get-shit-done/ → qgsd-core/ | v0.9 | Complete    | 2026-02-25 | - |
| v0.9-06. v0.9-03 Retroactive Verification | v0.9 | Complete    | 2026-02-26 | - |
| v0.9-07. Nyquist Parse-List Correction + Path Portability | 1/1 | Complete    | 2026-02-26 | - |
| v0.9-08. Post-v0.9 Install Sync | v0.9 | 0/1 | Not started | - |
| v0.9-09. SC-4 End-to-End Nyquist Demo | v0.9 | 0/1 | Not started | - |
| v0.10-01. Foundation | v0.10 | Complete    | 2026-02-24 | 2026-02-24 |
| v0.10-02. Presets and Cloning | v0.10 | Complete    | 2026-02-24 | - |
| v0.10-03. Credential Management | v0.10 | Complete    | 2026-02-24 | - |
| v0.10-04. Live Health Dashboard | v0.10 | Complete    | 2026-02-24 | 2026-02-24 |
| v0.10-05. Policy UIs | 3/3 | Complete    | 2026-02-24 | - |
| v0.10-06. Import/Export | v0.10 | 3/3 | Complete | 2026-02-25 |
| v0.10-07. Retroactive Verification Closure | v0.10 | 3/3 | Complete | 2026-02-25 |
| v0.10-08. PLCY-03 Auto-Update Bug Fix | 2/2 | Complete    | 2026-02-25 | - |
| v0.11-01. Parallel Quorum Wave-Barrier | v0.11 | 3/3 | Complete | 2026-02-24 |
| v0.12-01. Conformance Event Infrastructure | v0.12 | 3/3 | Complete | 2026-02-25 |
| v0.12-02. TLA+ Formal Spec | v0.12 | 3/3 | Complete | 2026-02-25 |
| v0.12-03. Static Analysis Suite | v0.12 | 4/4 | Complete | 2026-02-25 |
| v0.12-04. Circuit Breaker Algorithm Verification | 3/3 | Complete   | 2026-02-25 | - |
| v0.12-05. Protocol Termination Proofs | v0.12 | 3/3 | Complete | 2026-02-25 |
| v0.12-06. Audit Trail Invariants | v0.12 | 3/3 | Complete | 2026-02-25 |
| v0.12-07. Hook Transcript Verification | v0.12 | 3/3 | Complete | 2026-02-25 |
| v0.12-08. Installer and Taxonomy Extensions | v0.12 | 3/3 | Complete | 2026-02-25 |
| v0.12-09. Verification Infrastructure Quick Fixes | 5/5 | Complete    | 2026-02-25 | - |
| v0.12-10. Conformance Score Redesign | v0.12 | 0/3 | Not started | - |
| v0.13-01. Loop Wiring | v0.13 | 1/1 | Complete   | 2026-02-25 |
| v0.13-02. Quorum Gates | v0.13 | 3/3 | Complete | 2026-02-25 |
| v0.13-03. Write Verification Bookkeeping | v0.13 | 2/2 | Complete | 2026-02-25 |
| v0.13-04. Fix Integration Issues | v0.13 | Complete    | 2026-02-25 | 2026-02-25 |
| v0.13-05. Fix IS_GAP_CLOSURE Pattern | 1/1 | Complete    | 2026-02-25 | - |
| v0.13-06. Deploy IS_GAP_CLOSURE Fix to Installed Copy | v0.13 | Complete    | 2026-02-25 | - |
| v0.14-01. FV Tool Integration | 3/3 | Complete    | 2026-02-26 | - |
| v0.14-02. Drift Detection + TLA+ Canonicalization | 2/2 | Complete    | 2026-02-26 | - |
| v0.14-03. Parallelization | v0.14 | 0/3 | Not started | - |
| v0.14-04. PRISM Config Injection | 2/2 | Complete    | 2026-02-26 | - |
| v0.14-05. Watch Mode | v0.14 | Complete    | 2026-02-26 | - |
| v0.15-01. Health Checker Regex Fix | 1/1 | Complete    | 2026-02-27 | - |
| v0.15-02. Repair Safety Guard | 1/1 | Complete   | 2026-02-27 | - |
| v0.15-03. Legacy Dir Archive | v0.15 | 0/TBD | Not started | - |
| v0.15-04. Health Quorum Failure Visibility | v0.15 | 0/TBD | Not started | - |
| v0.18-01. Token Observability Foundation | v0.18 | 0/TBD | Not started | - |
| v0.18-02. Tiered Model Sizing | 3/3 | Complete   | 2026-02-27 | 2026-02-27 |
| v0.18-03. Task Envelope | v0.18 | 0/TBD | Not started | - |
| v0.18-04. Adaptive Fan-Out | v0.18 | 0/TBD | Not started | - |
