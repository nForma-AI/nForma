# QGSD

## What This Is

QGSD is a Claude Code plugin extension that moves multi-model quorum enforcement from CLAUDE.md behavioral policy into structural Claude Code hooks. It installs on top of GSD without modifying it, adding a hook-based quorum layer: a UserPromptSubmit hook injects quorum instructions at the right moment, a Stop hook verifies quorum actually happened by parsing the conversation transcript before allowing Claude to deliver planning output, and a PreToolUse circuit breaker hook detects oscillation in git history and blocks Bash execution when repetitive patterns emerge. When the circuit breaker fires, a structured oscillation resolution mode guides quorum diagnosis and unified solution approval. An activity sidecar tracks every workflow stage transition so `resume-work` can recover to the exact interrupted step.

## Core Value

Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## Current Milestone: v0.13 Autonomous Milestone Execution

**Goal:** Remove all human checkpoints from the milestone execution loop and replace every uncertainty point with quorum consensus, enabling fully autonomous end-to-end milestone completion from new-milestone through complete-milestone with zero AskUserQuestion calls.

**Target features:**
- Loop wiring — transition.md calls audit-milestone before complete-milestone; Gap Closure marker triggers re-audit instead of completion
- Audit auto-advance — audit-milestone spawns plan-milestone-gaps automatically when gaps_found
- Quorum-gated gap phases — plan-milestone-gaps replaces AskUserQuestion confirmation with R3 quorum + auto-spawns plan-phase
- Quorum gap resolution — execute-phase gaps_found routes to quorum diagnosis and auto-resolution instead of halting the chain
- Quorum discuss-phase — discuss-phase remaining user_questions (after R4 pre-filter) routed to quorum in auto mode
- Audit state tracking — audit-milestone updates STATE.md with audit result

## Previous Milestone: v0.12 Formal Verification

**Goal:** Implement formal verification tooling for QGSD's agent state machine — conformance event logger shipped as a bin/ script, TLA+ specification with TLC model checking, XState executable TypeScript machine, and Alloy/PRISM/Petri models for vote-counting and probabilistic analysis.

**Target features:**
- Conformance event logger — hooks emit structured JSON events (phase, action, slots_available, vote_result, outcome); shipped as `bin/validate-traces.cjs` for users
- TLA+ spec — formal specification of QGSD phases and transitions with invariants (min_quorum_met, no_infinite_deliberation, phase_monotonically_advances); TLC-verified
- XState machine — executable TypeScript state machine for QGSD 4-phase workflow with quorum guards; eliminates spec-to-code drift
- Alloy model — vote-counting predicate logic (given N agents, M UNAVAIL, is this quorum count valid for a transition?); Alloy Analyzer counterexample generation
- PRISM probabilistic model — uses scoreboard TP/TN/UNAVAIL data to verify probabilistic properties (consensus within 3 rounds with ≥0.95 probability)
- Petri Net visualization — token-passing model of quorum votes; deadlock detection for min_quorum_size

## Planned Milestone: v0.10 Roster Toolkit

**Goal:** Extend `bin/manage-agents.cjs` into a full-featured agent roster management UI — provider presets, slot cloning, live health dashboard, key lifecycle management, scoreboard visibility, CCR routing, per-agent tuning, import/export, and auto-update policy.

**Target features:**
- Provider preset library — curated provider configs user can select by name instead of typing URLs
- Slot cloning — duplicate an existing agent slot with a different provider in one step
- Live health dashboard — auto-refreshing status view showing all slots' real-time health
- Quorum scoreboard inline — win/loss stats displayed per slot in the main list view
- CCR routing visibility — which CCR provider each slot uses, shown in slot list
- Batch key rotation — rotate multiple API keys across slots in a single flow
- Key expiry warnings — detect 401 errors and surface `[key invalid]` badge in the UI
- Per-agent quorum timeout tuning — configure quorum timeout per slot from the menu
- Import/export config — save, restore, and share the full agent roster as a portable file
- Auto-update policy — configure automatic vs. prompted update behavior per slot

## Previous Milestone: v0.11 Parallel Quorum (COMPLETE 2026-02-24)

**Goal:** Replace sequential quorum slot-call loop with wave-barrier pattern — parallel Task fan-outs per round, synthesizer barrier between rounds. 10–12× wall-clock reduction with identical verdict quality.

**Phases:** v0.11-01 (Parallel Quorum Wave-Barrier)

## Parallel Milestone: v0.9 GSD Sync (in progress — 1/4 phases)

**Goal:** Port GSD 1.20.6 improvements into QGSD — context window self-monitoring hook, pre-execution Nyquist test validation, discuss-phase UX refinements, and bundled small fixes.

**Remaining phases:** v0.9-02 (Nyquist), v0.9-03 (discuss-phase UX), v0.9-04 (tier-3 fixes)

## Previous Milestone: v0.8 Fix-Tests ddmin Pipeline

**Goal:** Rewrite `/qgsd:fix-tests` as a principled 4-phase ddmin pipeline to replace the ad-hoc batch loop.

**Target features:**
- 4-phase ddmin pipeline rewrite in `fix-tests.md` (discover → isolate → categorize → fix)
- `--run-cap N` flag added to `maintain-tests ddmin` (default 50, backward-compatible)
- Phase numbering: v0.8-01 (single phase milestone)

**Phase range:** v0.8-01
**Phase v0.8-01 complete:** 2026-02-24 (ddmin pipeline + --run-cap flag)

**v0.8 MILESTONE COMPLETE** — fix-tests rewritten as 4-phase ddmin pipeline.

---

## Previous Milestone: v0.7 Composition Config & Multi-Slot

**Goal:** Ship `quorum_active` composition config so the orchestrator reads its agent list from config instead of hardcoded code; extend to N-instance-per-family multi-slot support; add composition management screen to the mcp-setup wizard.

**Target features:**
- Composition config: `quorum_active` array in `qgsd.json` + orchestrator + health-check + prompt injection all driven by it dynamically
- Scoreboard: slot-keyed `slots{}` map, `--slot`/`--model-id` CLI path, composite key `<slot>:<model-id>` for per-model tracking
- Multiple slots: any family can have N instances (copilot-1/2, opencode-1/2, codex-cli-1/2, gemini-cli-1/2)
- mcp-setup extension: "Edit Quorum Composition" screen to toggle slots on/off and add new slots

**Phase range:** v0.7-01..v0.7-04
**Phase v0.7-01 complete:** 2026-02-23 (composition architecture — quorum_active config layer + scoreboard slots{} + dynamic orchestration; COMP-01..04, SCBD-01..03, INT-04, INT-05 all shipped)
**Phase v0.7-02 complete:** 2026-02-23 (multiple slots per family — MULTI-01..03)
**Phase v0.7-03 complete:** 2026-02-23 (wizard composition screen — WIZ-08..10)
**Phase v0.7-04 complete:** 2026-02-23 (orchestrator Mode A + quorum.md Mode A --slot wiring gap closure; SCBD-01..03 all verified on all quorum paths)

**v0.7 MILESTONE COMPLETE** — All 13 v0.7 requirements shipped (COMP-01..04, SCBD-01..03, MULTI-01..03, WIZ-08..10).

---

## Previous Milestone: v0.6 Agent Slots & Quorum Composition

**Goal:** Rename all quorum agents to slot-based names (claude-1, copilot-1, gemini-cli-1, etc.), ship a `quorum.active` composition config that the orchestrator reads instead of a hardcoded list, and extend `/qgsd:mcp-setup` with a composition screen for managing which slots participate in quorum.

**Target features:**
- Slot naming: rename all 10 agents to `<family>-<N>` scheme + migration script for `~/.claude.json`
- Composition config: `quorum.active` array in `qgsd.json` + orchestrator reads it dynamically
- Multiple slots: any family can have N instances (copilot-1/2, opencode-1/2, codex-cli-1/2, gemini-cli-1/2)
- mcp-setup extension: "Edit Quorum Composition" screen to toggle slots on/off and add new slots
- Scoreboard: tracks by slot name, model shown as context

**Phase range:** 37–42
**Phase 37 complete:** 2026-02-23 (v0.5 SUMMARY.md requirements frontmatter + syncToClaudeJson gap closure)
**Phase 38 complete:** 2026-02-23 (v0.5 SUMMARY.md audit complete; all plans have requirements frontmatter)
**Phase 39 complete:** 2026-02-23 (slot rename across all source files; migration script; zero old model-based names in commands/agents/hooks/templates)

**v0.6 MILESTONE COMPLETE** — All 4 slot naming requirements shipped (SLOT-01..04); composition config (SCBD-01..03, MULTI-03, Phase 42 wizard) deferred to v0.7.

---

## Previous Milestone: v0.5 MCP Setup Wizard

**Goal:** Ship `/qgsd:mcp-setup` — a hybrid wizard that takes users from zero agents to a fully configured quorum in one command, or lets them reconfigure any existing agent (model, provider, API key) without touching config files manually.

**Target features:**
- Wizard shell: first-run linear onboarding + re-run navigable agent menu with live status
- API key management: keytar-backed secure storage, applied to `~/.claude.json` on confirm, auto-restart
- Provider swap: change base URL (AkashML / Together / Fireworks / custom) on existing agents
- Agent roster: add new claude-mcp-server instances or remove existing ones with identity verification
- Install nudge: installer prompts `/qgsd:mcp-setup` when no agents are configured

**Phase range:** 32–36

---

## Previous Milestone: v0.4 MCP Ecosystem

**Goal:** Standardize the 6 coding-agent MCP server repos to a unified Gen2 architecture, then add QGSD commands to observe, configure, and update connected agents (`/qgsd:mcp-status`, `/qgsd:mcp-set-model`, `/qgsd:mcp-update`, `/qgsd:mcp-restart`).

**Target features:**
- MCP repo standardization: Gen1→Gen2 port for claude/codex/copilot/openhands, identity tool everywhere, constants/Logger ✓ Phase 23 shipped surface fixes
- Read layer: `/qgsd:mcp-status` showing all agents, models, health, and UNAVAIL counts
- Write layer: model switching persisted to qgsd.json, auto-detect update commands, process restart

**Phase range:** 23–28
**Phase 23 complete:** 2026-02-22
**Phase 24 complete:** 2026-02-22 (Gen1→Gen2 architecture port: claude 62✓, codex 77✓, copilot 58✓, openhands 13✓)
**Phase 25 complete:** 2026-02-22 (constants.ts + logger.ts + identity tool in all 6 repos; STD-04, STD-08 done)
**Phase 26 complete:** 2026-02-22 (/qgsd:mcp-status — 10-agent identity polling, scoreboard UNAVAIL counts, health state table; OBS-01..04 done)
**Phase 27 complete:** 2026-02-22 (/qgsd:mcp-set-model — 6-step slash command with live identity validation + model_preferences persistence + quorum override injection; MGR-01, MGR-02 done)
**Phase 28 complete:** 2026-02-22 (/qgsd:mcp-update + /qgsd:mcp-restart — update via npm install -g or git pull+build; restart via pkill-f + Claude Code auto-reconnect + identity verification; MGR-03..06 done)

**v0.4 MILESTONE COMPLETE** — All 20 MCP Ecosystem requirements shipped (STD-04/08, OBS-01..04, MGR-01..06; STD-01..03/05..07/09..10 deferred per scope decision).

---

## Previous Milestone: v0.3 Test Suite Maintenance

**Goal:** Build `/qgsd:fix-tests` — a single autonomous command that discovers, batches, runs, AI-categorizes, and iteratively fixes test failures across large suites (20k+ tests), looping until no failures remain.

**Target features:**
- Test discovery across jest, playwright, and pytest suites in any project
- Random batching into configurable groups (default 100) for large-suite support
- AI-driven failure categorization with 5-category diagnosis (valid skip / adapt / isolate / real bug / fixture)
- Iterative debug→quick→debug improvement loop until tests are maximized in value

## Requirements

### Validated

- ✓ Quorum rounds execute as parallel Task fan-outs (wave-barrier): worker per slot → synthesizer barrier → optional Round 2 → final verdict; cuts round-trip from N×timeout to ~1×max(timeout) — v0.11 (Phase v0.11-01 — PAR-01..05)
- ✓ Scoreboard writes atomic (tmpPath + renameSync at all sites); `merge-wave` subcommand applies N parallel worker votes in one transaction — v0.11 (Phase v0.11-01 — PAR-03/04)
- ✓ Context window monitor hook injects WARNING/CRITICAL into `additionalContext` at configurable thresholds — v0.9 (Phase v0.9-01 — CTX-01..05)
- ✓ Stop hook reads transcript JSONL and hard-gates all GSD planning commands — quorum cannot be skipped regardless of instructions — v0.1
- ✓ UserPromptSubmit hook injects quorum instructions into Claude's context window when a planning command is detected — v0.1
- ✓ Two-layer config system: global `~/.claude/qgsd.json` + per-project `.claude/qgsd.json` with project values taking precedence — v0.1
- ✓ MCP auto-detection at install time: installer reads `~/.claude.json`, keyword-matches server names, writes detected prefixes into `qgsd.json` — v0.1
- ✓ `npx qgsd@latest` installs GSD + quorum hooks globally in one command, idempotent, writes directly to `~/.claude/settings.json` — v0.1
- ✓ Stop hook GUARD 5: quorum enforcement fires only on project decision turns (hasArtifactCommit + hasDecisionMarker) — not on routing, questioning, or agent operations — v0.1
- ✓ PreToolUse circuit breaker hook detects oscillation (strict set equality across commit window), persists state across tool calls, blocks write Bash execution — v0.2
- ✓ Circuit breaker config (oscillation_depth, commit_window) configurable via two-layer qgsd.json; installer writes default block idempotently — v0.2
- ✓ Oscillation resolution mode: when breaker fires, quorum diagnoses structural coupling and proposes a unified solution; user approves before execution resumes — v0.2 (Phase 13)
- ✓ CHANGELOG.md `[0.2.0]` entry written, `[Unreleased]` cleared, `hooks/dist/` rebuilt, `npm test` 141/141 passing — v0.2 (Phase 11)
- ✓ qgsd@0.2.0 released: package.json bumped, MILESTONES.md archived, git tag v0.2.0 pushed; npm publish deferred — v0.2 (Phase 12)
- ✓ Activity sidecar `.planning/current-activity.json` tracks every workflow stage boundary; `resume-work` routes to exact interrupted step with 15-row routing table — v0.2 (Phases 14–16)
- ✓ All qqgsd-* agent name typos corrected to qgsd-* across 12 installed + source files — v0.2 (Phase 17)
- ✓ User can run `/qgsd:mcp-set-model <agent> <model>` to set the default model for a quorum worker — v0.4 (Phase 27 — MGR-01)
- ✓ Default model preference persists in `qgsd.json` and is injected into subsequent quorum tool calls via "Model overrides" block — v0.4 (Phase 27 — MGR-02)
- ✓ All 10 quorum agents use slot-based names (`claude-1`..`claude-6`, `codex-cli-1`, `gemini-cli-1`, `opencode-1`, `copilot-1`) in all QGSD output and commands — v0.6 (Phase 39 — SLOT-01)
- ✓ `bin/migrate-to-slots.cjs` migration script renames existing `~/.claude.json` mcpServers entries to slot names non-destructively and idempotently — v0.6 (Phase 39 — SLOT-02)
- ✓ All QGSD source files (hooks, orchestrator, commands, templates) updated to slot names — zero old model-based names in source — v0.6 (Phase 39 — SLOT-03)
- ✓ `mcp-status`, `mcp-set-model`, `mcp-update`, `mcp-restart` accept and display slot names correctly — v0.6 (Phase 39 — SLOT-04)
- ✓ User can define a `quorum_active` array in `qgsd.json` listing which slots participate in quorum — v0.7 (Phase v0.7-01 — COMP-01)
- ✓ Quorum orchestrator reads `quorum_active` from config instead of hardcoded list; qgsd-prompt.js generates dynamic fallback steps from it — v0.7 (Phase v0.7-01 — COMP-02)
- ✓ `check-provider-health.cjs` filters by `quorum_active`; no hardcoded agent arrays remain — v0.7 (Phase v0.7-01 — COMP-03)
- ✓ `quorum_active` auto-populated at install/migration time via `buildActiveSlots()` + `populateActiveSlots()` — v0.7 (Phase v0.7-01 — COMP-04)
- ✓ Scoreboard tracks performance by slot name as stable key; composite `<slot>:<model-id>` key separates per-model stats — v0.7 (Phase v0.7-01/v0.7-04 — SCBD-01..03)
- ✓ User can have multiple `claude-*` slots each running a different model or provider — v0.7 (Phase v0.7-02 — MULTI-01)
- ✓ User can have multiple `copilot-N`, `opencode-N`, `codex-cli-N`, `gemini-cli-N` slots — v0.7 (Phase v0.7-02 — MULTI-02)
- ✓ Adding a new slot supported by both direct config edit and mcp-setup wizard — v0.7 (Phase v0.7-02 — MULTI-03)
- ✓ `/qgsd:mcp-setup` re-run includes "Edit Quorum Composition" option — v0.7 (Phase v0.7-03 — WIZ-08)
- ✓ Composition screen shows all slots with on/off toggle for `quorum_active` inclusion — v0.7 (Phase v0.7-03 — WIZ-09)
- ✓ User can add a new slot for any family from within the wizard — v0.7 (Phase v0.7-03 — WIZ-10)

### Active

<!-- v0.9 scope: GSD 1.20.6 port -->

- [ ] Nyquist validation layer generates `VALIDATION.md` at plan-phase step 5.5 with per-task test-map
- [ ] Discuss-phase recommended option highlighting per choice with brief rationale
- [ ] Discuss-phase gray-area looping — user can explore more areas before finalizing context
- [ ] Skill tool spawn guards added to plan-phase and discuss-phase workflow spawn points
- [ ] Gemini TOML fix applied to QGSD Gemini templates (quorum slot relevance)
- [ ] Decimal phase number parsing consistent across gsd-tools.cjs

<!-- Carry-forward: deferred from v0.3 -->
- [ ] npm publish qgsd@0.2.0 deferred — run `npm publish --access public` when ready (RLS-04)


### Out of Scope

- Calling model CLIs directly from hooks (fragile, external dependencies, auth complexity) — deferred as optional strict mode
- Modifying GSD workflows or agents — QGSD is additive only
- Per-project install (global only — matches GSD's install behavior)
- Fail-closed mode in v1 — fail-open matches CLAUDE.md R6 and avoids blocking work

## Context

QGSD v0.7 shipped 2026-02-23. v0.2.0 git tag pushed; npm publish deferred by user decision.

**Codebase:** ~87,000+ lines (JS + MD), 450+ files across the full development cycle.
**Tech stack:** Node.js, Claude Code hooks (UserPromptSubmit + Stop + PreToolUse), npm package.
**Known tech debt:** Phase 12 VERIFICATION.md missing; `~/.claude/get-shit-done/` lacks activity tracking (out of scope — upstream GSD package boundary); orchestrator Mode B scoreboard block uses back-reference rather than inline dual-variant bash blocks (low risk — Mode A always read first).

## Constraints

- **Architecture**: Plugin extension only — no GSD source modifications, zero coupling to GSD version
- **Dependencies**: Pure Claude Code hooks system — no external CLIs, no API keys beyond what Claude Code already manages via MCPs
- **Install**: Global (~/.claude/) following GSD's install pattern
- **Scope**: v1 covers quorum enforcement + circuit breaker + activity tracking

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| A+C: UserPromptSubmit injection + Stop hook gate | Three-model quorum consensus; Option B (direct CLI calls) fragile and maintenance-heavy | Implemented — Phase 1 |
| High-stakes commands as default scope | All /qgsd:* too broad; user-configurable override future-proofs against GSD evolution | Implemented — Phase 1 (6-command allowlist) |
| Fail-open | Matches CLAUDE.md R6; prevents blocking work during quota issues | Implemented — Phase 1 |
| Plugin extension, not fork | No trade-offs vs fork — hooks are additive; GSD updates don't require QGSD changes | Confirmed — Phase 1 |
| Global install | Matches GSD's default behavior; quorum applies everywhere without per-project opt-in | Implemented — Phase 1 |
| Hook installation via settings.json directly | Claude Code bug #10225: plugin hooks.json silently discards UserPromptSubmit output | Implemented — Phase 1 |
| STOP-05 fast-path omitted by design | last_assistant_message substring matching unreliable; JSONL parse synchronous and correct | Design decision — Phase 1 gap closure |
| Shallow merge for config layering | Project required_models should fully replace global (not deep-merge) | Phase 2 — CONF-02 |
| QGSD_CLAUDE_JSON env var for testing | Avoids mutating real ~/.claude.json in tests; production always reads real file | Phase 2 |
| required_models field name | Richer than quorum_models (dict with tool_prefix + required flag) | Phase 2 — CONF-03 |
| INST-08 fix: PreToolUse removal in uninstall() | Identical filter pattern to Stop/UserPromptSubmit blocks | Phase 10 — bug fix |
| RECV-01 fix: git rev-parse for state path | Handles invocation from any subdirectory | Phase 10 — bug fix |
| INST-10 fix: two-tier sub-key backfill | Prevents overwriting user-customized values on partial configs | Phase 10 — bug fix |
| Oscillation resolution mode replaces hard-stop | Hard-stop creates deadlocks; structured quorum diagnosis with user approval gate is recoverable | Phase 13 — ORES-01..05 |
| Activity sidecar as separate JSON file | No schema pollution of STATE.md; file presence/absence = activity in progress/complete | Phase 14 — ACT-01..07 |
| /gsd:* namespace excluded from activity tracking | Upstream GSD package boundary — QGSD modifications stay in /qgsd:* namespace | Phase 14 — ACT scope decision |
| RLS-04 npm publish deferred | User decision — publish timing separate from milestone archival | Phase 12 |
| escapedReqId regex safety in gsd-tools | REQ-IDs with regex-special chars (e.g. from informal labels in ROADMAP) break new RegExp() construction | Phase 17 housekeeping |
| spawnSync (not execSync) for framework CLIs | Eliminates shell injection risk; `shell:true` in execSync opens command injection surface | Phase 18 — DISC-01/02 |
| Mulberry32 PRNG inline (no external dep) | Zero-dep policy for gsd-tools; inline implementation ensures deterministic shuffle without npm add | Phase 18 — EXEC-01 |
| spawn (not spawnSync) for test execution | File-based stdout/stderr capture via spawnToFile prevents Node.js maxBuffer overflow on large jest JSON output | Phase 18 — EXEC-02/04 |
| gsd-tools.cjs monolith noted as tech debt | Parallel wave agents all modifying same file triggered circuit breaker false positive; modularization deferred to future phase | Phase 18 — architectural note |
| Stub categorization marks all failures as real_bug | Conservative placeholder for Phase 20; Phase 21 replaces with AI classification (CATG-01/02/03); never dispatches auto-actions in Phase 20 | Phase 20 — ITER-01/02 |
| consecutive_no_progress stored in state JSON | Survives interruption; resume logic can correctly continue progress guard count without resetting | Phase 20 — ITER-02 |
| Phase 20 stub detection in fix-tests Step 6d | Checks categorization_verdicts == [] AND results_by_category non-empty → clears stale state and re-classifies; ensures Phase 20 runs resume correctly under Phase 21 workflow | Phase 21 — CATG-01 |
| real-bug conservative fallback | When uncertain, classify as real-bug (never auto-action incorrectly); better to surface to user than wrong dispatch | Phase 21 — CATG-01 |
| Pickaxe enrichment is non-gating | commits = [] still dispatches as adapt; pickaxe_context = null if git unavailable — categorization not blocked by git absence | Phase 21 — CATG-02 |
| Dispatch state saved BEFORE Task spawn | dispatched_task record written to state before Task() call — idempotent on resume; dedup check skips already-dispatched chunks | Phase 21 — CATG-03 |
| runInstall() helper uses cwd: tmpDir | --disable-breaker uses git fallback for project root; tmpDir not a git repo, so state writes to tmpDir/.claude/ — real project untouched during tests | Phase 22 — TC-CB-1/2/3 |
| TC-RESUME-2 uses empty-files 3-batch manifest | Exercises --batch-index 2 routing without real test runner — manifest schema sufficient for resume path validation | Phase 22 — TC-RESUME-2 |
| VERIFICATION.md evidence chain format | Per-requirement sections: file reference + line number + test case reference + PASSED/GAPS verdict — consumed by gsd-verifier | Phase 22 — established pattern |
| ToolArguments re-export skipped in constants.ts | None of the 4 Gen1-ported repos define ToolArguments in types.ts — each uses specific Zod schemas; re-export would TypeScript error | Phase 25 — Plan 01 |
| No console.log replacements in Phase 25 | Gen2 port (Phase 24) already eliminated all console.log from operational source files in all 4 repos | Phase 25 — Plan 02 |
| gemini identityTool was registered but export-only | identityTool was exported from simple-tools.ts but never pushed to toolRegistry in index.ts — registered in Plan 03 | Phase 25 — Plan 03 bug fix |
| AVAILABLE_OPENCODE_MODELS defined inline in simple-tools.ts | opencode types.ts uses interface pattern without MODELS/TOOLS consts; inline avoids misfit import | Phase 25 — Plan 03 |
| mcp-status v2 replaces v1 (identity polling replaces HTTP probe) | v1 used provider health_check + HTTP probe; v2 reads scoreboard UNAVAIL from rounds[].votes inline node script + identity tool for all 10 agents — matches OBS-01..04 exactly | Phase 26 |
| mcp-status NOT in quorum_commands | Read-only observation — no planning decisions made; R2.1 compliance; health_check not needed (identity faster, no LLM call) | Phase 26 — OBS design |
| claude-glm as 10th quorum agent | Added after original 9-agent plan; glm not yet in scoreboard VALID_MODELS so UNAVAIL=0 correct — forward-compatible | Phase 26 — Plan 01 |
| model_preferences in global qgsd.json only | Per-project model override out of scope — simplifies merge logic; global config shallow merge already handles model_preferences | Phase 27 — Plan 01 |
| Agent name validated before identity call | Prevents hang when user typos agent name; 10-agent hardcoded list checked at Step 2, identity call deferred to Step 3 | Phase 27 — Plan 02 |
| AGENT_TOOL_MAP in qgsd-prompt.js | Maps 10 agent keys to their primary quorum tool — makes override instructions human-readable in additionalContext | Phase 27 — Plan 01 |
| Install method from ~/.claude.json (not identity tool) | Identity tool unavailable when agent is offline; claude.json command field is always readable, works for offline agents | Phase 28 — Plan 01 |
| Package name = args[args.length - 1] for npx agents | codex-cli args: ['-y', 'codex-mcp-server'] — package is last arg, not args[0]; avoids npm install -g -y failure | Phase 28 — Plan 01 |
| Deduplication by repo dir for "all" mode | 6 claude-* agents share claude-mcp-server — build once, mark others SKIPPED; prevents 6x redundant builds | Phase 28 — Plan 01 |
| pkill -f for MCP restart (not claude mcp restart) | No `claude mcp restart` subcommand exists; process kill + Claude Code auto-restart is the only mechanism | Phase 28 — Plan 02 |
| npx restart: kill npm exec parent first, then node child | npm exec parent respawns node child if only child is killed; parent kill prevents stale respawn | Phase 28 — Plan 02 |

| gemini-mcp-server unscoping in ~/.claude.json | Phase 23 unscoped the npm package name but didn't update ~/.claude.json args — mcp-update derives install target from args[-1]; Phase 30 closed the gap | ~/.claude.json gemini-cli args now ["-y", "gemini-mcp-server"] |
| Gen2 branch merge for codex/copilot | Phase 24 ported both to Gen2 but left work on feature branches; codex origin/main had a diverged PR merge requiring a merge commit rather than ff-only | Both repos Gen2 on main and origin/main via Phase 31 |

| Key passed via env var in node -e scripts | Prevents key value from appearing in shell history, audit logs, or displayed text — pattern used in both keytar store and ~/.claude.json patch steps | Phase 33 — KEY-02 |
| syncToClaudeJson called after ANTHROPIC_API_KEY patch | Ensures all keytar secrets propagate to all agent env blocks after any single-agent update — order: patch → sync | Phase 33 — KEY-03 |
| URL passed via NEW_URL env var in provider swap node scripts | Same security pattern as KEY env var in Phase 33 — prevents URL injection into script body; canonical URLs hardcoded in step C resolution, user-entered custom URL also env-var-only | Phase 34 — PROV-03 |

| `~/.claude/qgsd-bin/secrets.cjs` placeholder for distributable commands | Source file retains `~/.claude/` prefix; `copyWithPathReplacement()` in bin/install.js substitutes real install path in installed copy — same pattern used by all other installed commands | Phase 37 — INTEGRATION-01 closure |
| syncToClaudeJson required in every apply flow | All 5 apply paths (first-run, add-agent, Option 1, Option 2, Confirm+Apply+Restart) must call syncToClaudeJson after writing ~/.claude.json — ensures keytar secrets propagate symmetrically | Phase 37 — INTEGRATION-02 closure |
| Slot naming scheme: `<family>-<N>` (claude-1..6, codex-cli-1, gemini-cli-1, opencode-1, copilot-1) | Decouples agent identity from provider/model — slots are stable identifiers even when model or provider changes; N suffix enables multiple instances of same family | Phase 39 — SLOT-01 |
| SLOT_MIGRATION_MAP: 10 hardcoded old→new entries in bin/migrate-to-slots.cjs | Migration is non-destructive (skip if newName already present) and idempotent — safe to run multiple times; `--dry-run` flag shows all renames without applying | Phase 39 — SLOT-02 |
| Display name = slot name as-is (no prefix stripping) | Model-based names needed stripping (claude-deepseek → deepseek); slot names are already short and stable — identity output shows full slot name in scoreboard and quorum display | Phase 39 — SLOT-01 |
| Scoreboard --model derived from health_check response, not server name | Slot names (claude-1) carry no model info; model field in health_check API response is the authoritative source for scoreboard model column | Phase 39 — SLOT-04 |
| quorum_active uses shallow-merge semantics; project config entirely replaces global | Same pattern as required_models — project can fully restrict quorum to a subset of global slots | Phase v0.7-01 — COMP-01 |
| Scoreboard composite key `<slot>:<model-id>` (not just slot) | Same slot with different model = new row; historical rows preserved for model comparison; stable slot key anchors the series | Phase v0.7-01 — SCBD-01 |
| SLOT_TOOL_SUFFIX strips trailing -N digit index before lookup | `codex-cli-1` → family `codex-cli`; `claude-1` → family `claude`; allows arbitrary N without map explosion | Phase v0.7-01 — COMP-02 |
| Fail-open on empty quorum_active | Empty = all discovered slots participate — matches existing fail-open philosophy; zero-config installs work without any qgsd.json | Phase v0.7-01 — COMP-01 |
| buildActiveSlots() reads ~/.claude.json mcpServer keys at install time | Avoids hardcoding slot list; discovers whatever is present in the real install; silently skips if file unreadable | Phase v0.7-01 — COMP-04 |
| INT-04 fix: --slot + --model-id replaces "strip claude- prefix" in quorum.md Mode B | Slot names like `claude-2` would need only the digit stripped — prefix-stripping was wrong; --slot passes the full slot name; --model-id from health_check response is the correct model source | Phase v0.7-01 — INT-04 |
| Orchestrator Mode A + quorum.md Mode A Escalate sections expanded (not back-referenced) | Escalate section previously said "same pattern as Consensus above" — expanded to explicit dual-variant block so Escalate is self-contained; prevents misinterpretation in future edits | Phase v0.7-04 — MC-1/Flow-4/Flow-5 |

| PostToolUse hook fires stateless on every tool call | No debounce in v1 — stateless design satisfies test criteria cleanly; debounce deferred to v2 if desired | Phase v0.9-01 |
| hooks/dist/ new files are gitignored | `.gitignore` covers `hooks/dist/`; new files (gsd-context-monitor.js) sync to disk but not tracked; existing tracked files (config-loader.js) updated via `git add -f` | Phase v0.9-01 |
| Worker tools: Read/Bash/Glob/Grep (no Write); synthesizer: Read only | Workers never touch scoreboard directly — prevents concurrent write races; all scoreboard writes go through merge-wave at the barrier | Phase v0.11-01-01 — PAR-01/02 |
| Atomic write: tmpPath + renameSync at all scoreboard write sites | POSIX rename() is atomic within same volume — eliminates torn-JSON from concurrent parallel worker writes | Phase v0.11-01-02 — PAR-03 |
| merge-wave: N vote files → one atomic scoreboard transaction | Parallel workers write temp vote files; orchestrator merges in one call after barrier — zero intermediate scoreboard states | Phase v0.11-01-02 — PAR-04 |
| Wave-barrier architecture: sibling Task fan-out only for worker waves | All Bash (set-availability, merge-wave) remains sequential; only Task spawns within a round are sibling calls | Phase v0.11-01-03 — PAR-05 |
| voteCode mapping: Mode A = '' (no ground truth at vote time); Mode B peer-scored vs consensus | APPROVE∩APPROVE=TP, REJECT∩REJECT=TN, APPROVE∩REJECT=FP, REJECT∩APPROVE=FN, FLAG=TP+, UNAVAIL=UNAVAIL | Phase v0.11-01-03 tech debt fix |

---
*Last updated: 2026-02-25 after v0.13 Autonomous Milestone Execution milestone started*
