# Milestones

## v0.1 — Quorum Hook Enforcement

**Completed:** 2026-02-21
**Phases:** 1–5 (Phase 5 = gap closure)
**Last phase number:** 5

### What Shipped

- Stop hook hard gate — Claude cannot deliver a GSD planning response without quorum evidence in transcript
- UserPromptSubmit injection — quorum instructions fire at command time, not session start
- Config system — two-layer merge (global ~/.claude/qgsd.json + project .claude/qgsd.json), MCP auto-detection
- Decision scope narrowing — GUARD 5 restricts quorum to actual project decision turns (hasArtifactCommit + hasDecisionMarker)
- npm installer — `npx qgsd@latest` writes hooks to `~/.claude/settings.json`, idempotent, warns on missing MCP servers
- Phase 5 gap closure — GUARD 5 marker path propagated to buildQuorumInstructions() and templates/qgsd.json

### Requirements Satisfied

39/39 v1 requirements (STOP-01–09, UPS-01–05, META-01–03, CONF-01–05, MCP-01–06, INST-01–07, SYNC-01–04)
Phase 4 scope requirements: SCOPE-01–07 (7/7)

### Key Decisions Carried Forward

- Hook installation writes to ~/.claude/settings.json directly (never plugin hooks.json — bug #10225)
- Fail-open: unavailable models pass through, not block
- Global install only; no per-project install in v0.x
- GUARD 5: decision turn = hasArtifactCommit OR hasDecisionMarker (both must be false to skip quorum)

---

*Archive committed: 2026-02-21*

## v0.2 Gap Closure — Activity Resume Routing (Shipped: 2026-02-21)

**Phases completed:** 17 phases, 40 plans, 13 tasks

**Key accomplishments:**
- (none recorded)

---

## v0.3 — Test Suite Maintenance Tool (Shipped: 2026-02-22)

**Phases completed:** 5 phases (18–22), ~96 commits
**Requirements:** 14/14 v0.3 requirements (DISC-01/02, EXEC-01..04, CATG-01..03, ITER-01/02, INTG-01..03)

**Delivered:** Built `/nf:fix-tests` — a single autonomous command that discovers all jest/playwright/pytest tests, batches them, runs with flakiness detection, AI-categorizes failures into 5 types, dispatches fix tasks, and loops until all tests are classified. 135 integration tests verify all seams end-to-end.

**Key accomplishments:**
- `gsd-tools.cjs maintain-tests discover/batch/run-batch` — framework-native test discovery (never globs); random batch shuffling; spawnToFile capture prevents Node.js maxBuffer overflow on large suites (DISC-01/02, EXEC-01..04)
- 5-category AI failure diagnosis (valid-skip / adapt / isolate / real-bug / fixture) with git pickaxe enrichment for `adapt` failures linking to the causative commit (CATG-01..03)
- Autonomous dispatch: adapt/fixture/isolate failures grouped and dispatched as `/nf:quick` Tasks; real-bug failures deferred to user report (CATG-03)
- Loop termination logic: no-progress guard (5 consecutive batches), configurable iteration cap, circuit breaker disable/re-enable lifecycle (ITER-01/02, INTG-01)
- Activity sidecar integration: interrupted maintenance runs resume to exact batch step via `/nf:resume-work` routing table (INTG-02)
- 135 integration tests covering INTG-03 compliance, circuit breaker lifecycle, resume mid-batch, Phase 21 schema round-trips (Phase 22)

---

## v0.4 — MCP Ecosystem (Shipped: 2026-02-22)

**Phases completed:** 9 phases (23–31), ~853 commits
**Requirements:** OBS-01..04, MGR-01..06, STD-02, STD-04, STD-08, STD-10 shipped; STD-01/03/05/06/07/09 deferred (out of scope per Phase 23 scope decision)

**Delivered:** Standardized the 6 coding-agent MCP server repos to Gen2 architecture, shipped `/nf:mcp-status` (identity-based polling + scoreboard UNAVAIL counts), `/nf:mcp-set-model` (persistent model preferences + quorum injection), `/nf:mcp-update` (all install methods), and `/nf:mcp-restart` (pkill + auto-reconnect). 201/201 tests passing.

**Key accomplishments:**
- Gen1→Gen2 architecture port for claude/codex/copilot/openhands repos: per-tool `*.tool.ts` + `registry.ts` structure; Gen1 files removed; both repos merged to main from feature branches (STD-02, Phase 24/31)
- `identity` tool + `constants.ts` + `Logger` utility shipped in all 6 repos; `gemini-mcp-server` unscoped to unscoped npm package name (STD-04, STD-08, STD-10, Phase 25/30)
- `/nf:mcp-status` v2 — 10-agent identity polling + inline scoreboard UNAVAIL read; health state table with model and availability (OBS-01..04, Phase 26/29)
- `/nf:mcp-set-model` — 6-step command with live identity validation, model_preferences persistence to global qgsd.json, quorum override injection in subsequent calls (MGR-01/02, Phase 27)
- `/nf:mcp-update` — detects npm global / npx / git install method from `~/.claude.json` args; deduplicates 6 claude-* agents to single build; `all` mode sequential (MGR-03..05, Phase 28)
- `/nf:mcp-restart` — pkill npm exec parent then node child (prevents stale respawn); Claude Code auto-reconnect + identity verification (MGR-06, Phase 28)

---

## v0.5 — MCP Setup Wizard (Shipped: 2026-02-23)

**Phases completed:** 7 phases (32–38), ~613 commits
**Requirements:** 17/17 v0.5 requirements (WIZ-01..05, KEY-01..04, PROV-01..03, AGENT-01..03, INST-01)

**Delivered:** Built `/nf:mcp-setup` — a hybrid wizard that takes users from zero agents to a fully configured quorum in one command, or lets them reconfigure any existing agent (key, provider, model) without touching config files. First-run = linear onboarding; re-run = navigable agent menu with live status.

**Key accomplishments:**
- Wizard scaffold: first-run vs re-run detection, AskUserQuestion agent menu with live identity status, confirm+apply+restart flow (WIZ-01..05, Phase 32)
- API key management: keytar-backed secure storage via `bin/secrets.cjs`; key passed via env var (not shell history); `syncToClaudeJson` propagates to all agent env blocks after apply (KEY-01..04, Phase 33)
- Provider swap: curated list (AkashML / Together.xyz / Fireworks) + custom URL; `NEW_URL` env var pattern prevents injection; `syncToClaudeJson` called on apply (PROV-01..03, Phase 34)
- Agent roster: add new claude-mcp-server instances with `CLAUDE_MCP_PATH` 2-strategy fallback; identity ping verifies connectivity; remove existing agents (AGENT-01..03, Phase 35)
- Install nudge: installer detects no configured quorum agents via `hasClaudeMcpAgents()` and prompts `/nf:mcp-setup` (INST-01, Phase 36)
- Distribution fixes: 9 hardcoded `secrets.cjs` absolute paths replaced with `copyWithPathReplacement()` dynamic resolution; all 5 apply flows call `syncToClaudeJson` (Phase 37)

---


## v0.6 Agent Slots & Quorum Composition (Shipped: 2026-02-23)

**Phases completed:** Phase 39 (+ Phases 37–38 as v0.5 gap closure), 5 plans
**Git range:** 1e84b15..dae3af6 (23 commits, 43 files changed, +3243/-231 lines)

**Delivered:** Renamed all 10 quorum agents to slot-based `<family>-<N>` names everywhere in QGSD, shipped a non-destructive idempotent migration script, and eliminated all old model-based names from every source file.

**Key accomplishments:**
- Shipped `bin/migrate-to-slots.cjs` — idempotent migration script with `--dry-run`; renames 10 `~/.claude.json` mcpServers keys and patches `qgsd.json` required_models tool_prefix values (SLOT-02)
- Updated all runtime hooks (`qgsd-prompt.js`, `config-loader.js`, `qgsd-stop.js`) and `templates/qgsd.json` to slot-based tool prefixes — zero old names in hook layer (SLOT-03)
- Updated all 8 command `.md` files and the quorum orchestrator agent to slot names in allowed-tools, validation lists, KNOWN_AGENTS arrays — zero old names in command layer (SLOT-01, SLOT-03, SLOT-04)
- Fixed `mcp-setup.md` distribution defects: replaced 9 hardcoded `secrets.cjs` absolute paths with dynamic resolution, added missing `syncToClaudeJson` to provider swap flow (Phase 37)
- Established `requirements:` frontmatter as the canonical traceability link in SUMMARY.md files (Phase 38)

**Known gaps (deferred to v0.7):** COMP-01..04, MULTI-01..03, WIZ-08..10, SCBD-01..03

---


## v0.7 Composition Config & Multi-Slot (Shipped: 2026-02-23)

**Phases completed:** 4 phases (v0.7-01..v0.7-04), 10 plans
**Git range:** 03fffb3..36ad405 (61 files changed, +5,555/-219 lines)

**Delivered:** Shipped `quorum_active` composition config so which slots participate in quorum is a config decision not a code change, extended to N-slot-per-family multi-slot support, added a Composition Screen to the mcp-setup wizard, and fixed scoreboard slot tracking on all quorum paths.

**Key accomplishments:**
- `quorum_active` config field added — users define slot composition via `qgsd.json`; auto-populated at install/migrate time via `buildActiveSlots()` / `populateActiveSlots()` (COMP-01..04)
- Scoreboard slot tracking — `update-scoreboard.cjs` extended with `slots{}` schema and `--slot`/`--model-id` CLI args; composite key `<slot>:<model-id>` for per-slot-per-model stats (SCBD-01..03)
- Dynamic quorum wiring — quorum.md and orchestrator provider pre-flight read `quorum_active`; no more hardcoded agent lists (COMP-02)
- Multi-slot support — multiple claude/copilot/opencode/codex-cli/gemini-cli slots; mcp-setup `Add new agent` expanded with native CLI second-slot options 6–9 (MULTI-01..03)
- Wizard Composition Screen — `/nf:mcp-setup` re-run gains "Edit Quorum Composition" with on/off slot toggle, apply-to-disk, and add-from-composition routing (WIZ-08..10)
- Orchestrator scoreboard slot fix — quorum.md + orchestrator Mode A use `--slot`/`--model-id`; Escalate sections expanded to inline dual-variant blocks; closes SCBD-01..03 audit gap (Phase v0.7-04)

---


## v0.11 Parallel Quorum (Shipped: 2026-02-24)

**Phases completed:** 28 phases, 52 plans, 12 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.13 Autonomous Milestone Execution (Shipped: 2026-02-25)

**Phases completed:** 53 phases, 113 plans, 44 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.9 — GSD Sync (Shipped: 2026-02-27)

**Phases:** v0.9-01..v0.9-09 (9 phases, 13 plans)
**Timeline:** 2026-02-24 → 2026-02-27

### What Shipped

- PostToolUse context-window monitor hook — injects WARNING/CRITICAL into `additionalContext` at configurable thresholds (v0.9-01)
- Nyquist validation layer — `VALIDATION.md` template + `plan-phase.md` Step 5.5 generates per-phase test-map at plan time; halt guard (NYQ-05) blocks plan creation when absent (v0.9-02)
- Discuss-phase UX — recommended-choice highlighting in gray-area prompts + loop-back option instead of hard stop (v0.9-03)
- Tier 3 fixes — 5× Skill tool guards in plan-phase, Gemini TOML files installed, decimal phase parsing normalized (v0.9-04)
- Renamed `get-shit-done/` → `qgsd-core/` — all 9 agents, installer (line 1623), and runtime updated; zero stale refs remaining (v0.9-05)
- Nyquist pipeline completed — `nyquist_validation_enabled` added to Step 1 parse list + portable `~/.claude/` paths in Step 5.5 (v0.9-07)
- SC-4 demonstrated — plan-phase v0.9-09 produced `v0.9-09-VALIDATION.md` end-to-end, closing the last v0.9 audit gap (v0.9-09)

### Requirements Satisfied

13/13 v0.9 requirements (NYQ-01–05, DSC-01–03, CTX-01–02, FIX-01, REN-01–02)

### Audit

Milestone audit: PASSED — 9/9 phases verified, 13/13 requirements wired, 4/4 E2E flows complete
Archive: `.planning/milestones/v0.9-MILESTONE-AUDIT.md`

---


## v0.15 — Health & Tooling Modernization (Shipped: 2026-02-27)

**Phases:** v0.15-01..v0.15-04 (4 phases, 4 plans)
**Requirements:** 6/6 v0.15 requirements (HLTH-01..03, SAFE-01..02, VIS-01)
**Git range:** 446c04a..586dc76 (100 commits, 220 files changed, +16023/-2535 lines)
**Timeline:** 2026-02-26 → 2026-02-27 (1 day)

**Delivered:** Fixed QGSD's health checker to fully support the versioned phase naming convention, eliminating 64 false-positive warnings; guarded `--repair` against silent STATE.md data loss; archived 22 legacy pre-versioning phase dirs; and added W008 health warnings for recurring quorum slot failures.

**Key accomplishments:**
- Health checker regex fix: extended `phasePattern` and W005/W007/W002 checks to match `v0.X-YY-name` versioned dirs — eliminated 41 W005, 22 W007, and 1 W002 false positives on the QGSD repo itself (HLTH-01..03, v0.15-01)
- Repair safety guard: content-length threshold (50 lines) in `regenerateState` blocks silent STATE.md overwrite; `--force` flag added for explicit opt-in; 3 SAFE-01 TDD tests (SAFE-01, v0.15-02)
- Legacy dir archive: moved 22 pre-versioning numeric phase dirs (18-39) to `.planning/archive/legacy/` — clean separation of pre-versioning history from active phases (SAFE-02, v0.15-03)
- Quorum failure visibility: Check 9 in `cmdValidateHealth` reads `quorum-failures.json` and emits W008 for slots with ≥3 failures — live on QGSD repo showing codex-1 count=4, copilot-1 count=3 (VIS-01, v0.15-04)

**Audit:**
Milestone audit: TECH_DEBT (post-audit fix commit 586dc76 closed all items)
Archive: `.planning/milestones/v0.15-MILESTONE-AUDIT.md`

---


## v0.19 FV Pipeline Hardening (Shipped: 2026-02-28)

**Phases completed:** 57 phases, 132 plans, 61 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.20 — FV as Active Planning Gate (Shipped: 2026-03-01)

**Phases:** v0.20-01..v0.20-09 (9 phases, 28 plans)
**Requirements:** 20/20 (SCHEMA-01–03, LIVE-01/02, PLAN-01–03, VERIFY-01/02, EVID-01/02, TRIAGE-01/02, UPPAAL-01–03, SENS-01–03)
**Git range:** 5b45fd69..696d4b89 (83 commits, 250 files, +39,008/−3,343 lines)
**Timeline:** 2026-02-28 → 2026-03-01 (2 days)

**Delivered:** Wired QGSD's formal verification pipeline into planning and verification workflows — TLC/Alloy/PRISM findings surface as hypotheses during `plan-phase`, formal check results appear in `VERIFICATION.md` during `execute-phase`, and the check-result schema was enriched to v2.1 spec with triage bundles and evidence dashboards.

**Key accomplishments:**
- Extended `check-result.schema.json` to v2.1 spec with 7 new fields (`check_id`, `surface`, `property`, `runtime_ms`, `summary`, `triage_tags`, `observation_window`); updated all 21 callers in `run-formal-verify.cjs` (SCHEMA-01–03)
- CI step detects liveness properties lacking fairness declarations and emits `result=inconclusive`; wired as `ci:liveness-fairness-lint` in STEPS pipeline (LIVE-01/02)
- `plan-phase.md` step 8.2 runs `run-formal-verify --only=tla` pre-quorum; TLC `fail` results extracted into `FV_HYPOTHESES` and injected into quorum `review_context` as planning hypotheses; fail-open (PLAN-01–03)
- `qgsd-verifier` agent runs formal verification post-implementation; `VERIFICATION.md` gains `## Formal Verification` section with pass/fail/warn counts per formalism (VERIFY-01/02)
- `never_observed` trace entries annotated with `confidence: low|medium|high`; `observation_window` metadata written to NDJSON; `generate-triage-bundle.cjs` produces `diff-report.md` + `suspects.md` after every FV run (EVID-01/02, TRIAGE-01/02)
- UPPAAL timed automaton model (`quorum-races.xml`) captures quorum race conditions using empirical `runtime_ms` bounds as clock guards; TCTL queries surface minimum inter-slot gap and maximum timeout for consensus (UPPAAL-01–03)
- `run-sensitivity-sweep.cjs` sweeps FV parameters (MaxSize [1,2,3], tp_rate [0.5,0.75,0.95]); top-3 high-impact parameters injected into planning quorum as `SENSITIVITY_CONTEXT`; `sensitivity-report.cjs` produces ranked human-readable report (SENS-01–03)

**Tech debt incurred:**
- SUMMARY.md files lack `requirements_completed` frontmatter — limits automated 3-source cross-reference
- v0.20-08-01 (RED test scaffold) has no SUMMARY.md (accepted by audit)

---


## v0.21 — FV Closed Loop (Shipped: 2026-03-01)

**Phases:** v0.21-01..v0.21-06 (6 phases, 24 plans)
**Requirements:** 18/21 satisfied (ARCH-01–03, DIAG-01–03, LOOP-01–04, SPEC-01–04, PLAN-01–03, SIG-01–04)
**Git range:** bb1ee434..86c2880d (86 commits, 131 files, +18,559/−159 lines)
**Timeline:** 2026-03-01 (~9.5 hours)

**Delivered:** Closed the feedback loop between QGSD's formal verification pipeline and itself — specs auto-regenerate from code, debug sessions capture new invariants, sensitivity results recalibrate PRISM, and every plan is TLC-verified before quorum sees it.

**Key accomplishments:**
- Central model registry: `.formal/model-registry.json` as single source of truth with provenance tracking; `promote-model.cjs` for atomic promotion; `accept-debug-invariant.cjs` for debug-discovered invariants (ARCH-01–03)
- Conformance crisis resolved: reduced 69% trace divergence to 0% on mapped events via fresh-actor methodology fix in `expectedState()`; `xstate-trace-walker.cjs` + `attribute-trace-divergence.cjs` for root-cause attribution (DIAG-01–03)
- Self-calibrating feedback loops: PRISM auto-calibrates from scoreboard via `export-prism-constants` pre-step; `qgsd-spec-regen.js` PostToolUse hook regenerates specs on XState changes; `propose-debug-invariants.cjs` mines TLA+ candidates from debug sessions (LOOP-01–04)
- Critical subsystems formally specified: `QGSDStopHook.tla` (TLA+), `QGSDOscillation.tla` audit (no drift), `quorum-composition.als` (Alloy, 3 rules hold), `generate-phase-spec.cjs` auto-generates per-phase TLA+ specs (SPEC-01–04)
- Plans TLC-verified before quorum: `generate-proposed-changes.cjs` synthesizes TLA+ deltas; `run-phase-tlc.cjs` iterative verification loop; `quorum-formal-context.cjs` generates evidence blocks for quorum slots (PLAN-01–03)
- Operational signals drive decisions: `detect-coverage-gaps.cjs` for TLC coverage, `generate-petri-net.cjs --roadmap` for phase dependencies, `prism-priority.cjs` for failure ranking, `quorum-consensus-gate.cjs` Poisson binomial gate (SIG-01–04)

### Known Gaps

- **DIAG-01**: Conformance trace divergence reduced to 0% — implemented and tested (49/49 GREEN) but VERIFICATION.md artifact never generated for v0.21-02
- **DIAG-02**: `attribute-trace-divergence.cjs` root-cause attribution tool — implemented and tested but VERIFICATION.md missing
- **DIAG-03**: `.formal/diff-report.md` complete attribution — delivered but VERIFICATION.md missing

**Tech debt incurred:**
- 3983 unmappable_action divergences (circuit_break: 2988, no-action: 995) — correctly excluded from state_mismatch rate
- 2 todo tests in `oscillation-audit.test.cjs` (require unexported functions from circuit-breaker)
- Alloy `min[]` workaround uses over-approximation (Alloy 6.2.0 CLI limitation)
- SPEC-04 generates PLACEHOLDER properties — developers must fill before TLC verification
- REQUIREMENTS.md traceability checkboxes never updated during milestone execution

**Audit:** GAPS_FOUND (3 procedural gaps — all implementation complete, missing VERIFICATION.md for v0.21-02)
**Archive:** `.planning/milestones/v0.21-MILESTONE-AUDIT.md`

---


## v0.23 — Formal Gates (Shipped: 2026-03-02)

**Phases:** v0.23-01..v0.23-04 (4 phases, 12 plans)
**Requirements:** 11/11 (WFI-01–05, ENF-01–03, IVL-01–03)
**Git range:** ce84d53f..fade53fa (88 files changed, +12,828/−192 lines)
**Timeline:** 2026-03-02 (single day)

**Delivered:** Made TLC/Alloy/PRISM actual enforcing gates in every major QGSD workflow step — plan-phase discovers and injects formal invariants, execute-phase runs model checkers and hard-blocks on counterexamples, the roadmapper reads invariants when designing phases, and a 22-test integration suite proves the entire chain fires end-to-end with real tool output.

**Key accomplishments:**
- plan-phase formal integration: Step 4.5 scope scan populates `$FORMAL_SPEC_CONTEXT` from `.formal/spec/*/invariants.md`; Step 10 checker enforces `formal_artifacts:` frontmatter as BLOCKER when specs match; fail-open when tooling absent (WFI-01, WFI-02, ENF-03, v0.23-01)
- execute-phase + verifier formal integration: executor fires `run-formal-check.cjs` after wave completion; verifier receives real TLC/Alloy/PRISM stdout as ground truth; counterexample causes hard block with user-override audit trail; TDD scaffold with 4 plans (WFI-03, WFI-04, ENF-01, ENF-02, v0.23-02)
- Roadmapper formal integration: fixed keyword-match algorithm inconsistency between plan-phase and execute-phase (ISSUE-1); fixed gsd-tools goal regex at 3 occurrences (ISSUE-2); new-milestone scans formal specs and injects into roadmapper prompt; fail-open preserved (WFI-05, ENF-03, v0.23-03)
- Integration validation suite: 22-test integration script (`bin/test-formal-integration.test.cjs`) with zero mocking — all tests use real subprocess invocation via `spawnSync`; IVL-01 smoke/structural (5 tests), ENF-03 fail-open (2 tests), IVL-03 all-specs regression for 10 TLA+ modules (11 tests), IVL-02 full chain plan→execute→verify (4 tests) (IVL-01–03, v0.23-04)

**Audit:** PASSED — 11/11 requirements, 4/4 phases verified, 4/4 E2E flows complete
**Archive:** `.planning/milestones/v0.23-MILESTONE-AUDIT.md`

---


## v0.24 — Quorum Reliability Hardening (Shipped: 2026-03-03)

**Phases:** v0.24-01..v0.24-05 (5 phases, 17 plans)
**Requirements:** 12/12 (FAIL-01/02, DISP-01–05, OBS-01–03, HEAL-01/02)
**Git range:** 65119818..78dec73e (86 commits, 133 files changed, +19,811/−789 lines)
**Timeline:** 2026-03-02 → 2026-03-03 (2 days)

**Delivered:** Made quorum dispatch reliable end-to-end — every quorum call reliably delivers 3 votes by detecting dead slots pre-dispatch, self-healing around mid-session failures without user action, and providing observability into slot health, success rates, and flakiness. Slot worker token cost reduced from 22-25k to 11-12k per dispatch.

**Key accomplishments:**
- Provider infrastructure: explicit slot-to-provider mapping in providers.json; `retryWithBackoff` in call-quorum-slot.cjs retries 2x with 1s/3s exponential backoff before UNAVAIL recording; `getDownProviderSlots` skips all slots on a failed provider in one decision (FAIL-01, FAIL-02, v0.24-01)
- Live health dispatch: `triggerHealthProbe` runs 3s spawnSync probe pre-dispatch; `getAvailableSlots` reads scoreboard availability windows and excludes cooling-down slots; `sortBySuccessRate` + flakiness-aware ordering dispatches most reliable slots first (DISP-01–03, v0.24-02)
- Structured telemetry: `recordTelemetry` appends 10-field JSONL per dispatch (slot, round, verdict, latency_ms, provider_status, retry_count); `computeDeliveryStats` tracks 3/3 vs degraded 2/3 delivery rate; `computeFlakiness` scores trailing 10-round window with auto-deprioritization (OBS-01–03, v0.24-03)
- Self-healing consensus: `computeEarlyEscalation` uses Poisson binomial CDF to detect P(consensus) < 10% and fires escalation immediately; `suggestMaxDeliberation` + `applyMaxDeliberationUpdate` with atomic config rollback and --auto-apply flag for CI (HEAL-01, HEAL-02, v0.24-04)
- Slot worker thin passthrough: prompt construction (buildModeAPrompt/buildModeBPrompt) and output parsing (parseVerdict/parseCitations/parseImprovements) moved from Haiku agent to quorum-slot-dispatch.cjs; agent spec reduced to 29 content lines with 1 Bash call; per-worker cost 22-25k → 11-12k tokens (DISP-04, DISP-05, v0.24-05)

**Tests:** 240 tests GREEN (28 + 47 + 40 + 85 + 40 per phase), 0 regressions
**Formal:** 24/24 properties passed, 0 counterexamples

**Tech debt incurred:**
- Token floor ~10k (platform overhead) limits further reduction below 11-12k per worker
- SUMMARY frontmatter inconsistency: only v0.24-03 uses requirements_addressed field

**Audit:** PASSED — 12/12 requirements, 5/5 phases verified, 5/5 E2E flows, 12/12 cross-phase wirings
**Archive:** `.planning/milestones/v0.24-MILESTONE-AUDIT.md`

---


## v0.25 Formal Traceability & Coverage (Shipped: 2026-03-03)

**Phases completed:** 7 phases, 17 plans
**Requirements:** 18/18 satisfied (SCHEMA-01..04, TRACE-01..05, ANNOT-01..05, DECOMP-01..04)
**Audit:** tech_debt (all requirements met, bookkeeping debt accepted)
**Timeline:** 2026-03-03 (single day)
**Commits:** 70

**Key accomplishments:**
- Bidirectional requirement-model traceability — model-registry.json and requirements.json cross-linked (56 requirements, 24 models)
- Property-level @requirement annotations on all 43 formal model files (TLA+, Alloy, PRISM) with 207 requirement links
- Traceability matrix generator (generate-traceability-matrix.cjs) with property-level links and 63.8% coverage
- CI coverage guard (check-coverage-guard.cjs) detecting formal coverage regression against saved baseline
- State-space risk analysis (analyze-state-space.cjs) classifying 22 TLA+ models with unbounded domain flagging
- Annotation-resilient generators surviving spec-regen cycles (v0.25-06 gap closure)

**Known tech debt (accepted):**
- v0.25-06 missing VERIFICATION.md (requirements verified by v0.25-02/07)
- 10 SUMMARYs missing requirements-completed frontmatter field

---


## v0.26 — Operational Completeness (Shipped: 2026-03-04)

**Phases:** v0.26-01..v0.26-06 (6 phases, 11 plans)
**Requirements:** 16/16 (PLCY-01–03, CRED-01/02, PORT-01–03, PRST-01/02, REN-03, DASH-01–03, ARCH-10, DECOMP-05)
**Git range:** 41796066..59adc341 (90 commits, 106 files changed, +27,516/−3,318 lines)
**Timeline:** 2026-03-03 → 2026-03-04 (2 days)

**Delivered:** Closed all operational gaps in QGSD's agent management — per-slot policy configuration, batch credential rotation with persistent health status, portable roster export/import with provider presets, SDK bundling elimination with architecture linter enforcement, and cross-model decomposition analysis for formal verification state-space optimization.

**Key accomplishments:**
- Per-slot policy configuration: `validateTimeout` and `validateUpdatePolicy` pure functions with TUI integration; non-blocking `runAutoUpdateCheck` fires on startup for auto-policy slots (PLCY-01–03, v0.26-01)
- Credential management pipeline: `probeAndPersistKey` encapsulates probe-classify-write chain; `validateRotatedKeys` fire-and-forget post-rotation validation; key_status persists to qgsd.json across sessions (CRED-01/02, v0.26-02)
- Portable roster & presets: export replaces API keys with `__redacted__`; import validates schema and prompts for re-entry; deep-clone slot with metadata copy and key_status pruning; all `get-shit-done/` paths replaced with QGSD-native commands (PORT-01–03, PRST-01/02, REN-03, v0.26-03)
- Health dashboard coverage: 10 DASH-tagged tests for existing v0.10-04 dashboard implementation; formal coverage registry updated (DASH-01–03, v0.26-04)
- SDK bundling elimination: `@anthropic-ai/sdk` replaced with raw `https.request` in update-scoreboard.cjs and validate-requirements-haiku.cjs; `check-bundled-sdks.cjs` architecture linter with 17-test suite prevents re-introduction (ARCH-10, v0.26-05)
- Cross-model decomposition: 5 pure functions for requirement-prefix extraction, source-file intersection, merged state-space estimation, and merge/interface-contract recommendations; MERGE_BUDGET at 3M states (DECOMP-05, v0.26-06)

**Tests:** All existing tests GREEN, 0 regressions
**Formal:** Audit PASSED — 16/16 requirements, 6/6 phases, 6/6 integration checks, 8/8 E2E flows

**Tech debt incurred:**
- REQUIREMENTS.md tracking was stale for PLCY-03 (corrected during audit)
- v0.26-05 VERIFICATION.md and SUMMARY.md created during audit (phase executed in main context without subagent)
- Source file intersection in cross-model analysis is inert (model-registry source_files arrays empty) — requirement-prefix matching is active heuristic
- Raw HTTPS calls in update-scoreboard.cjs and validate-requirements-haiku.cjs use fail-open pattern (no retry) — intentional design

**Audit:** PASSED — 16/16 requirements satisfied
**Archive:** `.planning/milestones/v0.26-MILESTONE-AUDIT.md`

---


## v0.27 — Production Feedback Loop (Shipped: 2026-03-04)

**Phases:** v0.27-01..v0.27-05 (5 phases, 15 plans)
**Requirements:** 22/22 (DEBT-01–06, FP-01–04, OBS-01–08, PF-01–05)
**Git range:** cc81d679..6d309f87 (54 commits, 42 source files, 8,294 LOC)
**Timeline:** 2026-03-04 (single day)

**Delivered:** Closed the gap between QGSD's formal verification pipeline and production reality — a unified observe skill pulls production signals from GitHub, Sentry, Prometheus, Grafana, and Logstash; a fingerprint-deduplicating debt ledger tracks issues and drifts; and a P->F residual layer in solve compares formal model thresholds against observed production metrics with automatic remediation dispatch.

**Key accomplishments:**
- Debt ledger with JSON Schema validation, state machine enforcement (open→acknowledged→resolving→resolved), and retention policy archiving resolved entries older than max_age (DEBT-01, DEBT-03, DEBT-04, v0.27-01)
- Deterministic fingerprinting: hierarchical strategy for issues (exception type→function name→message hash), parameter key for drifts; both produce stable crypto hashes (FP-01, FP-02, v0.27-01)
- Pluggable observe skill: parallel source fetch with configurable timeout and fail-open behavior; dual-table output (Issues + Drifts); config in `.planning/observe-sources.md` YAML frontmatter (OBS-01, OBS-02, OBS-06–08, v0.27-02)
- Cross-source deduplication: fingerprint exact-match (O(n)) then Levenshtein near-duplicate (threshold 0.85); merge preserves source_entries and higher occurrence count; formal reference auto-linker (FP-03, FP-04, DEBT-02, DEBT-05, v0.27-03)
- Production source handlers: Prometheus (PromQL + alerts), Grafana (alert state mapping), Logstash (Elasticsearch query) — framework-ready stubs with full test coverage (OBS-03–05, v0.27-04)
- 8-layer solve pipeline: P->F residual reads acknowledged debt, compares against formal thresholds; two-track remediation — parameter updates via /nf:quick, investigation flags for regressions; freeze semantics prevent observe overwrites during solve (PF-01–05, v0.27-05)

**Tests:** 436+ tests GREEN, 0 regressions
**Formal:** 24/24 integration connections verified, 5/5 E2E flows complete

**Tech debt incurred:**
- v0.27-03/04/05 missing VERIFICATION.md (phases executed during auto-advance; code+tests verified manually)
- REQUIREMENTS.md traceability checkboxes never bulk-updated to [x] (cosmetic — all 22 reqs satisfied)

**Audit:** TECH_DEBT — 22/22 requirements satisfied, process documentation gaps accepted
**Archive:** `.planning/milestones/v0.27-MILESTONE-AUDIT.md`

---


## v0.28 Agent Harness Optimization (Shipped: 2026-03-06)

**Phases completed:** 25 phases, 71 plans, 34 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.29 — Three-Layer Formal Verification Architecture (Shipped: 2026-03-06)

**Phases:** v0.29-01..v0.29-06 (6 phases, 13 plans)
**Requirements:** 24/24 (EVID-01–05, SEM-01–04, RSN-01–05, GATE-01–04, INTG-01–06)
**Git range:** c57aa78e..3b79cb53 (68 commits, 280 files changed, +134,423/−1,673 lines)
**Timeline:** 2026-03-06 (single day)

**Delivered:** Organized nForma's 92+ formal models and 35K+ conformance traces into a three-layer architecture (Evidence, Semantics, Reasoning) connected by three inter-layer gates (Grounding, Abstraction, Validation) with quantitative alignment scores and a single-command cross-layer dashboard.

**Key accomplishments:**
- Layer 1 evidence foundation: 5 scripts (instrumentation-map, trace-corpus-stats, failure-taxonomy, state-candidates, event-vocabulary) cataloging 35K+ conformance traces with canonical vocabulary validation (EVID-01–05, v0.29-01)
- Layer 2 semantic grounding: operational FSM derived from trace replay (4 states, 16 transitions), invariant catalog (151 invariants from 3 sources), mismatch register (10 L2-vs-L1 disagreements), assumption register (567 entries) (SEM-01–04, v0.29-02)
- Gate A grounding score: 82.2% alignment (29,476/35,845 traces explained), target >= 80% MET; all 6,369 unexplained traces classified as instrumentation_bug (GATE-01, v0.29-02)
- Layer 3 hazard analysis: FMEA methodology (Severity x Occurrence x Detection = RPN) applied to L2 state machine; failure mode catalog with effects and severity; risk heatmap ranked by RPN + coverage gaps (RSN-01–03, v0.29-03)
- Gate B abstraction enforcement + Gate C validation: every L3 artifact traces to L2 sources (zero orphans); 32 test recipes generated from failure modes with Gate C score 1.0 (GATE-02–04, RSN-04, v0.29-04)
- Cross-layer dashboard + pipeline integration: single terminal view aggregating L1 coverage %, Gate A/B/C scores; nf-solve gains 3 layer sweeps (L1->L2, L2->L3, L3->TC); run-formal-verify gains 3 gate step groups; design impact analysis traces git diffs through all 3 layers (INTG-01–06, RSN-05, v0.29-04/05)
- Tech debt closure: fixed nf-solve data contract mismatch and exit-code handling; synced 14 stale REQUIREMENTS.md checkboxes (v0.29-06)

**Tests:** 268 tests GREEN, 0 regressions
**Formal:** 24/24 integration connections verified, 5/5 E2E flows complete

**Tech debt incurred:**
- Pre-existing TLC counterexamples (deliberation:tlc, oscillation:tlc)
- state-candidates.json is informational only (no downstream consumer)
- 567 untested assumptions in assumption-register.json
- 6,369 instrumentation_bug traces (unmapped actions like quorum_fallback_t1_required)

**Audit:** PASSED — 24/24 requirements, 6/6 phases, 268 tests, 5/5 E2E flows
**Archive:** `.planning/milestones/v0.29-MILESTONE-AUDIT.md`

---


## v0.30 — Advanced Agent Patterns (Shipped: 2026-03-08)

**Phases:** v0.30-01..v0.30-09 (9 phases, 17 plans)
**Requirements:** 20/20 (TOKN-01–04, VERF-01–03, MEMP-01–04, LRNG-01–04, ORCH-01–03, PARA-01–02)
**Git range:** 2011f934..bd815c69 (1,096 files changed, +195,524/−21,231 lines)
**Timeline:** 2025-12-14 → 2026-03-08 (84 days)

**Delivered:** Built nForma's advanced agent infrastructure — dynamic model selection with task-complexity routing, file-based execution state that survives compaction, JSONL memory persistence across sessions, continuous learning with session-end extraction, continuous verification with boundary-detection triggers, domain-specific context retrieval for subagent orchestration, and worktree-isolated parallel plan execution with merge coordination.

**Key accomplishments:**
- Dynamic model selection: task-classifier.cjs with COMPLEXITY_MAP for T1/T2/T3 tier routing; thinking budget scaling per task type; TIER_SLOT_MAP slot filtering in quorum dispatch (TOKN-01–04, v0.30-01)
- File-based execution state: execution-progress.cjs tracks plan/task completion to disk; nf-precompact.js injects state across compaction events; termination guards (iteration cap 5, stuck detection 3) prevent runaway execution (VERF-01, v0.30-02)
- JSONL memory persistence: memory-store.cjs with 6 categories (decisions, errors, quorum, corrections, skills, failures); bidirectional substring dedup; character-capped injection formatting; session reminders via SessionStart hook (MEMP-01–04, v0.30-03)
- Continuous learning pipeline: learning-extractor.cjs extracts error patterns and corrections from transcripts; skill-extractor.cjs generates skill candidates; confidence scoring with weekly decay and reconfirmation boost; nf-session-end.js wires the full pipeline at session close (LRNG-01–04, v0.30-04/08/09)
- Continuous verification: continuous-verify.cjs with boundary-detection triggers, done_conditions evaluator, and 3-run budget cap per phase; gsd-context-monitor.js PostToolUse hook integration (VERF-02–03, v0.30-05)
- Subagent orchestration: context-retriever.cjs with domain-specific retrieval (keyword-based domain detection, PATH_CATEGORY_MAP); context-stack.cjs for cross-phase JSONL accumulation and injection into quorum dispatch (ORCH-01–03, v0.30-06)
- Worktree-isolated parallel execution: nf-worktree-executor agent with git worktree isolation; worktree-merge.cjs for merge orchestration with rollback; Pattern D in execute-plan.md for opt-in parallel dispatch; SERIAL_FILES detection prevents parallel on shared files (PARA-01–02, v0.30-07)

**Gap closure:** 3 phases (v0.30-07, v0.30-08, v0.30-09) executed after initial audit (14/20) and re-audit (17/18); final audit 20/20

**Audit:** PASSED — 20/20 requirements, 9/9 phases, 19/20 integration points, 7/7 E2E flows
**Archive:** `.planning/milestones/v0.30-MILESTONE-AUDIT.md`

---


## v0.31 — Ruflo-Inspired Hardening (Shipped: 2026-03-08)

**Phases:** v0.31-01..v0.31-03 (3 phases, 7 plans)
**Requirements:** 8/8 (PRIO-01, VALID-01, BRKR-01, LTCY-01, EXEC-01, SHARD-01, ADAPT-01, ADR-01)
**Git range:** b0eddc38..e56b4892 (103 commits)
**Timeline:** 2026-03-08 (~10.5 hours)

**Delivered:** Hardened nForma's hook and quorum infrastructure with ruflo-inspired patterns — deterministic hook execution ordering, JSON schema validation for hook stdin, cross-session oscillation memory, per-slot latency budgets, review-only tool restriction for quorum workers, rule relevance sharding, bidirectional config adapter, and structured debate templates.

**Key accomplishments:**
- Hook input validation: validateHookInput with per-event-type HOOK_INPUT_SCHEMAS across all 14 hooks; structured stderr diagnostics, fail-open behavior (PRIO-01, VALID-01, v0.31-01)
- Hook priority ordering: DEFAULT_HOOK_PRIORITIES with Critical=1000/Normal=50/Low=10 tiers; sortHooksByPriority in install.js; circuit-breaker always first (PRIO-01, v0.31-01)
- Oscillation evidence persistence: writeEvidenceSignature/checkPreemptiveEvidence/markEvidenceResolved; 50-entry cap with 30-day prune; warn-only preemptive detection (BRKR-01, v0.31-02)
- Per-slot latency budgets: latency_budget_ms in providers.json as hard ceiling over --timeout; TIMEOUT in telemetry; 0/negative = not set (LTCY-01, v0.31-02)
- Review-only tool restriction: structural --allowedTools for ccr slots, prompt-level READ-ONLY for non-ccr; review_mode flag in nf-prompt (EXEC-01, v0.31-02)
- Rule sharding: paths: YAML frontmatter on all 4 .claude/rules/ files for per-turn selective loading (SHARD-01, v0.31-03)
- Config write adapter: normalizeConfigValue, flattenNestedKeys, nestFlatKeys, writeConfig; boolean/profile/tier normalization; 17 new tests (ADAPT-01, v0.31-03)

**Tech debt:** 4 items (var hoisting, duplicated functions, adapter has no runtime consumer, debate formatter standalone only)

**Audit:** PASSED — 8/8 requirements, 3/3 phases, 8/8 integration points, 5/5 E2E flows
**Archive:** `.planning/milestones/v0.31-MILESTONE-AUDIT.md`

---


## v0.32 — Documentation & README Overhaul (Shipped: 2026-03-09)

**Phases:** v0.32-01..v0.32-04 (4 phases, 4 plans)
**Requirements:** 14/14 (RDME-01–10, GUIDE-01–02, VIS-01–02)
**Git range:** 8bb02f74..ed9fd747 (35 commits, 55 files changed, +6,901/−390 lines)
**Timeline:** 2026-03-09 (single day)

**Delivered:** Complete documentation overhaul — README restructured with TUI hero, value props, comparison table, metrics, architecture diagram, and community section above-the-fold; User Guide rebuilt with step-by-step Getting Started walkthrough and 10 TUI screenshots; all 11 TUI screenshots regenerated via hardened VHS automation with determinism verification.

**Key accomplishments:**
- README above-the-fold restructure: TUI hero screenshot promoted from collapsible to visible section, "Who This Is For" with 4 problem-framing bullets, "With vs. Without" comparison table, "By the Numbers" 6-metric grid, "What's New in v0.32" changelog, expanded nav bar with 8 anchor links (RDME-01–04, RDME-06–07, v0.32-01)
- README deep sections: Mermaid architecture diagram in How It Works (6-node flowchart), Community section with Discord CTA before Star History, Getting Started rebalanced with critical path visible by default, Observability table fixed with solve screenshot after table; 10-test structural suite (RDME-05, RDME-08–10, v0.32-02)
- User Guide overhaul: 4-step Getting Started walkthrough (Install, Quorum Setup, First Command, Start a Project) with 5 screenshots; 5 feature sections each with TUI screenshot and caption; 9-test structural suite (GUIDE-01–02, v0.32-03)
- Visual asset regeneration: 11 TUI screenshots regenerated via VHS tape with dynamic Claude Code path resolution (no hardcoded versions); 8/9 static screenshots byte-identical across runs; orphaned SVGs cleaned up (VIS-01–02, v0.32-04)

**Tests:** 19 structural tests GREEN (10 readme + 9 user-guide), 0 regressions

**Tech debt incurred:**
- 1 orphaned screenshot (tui-modal-settings.png generated but unreferenced)
- Pre-existing TUI runtime bug in tui-agents-health.png ("Error: nf is not defined")

**Audit:** PASSED — 14/14 requirements, 4/4 phases, 14/14 integration points, 5/5 E2E flows
**Archive:** `.planning/milestones/v0.32-MILESTONE-AUDIT.md`

---


## v0.33 — Outer-Loop Convergence Guarantees (Shipped: 2026-03-10)

**Phases:** v0.33-01..v0.33-06 (6 phases, 12 plans)
**Requirements:** 17/17 (TRACK-01–04, OSC-01–03, PRED-01/02, STAB-01–03, FV-01–03, INTG-01/02)
**Git range:** ~191 commits
**Timeline:** 2026-03-09 → 2026-03-10 (2 days)

**Delivered:** Provably guaranteed that repeated nf:solve cycles make meaningful progress — cross-session JSONL tracking with scope-growth detection, Mann-Kendall trend analysis with Option C oscillation breaking, gate promotion stabilization with cooldown enforcement, bug-to-property predictive power scoring, TLA+ formal verification of outer loop safety and liveness (259,794 states, zero counterexamples), and convergence sparkline reporting with Haiku-based escalation classification.

**Key accomplishments:**
- Cross-session solve history: solve-trend-helpers.cjs appends JSONL snapshots with per-layer residuals, scope_change tagging (SCOPE_GROWTH vs regression), and changelog deduplication guard removing 164 duplicates (TRACK-01, TRACK-04, STAB-03, v0.33-01)
- Oscillation detection: oscillation-detector.cjs with Mann-Kendall non-parametric trend test, Option C credit-based blocking (1 credit per layer), cascade-aware grace periods via LAYER_DEPS upstream DAG; autoClose() gating in nf-solve.cjs skips blocked layers with human escalation (TRACK-02, OSC-01, OSC-02, v0.33-02)
- Gate stabilization: gate-stability.cjs with flip-flop detection (3+ direction changes = UNSTABLE), cooldown enforcement (3 sessions AND 1 hour), --write-per-model default in sweepPerModelGates; schema bumped to v3 with stability fields (STAB-01, STAB-02, INTG-01, v0.33-03)
- Predictive power: bug-to-property.cjs linking observed bugs to formal properties via requirement ID overlap; per-model recall scoring as informational metric; convergence-velocity.cjs with linearized OLS exponential decay fit (PRED-01, PRED-02, TRACK-03, v0.33-04)
- TLA+ meta-verification: NFSolveConvergence.tla with cross-session state, Option C blocking rule (>= 1), gate maturity transitions; TLC verified OscillationBounded safety (259,794 states, 0 counterexamples) and EventualConvergence liveness under WF_vars fairness; ProgressSession/RegressSession split for correct fairness modeling (FV-01, FV-02, FV-03, v0.33-05)
- Convergence reporting: convergence-report.cjs with ASCII sparklines, oscillation status badges, top-3 action items; escalation-classifier.cjs with Haiku classification (GENUINE_REGRESSION/MEASUREMENT_NOISE/INSUFFICIENT_EVIDENCE) and structured context (OSC-03, INTG-02, v0.33-06)

**Tests:** 1,284+ tests GREEN, 0 regressions
**Formal:** TLC safety + liveness verified, 259,794 states explored, zero counterexamples

**Audit:** TECH_DEBT — 17/17 requirements satisfied; tech debt items (3 missing VERIFICATION.md, unchecked checkboxes) remediated before archival
**Archive:** `.planning/milestones/v0.33-MILESTONE-AUDIT.md`

---


## v0.34 — Semantic Gate Validation & Auto-Promotion (Shipped: 2026-03-11)

**Phases:** v0.34-01..v0.34-06 (6 phases, 9 plans)
**Requirements:** 18/18 satisfied (NAME-01..04, SEM-01..05, PAIR-01..04, PROMO-01..05)
**Timeline:** ~9 hours (2026-03-11)

**Delivered:** Evolved gate scoring from structural wiring checks to semantic correctness validation using graph-based proximity discovery and LLM-judged candidate pairing, with auto-promotion wired into the solve cycle.

**Key accomplishments:**
- Gate renaming from A/B/C to Wiring:Evidence/Purpose/Coverage with schema v2, backward compatibility (21 compat tests), and display label migration across TUI, solve report, and dashboard
- Graph-based semantic scoring via BFS proximity discovery (46 candidates across 62K pair checks) and Haiku LLM evaluation with yes/no/maybe verdicts producing per-gate semantic_score (schema v3)
- N:N candidate pairing workflow with interactive resolution and model-registry integration (46 pairings confirmed across 14 models), rejected-pairing caching for idempotency
- Auto-promotion pipeline: SOFT_GATE -> HARD_GATE after 3 consecutive clean sessions (wiring >= 1.0, semantic >= 0.8, no counterexamples), with flip-flop detection and cooldown enforcement
- Pipeline wiring: compute-semantic-scores.cjs integrated into nf-solve.cjs, compute-per-model-gates.cjs preserves semantic_score across gate rewrites
- E2E integration test suite: 5 tests validating enrichment, idempotency, 3-cycle promotion, regression reset, and PROMO-04 changelog field compliance

**Audit:** PASSED — 18/18 requirements, 3/3 integration checks, 2/2 E2E flows
**Archive:** `.planning/milestones/v0.34-MILESTONE-AUDIT.md`

---


## v0.35 Install & Setup Bug Fixes (Shipped: 2026-03-13)

**Phases:** v0.35-01..v0.35-04 (4 phases, 4 plans, 8 tasks)
**Requirements:** 8/8 satisfied (INST-01/02, SETUP-01/02, XPLAT-01/02, TUI-01/02)
**Timeline:** ~2 days (2026-03-12 → 2026-03-13)

**Delivered:** Fixed four user-facing bugs (GitHub #4-#7) affecting install, setup, cross-platform paths, and TUI agent configuration.

**Key accomplishments:**
- Auto-rebuild hooks/dist on fresh clone install — buildHooksIfMissing() delegates to scripts/build-hooks.js with actionable error messages on failure
- Declarative auth_type slot classification in providers.json — replaces name-prefix inference for T1/T2 tiered dispatch; wired into mcp-setup first-run and re-run flows
- Cross-platform CLI path resolution via resolveCli() — multi-strategy discovery (which, Homebrew, npm global, system paths) replaces hardcoded /opt/homebrew/bin/ paths in unified-mcp-server.mjs and call-quorum-slot.cjs
- TUI CLI Agent MCP entry parity — "Add Agent → CLI Agent" resolves paths via resolveCli(), validates executability via fs.accessSync, and writes MCP entries matching mcp-setup format

**Audit:** PASSED — 8/8 requirements, 37/37 tests, integration clean
**Archive:** `.planning/milestones/v0.35-MILESTONE-AUDIT.md`

---


## v0.36 Solve Loop Convergence & Correctness (Shipped: 2026-03-15)

**Phases completed:** 33 phases, 57 plans, 15 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.37 Close the Loop: Cross-Layer Feedback Integration (Shipped: 2026-03-17)

**Phases completed:** 38 phases, 64 plans, 15 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.38 Model-Driven Debugging (Shipped: 2026-03-18)

**Phases completed:** 43 phases, 75 plans, 15 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.39 Dual-Cycle Formal Reasoning (Shipped: 2026-03-18)

**Phases completed:** 46 phases, 83 plans, 27 tasks

**Key accomplishments:**
- (none recorded)

---

