# Roadmap: QGSD

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1–17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18–22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23–31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32–38 (shipped 2026-02-23)
- ✅ **v0.6 — Agent Slots & Quorum Composition** — Phase 39 (shipped 2026-02-23)
- ✅ **v0.7 — Composition Config & Multi-Slot** — Phases v0.7-01..v0.7-04 (shipped 2026-02-23)
- ✅ **v0.8 — fix-tests ddmin Pipeline** — Phase v0.8-01 (shipped 2026-02-23)
- 🚧 **v0.9 — GSD Sync** — Phases v0.9-01..v0.9-05 (in progress)
- 🚧 **v0.10 — Roster Toolkit** — Phases v0.10-01..v0.10-06 (in progress)
- ✅ **v0.11 — Parallel Quorum** — Phase v0.11-01 (shipped 2026-02-24)
- 🚧 **v0.12 — Formal Verification** — Phases v0.12-01..v0.12-03 (in progress)

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
- [x] **Phase v0.9-02: Nyquist Validation Layer** — VALIDATION.md template + plan-phase step 5.5 insertion + gsd-tools init field (2 plans) (completed 2026-02-24)
- [x] **Phase v0.9-03: Discuss-Phase UX** — Recommended option highlighting per choice + gray-area loop-back instead of hard stop (completed 2026-02-24)
- [ ] **Phase v0.9-04: Tier 3 Fixes** — Skill tool spawn guards, Gemini TOML fix, decimal phase number parsing consistency
- [ ] **Phase v0.9-05: Rename get-shit-done/ → qgsd-core/** — Rename the source directory to match QGSD identity; update all path references in installer, gsd-tools, and workflows; re-sync installed runtime

### 🚧 v0.10 — Roster Toolkit (In Progress)

**Milestone Goal:** Extend `bin/manage-agents.cjs` into a full-featured agent roster management UI — provider presets, slot cloning, live health dashboard, key lifecycle management, scoreboard visibility, CCR routing, per-agent tuning, import/export, and auto-update policy.

- [ ] **Phase v0.10-01: Foundation** — Read-only display columns (quorum W/L, CCR routing, key-invalid badge) + readQgsdJson/writeQgsdJson helper pair infrastructure
- [ ] **Phase v0.10-02: Presets and Cloning** — Provider preset library wired into addAgent/editAgent + slot cloning flow
- [ ] **Phase v0.10-03: Credential Management** — Key expiry detection with classifyProbeResult() + batch key rotation with sequential-only write loop
- [ ] **Phase v0.10-04: Live Health Dashboard** — Full-screen auto-refreshing status view with readline mode-switch architecture and keypress exit
- [ ] **Phase v0.10-05: Policy UIs** — Per-slot quorum timeout tuning + auto-update policy configuration + startup auto-update check
- [ ] **Phase v0.10-06: Import/Export** — Portable roster export with unconditional API key redaction + schema-validated import with pre-import backup

<details>
<summary>✅ v0.11 — Parallel Quorum (Phase v0.11-01) — SHIPPED 2026-02-24</summary>

- [x] **Phase v0.11-01: Parallel Quorum Wave-Barrier** — `qgsd-quorum-worker.md` + `qgsd-quorum-synthesizer.md` agents; atomic rename at all scoreboard write sites; `merge-wave` subcommand; orchestrator rewritten with wave-barrier pattern (PAR-01..PAR-05) (completed 2026-02-24)

**Archive:** `.planning/milestones/v0.11-ROADMAP.md`
</details>

### 🚧 v0.12 — Formal Verification (In Progress)

**Milestone Goal:** Implement formal verification tooling for QGSD's agent state machine — conformance event logger shipped as a bin/ script, TLA+ specification with TLC model checking, XState executable TypeScript machine, and Alloy/PRISM/Petri models for vote-counting and probabilistic analysis.

- [ ] **Phase v0.12-01: Conformance Event Infrastructure** — Shared schema module, appendConformanceEvent() helper in hooks, hook instrumentation across all three hooks, XState machine compiled to CJS, and validate-traces.cjs user CLI (LOG-01..03, XST-01..03, VAL-01..03)
- [ ] **Phase v0.12-02: TLA+ Formal Spec** — QGSDQuorum.tla spec with named invariants, safety and liveness TLC configs, and bin/run-tlc.cjs runner (TLA-01..04)
- [ ] **Phase v0.12-03: Static Analysis Suite** — Alloy vote-counting model + runner, PRISM probabilistic DTMC + scoreboard rate exporter, Petri Net generator with WASM SVG rendering and structural deadlock detection (ALY-01..02, PRM-01..03, PET-01..03)

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
**Plans**: TBD

Plans:
- [ ] v0.9-04-01: Add Skill tool guards to `plan-phase.md` and `discuss-phase.md`; audit and fix Gemini TOML templates; fix decimal phase parsing in `gsd-tools.cjs`

### Phase v0.9-05: Rename get-shit-done/ → qgsd-core/
**Goal**: The QGSD source directory is named `qgsd-core/` (not `get-shit-done/`), all references updated, and the installed runtime continues working correctly
**Depends on**: Phase v0.9-04
**Requirements**: REN-01, REN-02, REN-03, REN-04
**Success Criteria** (what must be TRUE):
  1. `get-shit-done/` directory does not exist; `qgsd-core/` exists in its place with all the same files
  2. `bin/install.js` copies from `qgsd-core/` (not `get-shit-done/`) — running `node bin/install.js --claude --global` succeeds
  3. All hardcoded `get-shit-done/` path strings removed from `bin/gsd-tools.cjs`, workflows, agents, and templates
  4. `~/.claude/qgsd/` runtime is identical before and after rename+install (verified by diff)
**Plans**: TBD

Plans:
- [ ] v0.9-05-01: `git mv get-shit-done/ qgsd-core/`, update all path references in `bin/install.js`, `bin/gsd-tools.cjs`, workflow @-references, and agents; run `node bin/install.js --claude --global`

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
- [ ] v0.10-01-02-PLAN.md — Integrate helpers into listAgents() to render W/L, CCR, and key-invalid columns; manual visual verification (DISP-01, DISP-02, DISP-03)

### Phase v0.10-02: Presets and Cloning
**Goal**: Users can select a provider by name instead of typing a URL, and can duplicate any existing slot in one flow
**Depends on**: Phase v0.10-01
**Requirements**: PRST-01, PRST-02
**Success Criteria** (what must be TRUE):
  1. When adding or editing an agent, the base URL step presents a named provider list (AkashML, Together.xyz, Fireworks.ai) plus a Custom escape hatch via an inquirer `list` prompt replacing the previous free-text `input` prompt; selecting a preset auto-fills the base URL without manual typing; inquirer@8.2.7 CJS is used — the package is not upgraded
  2. Selecting a provider preset triggers a pre-flight provider probe before the slot is written; if the probe fails the user sees an error and is offered a retry or cancel — no partial slot is written on probe failure
  3. A "Clone slot" option appears in the main menu; selecting it presents the existing slot list, copies the chosen slot's provider URL and model config to a new slot name the user provides, and validates that the new slot name is unique before writing
  4. After cloning, the user is prompted to set an API key for the new slot; skipping is allowed but the slot is shown with `[no key]`; the original slot's key is never copied to the clone (keytar isolation)
**Plans**: TBD

### Phase v0.10-03: Credential Management
**Goal**: Users can rotate API keys across multiple slots in one flow, and key validity status persists across sessions without requiring a re-probe on restart
**Depends on**: Phase v0.10-02
**Requirements**: CRED-01, CRED-02
**Success Criteria** (what must be TRUE):
  1. A "Batch rotate keys" option appears in the main menu; the user selects multiple slots via a checkbox picker, then enters a new key for each selected slot one at a time; the rotation loop uses a sequential `for...of` — never `Promise.all` — to avoid keychain concurrency errors and key-index read-modify-write race conditions
  2. After each individual slot's key is updated within the batch flow, a per-slot confirmation line is displayed (e.g., `claude-1: key updated`) before the next slot's prompt appears; a single `syncToClaudeJson()` call is made after all slots are processed
  3. After a health probe returns a 401 for any slot, `key_status` for that slot is written to `qgsd.json` as `{ "status": "invalid", "checkedAt": "<ISO timestamp>" }`; this value persists to disk so the `[key invalid]` badge survives a process restart without requiring a new probe
  4. After a subsequent successful health probe for the same slot, `key_status` is updated to `{ "status": "ok", "checkedAt": "<ISO timestamp>" }`, causing the badge to clear on the next `listAgents()` call
**Plans**: TBD

### Phase v0.10-04: Live Health Dashboard
**Goal**: Users can open a live health view from the main menu that refreshes on keypress and exits cleanly back to the menu with no stdin side effects
**Depends on**: Phase v0.10-03
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. Selecting "Live health dashboard" from the main menu enters a full-screen health view showing each slot's provider, model, and health status; the view uses a readline mode-switch architecture (inquirer is fully exited before the raw stdin loop starts) — no setInterval timer runs while inquirer holds the TTY
  2. Pressing space or `r` triggers an immediate refresh of all slots' health status; a "Last updated: HH:MM:SS" timestamp is shown at the bottom of the screen after every refresh; if the displayed data becomes more than 60 seconds old without a refresh, a yellow "stale" warning appears next to the timestamp
  3. Pressing `q` or Escape exits the dashboard and returns to the main menu with stdin fully restored — `setRawMode(false)` and `removeAllListeners('keypress')` are called before `mainMenu()` is re-entered, and no characters typed after exit are swallowed by a stale raw-mode listener
  4. When the dashboard is invoked in a non-TTY context (piped output, CI), it falls back to a single static one-time health print and returns immediately rather than entering raw mode; the TTY guard checks `process.stdout.isTTY` before entering dashboard mode
**Plans**: TBD

### Phase v0.10-05: Policy UIs
**Goal**: Users can configure quorum timeout and update policy per slot from the main menu, and slots set to auto are checked for updates on startup
**Depends on**: Phase v0.10-04
**Requirements**: PLCY-01, PLCY-02, PLCY-03
**Success Criteria** (what must be TRUE):
  1. A "Tune timeouts" option is accessible directly from the main menu (not nested inside editAgent); selecting it shows each slot with its current timeout value and allows entry of a new value; after saving, a "restart required" note is shown — a timeout change without this note is a defect
  2. A "Set update policy" option is accessible from the main menu; the user can set each slot's policy to `auto`, `prompt`, or `skip`; the selected value is persisted under `agent_config[slot].update_policy` in `qgsd.json` via `writeQgsdJson()`
  3. When `manage-agents.cjs` starts and at least one slot has `update_policy: "auto"`, those slots are checked for available updates before the main menu is shown; the check outcome is written to `~/.claude/qgsd-update.log` with a timestamped entry per slot
  4. If `~/.claude/qgsd-update.log` contains recent ERROR entries, a warning banner is displayed at the top of the `listAgents()` output on the next run — users are not silently failing on auto-update errors
**Plans**: TBD

### Phase v0.10-06: Import/Export
**Goal**: Users can save the full roster to a portable JSON file and restore it on any machine, with API keys unconditionally stripped on export and a timestamped backup created before any import applies
**Depends on**: Phase v0.10-05
**Requirements**: PORT-01, PORT-02, PORT-03
**Success Criteria** (what must be TRUE):
  1. An "Export roster" option in the main menu writes a portable JSON file; every env value matching `/_KEY$|_SECRET$|_TOKEN$|_PASSWORD$/i` is replaced with `__redacted__` unconditionally — the export path never calls `syncToClaudeJson()` before reading, so keytar fallback plaintext values cannot leak into the export file
  2. An "Import roster" option reads a JSON file, validates the schema before writing anything (all `command` fields must be `node` or `npx`; no `args` entries may contain absolute user home paths like `/Users/` or `/home/`), and reports all validation errors up front — zero partial applies occur when validation fails
  3. Any `__redacted__` key value in an imported file triggers a per-slot prompt asking the user to enter the real key; the user can skip individual slots, which are then imported with no key configured and shown as `[no key]` in the list view
  4. Before any import changes are written, a timestamped backup of `~/.claude.json` is created at `~/.claude.json.pre-import.<ISO-timestamp>` and the backup path is displayed to the user; if the backup write fails, the import is aborted entirely
**Plans**: TBD

### Phase v0.12-01: Conformance Event Infrastructure
**Goal**: Hooks emit structured conformance events to a shared NDJSON log, the XState machine is compiled and available for replay, and developers and users can run validate-traces.cjs to check execution conformance
**Depends on**: Nothing (first v0.12 phase)
**Requirements**: LOG-01, LOG-02, LOG-03, XST-01, XST-02, XST-03, VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):
  1. Developer can `require('./bin/conformance-schema.cjs')` and get `VALID_ACTIONS`, `VALID_PHASES`, `VALID_OUTCOMES`, and `schema_version` — both hooks and validate-traces.cjs import from this single module with no independent field lists
  2. After a quorum decision turn, `.planning/conformance-events.jsonl` contains a new NDJSON line with `{ ts, phase, action, slots_available, vote_result, outcome }` — confirmed by reading the file; the hook critical path shows no timing regression and no stdout output added
  3. Developer can find `src/machines/qgsd-workflow.machine.ts` with 4 states (`IDLE`, `COLLECTING_VOTES`, `DELIBERATING`, `DECIDED`) and 3 guards (`minQuorumMet`, `noInfiniteDeliberation`, `phaseMonotonicallyAdvances`); `tsup` build compiles it to CJS without touching any hook file
  4. User can run `node ~/.claude/qgsd-bin/validate-traces.cjs` and see a deviation score (% of valid XState executions) plus any flagged divergences — exit code 0 on clean log, non-zero on violations
**Plans**: TBD

### Phase v0.12-02: TLA+ Formal Spec
**Goal**: A TLA+ specification of QGSD's quorum workflow exists with named safety and liveness invariants, two TLC model configurations are verified, and developers can invoke TLC via a bin/ script
**Depends on**: Phase v0.12-01
**Requirements**: TLA-01, TLA-02, TLA-03, TLA-04
**Success Criteria** (what must be TRUE):
  1. Developer can find `formal/tla/QGSDQuorum.tla` with named invariants `MinQuorumMet`, `NoInvalidTransition`, and `EventualConsensus` — state names mirror the XState machine from v0.12-01
  2. Running TLC with `formal/tla/MCsafety.cfg` (symmetry sets, N=5) completes with no violations; running TLC with `formal/tla/MCliveness.cfg` (no symmetry, N=3) completes with no liveness violations
  3. Developer can run `node bin/run-tlc.cjs` — the script checks for Java ≥17, invokes the TLC JAR, and exits with a clear error message if `JAVA_HOME` is unset; `npm test` passes without Java installed
**Plans**: TBD

### Phase v0.12-03: Static Analysis Suite
**Goal**: Alloy vote-counting model, PRISM probabilistic DTMC, and Petri Net token model are all authored and runnable; Java ≥17 is documented once as the shared prerequisite for all three JVM tools
**Depends on**: Phase v0.12-01
**Requirements**: ALY-01, ALY-02, PRM-01, PRM-02, PRM-03, PET-01, PET-02, PET-03
**Success Criteria** (what must be TRUE):
  1. Developer can find `formal/alloy/quorum-votes.als` with `pred`-based vote-counting predicates (not `fact`) and a `check` assertion for `NoSpuriousApproval`; running `bin/run-alloy.cjs` invokes Alloy 6 JAR headless and is gated on `JAVA_HOME`
  2. Developer can find `formal/prism/quorum.pm` — a DTMC model of quorum convergence; running `bin/export-prism-constants.cjs` reads scoreboard TP/TN/UNAVAIL data and writes a `.const` file; the script warns and uses conservative priors when any slot has fewer than 30 rounds
  3. Developer can run `bin/generate-petri-net.cjs` to get a DOT-format Petri Net rendered to SVG via `@hpcc-js/wasm-graphviz` with no system Graphviz install; the script prints a structural deadlock warning if `min_quorum_size > available_slots`
  4. `VERIFICATION_TOOLS.md` documents Java 17 as the single installation prerequisite for TLA+, Alloy, and PRISM; all three JVM invocations are gated on `JAVA_HOME`/`PRISM_BIN`; `npm test` passes on a machine without Java
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
| v0.9-01. Context Window Monitor | v0.9 | 1/1 | Complete | 2026-02-24 |
| v0.9-02. Nyquist Validation Layer | v0.9 | 2/2 | Complete | 2026-02-24 |
| v0.9-03. Discuss-Phase UX | v0.9 | 1/1 | Complete | 2026-02-24 |
| v0.9-04. Tier 3 Fixes | v0.9 | 0/1 | Not started | - |
| v0.9-05. Rename get-shit-done/ → qgsd-core/ | v0.9 | 0/1 | Not started | - |
| v0.10-01. Foundation | v0.10 | 1/2 | In Progress|  |
| v0.10-02. Presets and Cloning | v0.10 | 0/? | Not started | - |
| v0.10-03. Credential Management | v0.10 | 0/? | Not started | - |
| v0.10-04. Live Health Dashboard | v0.10 | 0/? | Not started | - |
| v0.10-05. Policy UIs | v0.10 | 0/? | Not started | - |
| v0.10-06. Import/Export | v0.10 | 0/? | Not started | - |
| v0.11-01. Parallel Quorum Wave-Barrier | v0.11 | 3/3 | Complete | 2026-02-24 |
| v0.12-01. Conformance Event Infrastructure | v0.12 | 0/? | Not started | - |
| v0.12-02. TLA+ Formal Spec | v0.12 | 0/? | Not started | - |
| v0.12-03. Static Analysis Suite | v0.12 | 0/? | Not started | - |
