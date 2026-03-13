# QGSD

## What This Is

QGSD is a Claude Code plugin extension that moves multi-model quorum enforcement from CLAUDE.md behavioral policy into structural Claude Code hooks. It installs on top of GSD without modifying it, adding a hook-based quorum layer: a UserPromptSubmit hook injects quorum instructions at the right moment, a Stop hook verifies quorum actually happened by parsing the conversation transcript before allowing Claude to deliver planning output, and a PreToolUse circuit breaker hook detects oscillation in git history and blocks Bash execution when repetitive patterns emerge. When the circuit breaker fires, a structured oscillation resolution mode guides quorum diagnosis and unified solution approval. An activity sidecar tracks every workflow stage transition so `resume-work` can recover to the exact interrupted step. An autonomous milestone execution loop (v0.13) closes the end-to-end chain: the last-phase transition detects gap-closure phases and routes to re-audit via IS_GAP_CLOSURE detection, audit-milestone auto-spawns plan-milestone-gaps when gaps are found, and all human confirmation gates are replaced with R3 quorum consensus — enabling zero-AskUserQuestion autonomous operation from new-milestone through complete-milestone. Formal verification (v0.20) is now an active planning gate: TLA+ runs at plan-phase step 8.2 surfacing failures as hypotheses, sensitivity sweeps inject top-3 high-impact parameters into quorum `review_context`, FV results appear in every VERIFICATION.md, and a UPPAAL timed automaton model captures quorum race timing. The FV pipeline is self-calibrating (v0.21): PRISM auto-calibrates from the scoreboard, specs auto-regenerate when XState changes, debug sessions mine invariant candidates, every plan is TLC-verified before quorum sees it, and operational signals (coverage gaps, Petri net dependencies, PRISM failure probabilities, Poisson binomial consensus gate) drive roadmap prioritization. Formal verification is now an enforcing gate (v0.23): plan-phase discovers and injects formal invariants, execute-phase runs TLC/Alloy/PRISM and hard-blocks on counterexamples with traceable user override, the roadmapper reads invariants when designing phases, and a 22-test integration suite proves the full chain fires end-to-end with real tool output. Quorum dispatch is reliability-hardened (v0.24): providers.json maps slots to backing providers, failed calls retry with exponential backoff, pre-dispatch health probes skip dead providers, scoreboard-driven availability windows and success-rate ordering select the most reliable slots first, per-round structured telemetry enables flakiness scoring and deprioritization, early escalation fires when P(consensus) drops below threshold, and the slot worker is a thin JavaScript passthrough (11-12k tokens vs 22-25k). Formal traceability (v0.25) connects human requirements to formal models with bidirectional queryable links: model-registry.json and requirements.json carry cross-referenced requirement arrays, @requirement annotations on all 43 formal model files feed an extraction parser, a traceability matrix generator produces property-level links with 63.8% coverage, a CI coverage guard prevents silent regression, and a state-space analyzer classifies 22 TLA+ models for decomposition risk. Operational completeness (v0.26) closes all remaining agent management gaps: per-slot quorum timeout and update policy configuration with input validation, batch API key rotation with persistent health status across sessions, portable roster export/import with provider presets and slot cloning, SDK bundling elimination with an architecture linter that prevents re-introduction, and cross-model decomposition analysis that recommends TLA+ model merges or flags interface contracts based on shared requirements and source files. Production feedback (v0.27) closes the loop between formal models and production reality: a unified observe skill (`/qgsd:observe`) pulls production signals from GitHub, Sentry, Prometheus, Grafana, and Logstash in parallel; a fingerprint-deduplicating debt ledger tracks issues and drifts with state machine enforcement; and a P->F residual layer in solve compares formal model thresholds against observed production metrics with two-track automatic remediation (parameter updates via `/qgsd:quick`, investigation flags for regressions). Agent harness optimization (v0.28) adds configurable hook profiles (minimal/standard/strict), SHA-256 quorum response caching with git-HEAD invalidation, token budget monitoring with auto-downgrade at 85%, stall detection for timed-out slots, smart compaction suggestions at workflow boundaries, security sweep scanning at verification time, session state reminders on new sessions, and a unified harness diagnostic tool. A three-layer formal verification architecture (v0.29) organizes 92+ formal models and 35K+ conformance traces into Evidence, Semantics, and Reasoning layers connected by three inter-layer gates (Grounding, Abstraction, Validation) with quantitative alignment scores — Gate A grounding 82.2%, Gate C validation 1.0 — and a single-command cross-layer dashboard integrated into nf-solve and run-formal-verify.

Profile: cli

## Core Value

Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## Shipped: v0.35 — Install & Setup Bug Fixes (2026-03-13)

**Goal:** Fix 4 GitHub-reported bugs (GitHub #4-#7) in installer, MCP setup, provider paths, and TUI agent creation.

**Shipped:** 8/8 requirements satisfied across 4 phases, 4 plans. Audit: PASSED.

**Key features shipped:**
- Auto-rebuild hooks/dist on fresh clone install via buildHooksIfMissing() with actionable error messages
- Declarative auth_type slot classification in providers.json replacing name-prefix inference for T1/T2 dispatch
- Cross-platform CLI path resolution via resolveCli() multi-strategy discovery (which, Homebrew, npm, system paths)
- TUI CLI Agent MCP entry parity — resolves paths, validates executability, matches mcp-setup format

## Shipped: v0.34 — Semantic Gate Validation & Auto-Promotion (2026-03-11)

**Goal:** Evolve gate scoring from structural wiring checks to semantic correctness validation using graph-based proximity discovery and LLM-judged candidate pairing, then wire auto-promotion into the solve cycle.

**Shipped:** 18/18 requirements satisfied across 6 phases, 9 plans. Audit: PASSED.

**Key features shipped:**
- Gate renaming — A/B/C to Wiring:Evidence/Purpose/Coverage with schema v2, full backward compatibility (21 compat tests)
- Semantic scoring — graph BFS proximity discovery (46 candidates) + Haiku LLM evaluation with yes/no/maybe verdicts
- Gate enrichment — enrichGateFile() produces schema v3 with semantic_score alongside wiring_score, preserved across gate rewrites
- Candidate pairing — N:N interactive resolution workflow, 46 pairings confirmed across 14 models in model-registry.json
- Auto-promotion pipeline — SOFT_GATE -> HARD_GATE after 3 consecutive clean sessions (wiring >= 1.0, semantic >= 0.8, formal pass) with flip-flop protection
- Promotion changelog — all promotions logged with 8 PROMO-04 fields including evidence_readiness
- E2E integration test — 5 tests validating full semantic scoring -> auto-promotion pipeline

## Shipped: v0.33 — Outer-Loop Convergence Guarantees (2026-03-10)

**Goal:** Provably guarantee that repeated nf:solve cycles make meaningful progress toward formal models that can pinpoint bugs.

**Shipped:** 17/17 requirements satisfied across 6 phases, 12 plans. Audit: TECH_DEBT (remediated).

**Key features shipped:**
- Cross-session solve history — JSONL trend persistence with scope-growth detection and changelog deduplication
- Oscillation detection — Mann-Kendall trend analysis with Option C credit-based blocking and cascade-aware grace periods
- Gate stabilization — Flip-flop detection (3+ direction changes = UNSTABLE) and cooldown enforcement (3 sessions AND 1 hour)
- Predictive power — Bug-to-property linking and per-model recall scoring; convergence velocity estimation via exponential decay fit
- TLA+ meta-verification — NFSolveConvergence.tla with TLC-verified safety (OscillationBounded) and liveness (EventualConvergence), 259,794 states, zero counterexamples
- Convergence reporting — ASCII sparklines, oscillation status, top-3 action items; Haiku-based escalation classification

## Shipped: v0.32 — Documentation & README Overhaul (2026-03-09)

**Goal:** Complete documentation overhaul — README restructured for immediate value communication, User Guide rebuilt with visual walkthrough, all screenshots regenerated via automation.

**Shipped:** 14/14 requirements satisfied across 4 phases, 4 plans. Audit: PASSED.

**Key features shipped:**
- README above-the-fold restructure — TUI hero, "Who This Is For" problem bullets, "With vs. Without" comparison, "By the Numbers" metrics, changelog, expanded 8-link nav bar
- README deep sections — Mermaid architecture diagram, Community section with Discord CTA, Getting Started rebalanced, Observability table fixed
- User Guide overhaul — 4-step Getting Started walkthrough with 5 screenshots, 5 feature sections each with TUI screenshot
- Visual asset regeneration — 11 TUI screenshots via hardened VHS tape with dynamic path resolution and determinism verification

## Shipped: v0.31 — Ruflo-Inspired Hardening (2026-03-08)

**Goal:** Harden nForma's hook and quorum infrastructure with ruflo-inspired patterns.

**Shipped:** 8/8 requirements satisfied across 3 phases, 7 plans. Audit: PASSED.

**Key features shipped:**
- Hook input validation — per-event-type JSON schema validation for all 14 hooks with fail-open behavior
- Hook priority ordering — deterministic Critical/Normal/Low tiers; circuit-breaker always first
- Oscillation evidence persistence — cross-session signature memory with preemptive warnings
- Per-slot latency budgets — hard ceiling in providers.json, TIMEOUT in telemetry
- Review-only tool restriction — structural --allowedTools for ccr, prompt-level for non-ccr
- Rule sharding — paths: frontmatter on .claude/rules/ for per-turn selective loading
- Config write adapter — bidirectional nested/flat key conversion with normalization

## Shipped: v0.30 — Advanced Agent Patterns (2026-03-08)

**Goal:** Integrate advanced Claude Code agent patterns — dynamic token optimization, cross-session memory persistence, continuous learning with skill extraction, file-based continuous verification, iterative subagent orchestration, and worktree-isolated parallel execution.

**Shipped:** 20/20 requirements satisfied across 9 phases (including 3 gap-closure phases). Audit: PASSED (3 iterations: 14/20 → 17/18 → 20/20).

**Key features shipped:**
- Dynamic Model Selection — task classifier, TIER_SLOT_MAP slot filtering, thinking_budget_scaling, /nf:tokens dashboard, 65% smart compaction with quorum lockout
- File-Based Execution State — execution-progress.cjs with compaction injection, iteration cap, stuck detection
- Memory Persistence — memory-store.cjs with 6 JSONL categories, session reminders, compaction snapshots
- Continuous Learning — learning-extractor for error patterns + corrections, SessionEnd hook, skill-extractor CLI, confidence scoring with decay
- Continuous Verification — boundary-batched checks (max 3/phase, 5s timeout), done_conditions evaluator, advisory warnings
- Subagent Orchestration — domain-specific context retrieval, phase context stack, pre-dispatch enrichment
- Worktree Parallelization — nf-worktree-executor agent, worktree-merge.cjs, Pattern D parallel dispatch, SERIAL_FILES detection

## Shipped: v0.29 — Three-Layer Formal Verification Architecture (2026-03-06)

**Goal:** Build a grounded formal verification chain — observed code behavior → structured operational model → analytical model for risk, failure reasoning, test generation, and design evaluation — with measurable cross-layer alignment gates that prevent model drift from reality.

**Shipped:** 24/24 requirements satisfied (EVID-01–05, SEM-01–04, RSN-01–05, GATE-01–04, INTG-01–06). 6 phases, 13 plans, 268 tests. Audit: PASSED.

**Key features shipped:**
- Three-layer architecture (Evidence, Semantics, Reasoning) organizing 92+ formal models with layer manifest and model registry
- Layer 1 evidence scripts cataloging 35K+ conformance traces with canonical event vocabulary
- Layer 2 operational FSM, invariant catalog (151), mismatch register, assumption register grounded in observed traces
- Gate A grounding score 82.2% (target >= 80% MET) quantifying L2-L1 alignment
- Layer 3 FMEA hazard model, failure mode catalog, risk heatmap with Gate B traceability enforcement
- 32 model-driven test recipes from failure modes with Gate C validation score 1.0
- Cross-layer alignment dashboard with nf-solve layer sweeps and run-formal-verify gate integration
- Design impact analysis tracing git diffs through all three layers

## Shipped: v0.28 — Agent Harness Optimization (2026-03-06)

**Goal:** Improve nForma's agent harness reliability, cost efficiency, and developer experience — configurable hook profiles, quorum response caching, budget-aware model downgrade, stall detection, smart compaction, security sweep, session state reminders, and unified harness diagnostics.

**Shipped:** 27/27 requirements satisfied (PROF-01–04, CLEAN-01–02, CACHE-01–04, PASSK-01–02, BUDG-01–03, STALL-01–02, SMART-01–02, SEC-01–03, STATE-01–02, DIAG-01–03). 4 phases, 12 plans, 46 commits. Audit: TECH_DEBT (accepted).

**Key features shipped:**
- Configurable hook profiles — minimal/standard/strict modes with hot-reload, per-hook shouldRunHook guards
- SHA-256 quorum response caching — cache hit/miss with git-HEAD and TTL invalidation, conformance event logging
- Pass@k consensus efficiency — deliberation round counting, pass@1/pass@3/avg_k reporting in health checks
- Token budget monitoring — 60% warning injection, 85% auto-downgrade (quality→balanced→budget), subscription slot exclusion
- Stall detection — consecutive timeout tracking per slot, structured stall reports, diagnostic-time escalation
- Smart compaction — workflow boundary detection, /compact suggestions with survive/lost content listing
- Security sweep scanner — regex-based secret/key/debug detection with file:line references, advisory-only
- Session state reminders — parseStateForReminder on SessionStart, terse context injection for session resumption
- Unified harness diagnostic — single-command health report (slots, pass@k, budget, stalls, circuit breaker, recommendations)
- Post-verification cleanup subagent — Haiku-based code quality review after successful phase verification

## Shipped: v0.27 — Production Feedback Loop (2026-03-04)

**Goal:** Close the loop between formal models and production reality — a unified observe skill surfaces issues and metric drifts from production tools, a debt ledger deduplicates and aggregates them with human triage, and solve gains a P→F residual layer that remediates acknowledged debt as part of its convergence cycle.

**Shipped:** 22/22 requirements satisfied (DEBT-01–06, FP-01–04, OBS-01–08, PF-01–05). 5 phases, 15 plans, 436+ tests, 54 commits. Audit: TECH_DEBT (accepted).

**Key features shipped:**
- Unified observe skill — `/qgsd:observe` with pluggable source handlers (GitHub, Sentry, Prometheus, Grafana, Logstash, bash), parallel fetch, dual-table output (Issues + Drifts), and config in `.planning/observe-sources.md`
- Debt ledger — `.formal/debt.json` with JSON Schema validation, fingerprint-based dedup (exact + Levenshtein near-duplicate), state machine (open→acknowledged→resolving→resolved), retention policy, and formal reference auto-linking
- Solve P→F integration — 8th residual layer reads acknowledged debt, compares against formal thresholds, dispatches remediation via two-track heuristic (parameter updates via `/qgsd:quick`, investigation flags for regressions), freeze semantics prevent observe overwrites during solve
- Fingerprinting engine — hierarchical for issues (exception type→function→message hash), parameter key for drifts, cross-source dedup with configurable similarity threshold

## Shipped: v0.26 Operational Completeness (2026-03-04)

**Goal:** Close the remaining operational gaps — portable installer, credential management, policy configuration, dashboard UI, architecture constraints, and cross-model decomposition analysis.

**Shipped:** 16/16 requirements satisfied (PLCY-01–03, CRED-01/02, PORT-01–03, PRST-01/02, REN-03, DASH-01–03, ARCH-10, DECOMP-05). 6 phases, 11 plans, 90 commits. Audit PASSED.

**Key features shipped:**
- Per-slot policy configuration — quorum timeout and update policy with input validation and auto-update on startup
- Credential management — batch rotation with persistent health status; fire-and-forget post-rotation validation
- Portable roster — export/import with redacted keys, provider presets, slot cloning, all GSD paths eliminated
- Health dashboard — test coverage closure for existing v0.10-04 implementation (10 DASH-tagged tests)
- Architecture enforcement — SDK imports replaced with raw HTTPS; architecture linter with 17-test suite
- Cross-model decomposition — pair detection, merged state-space estimation, merge/interface-contract recommendations

## Shipped: v0.25 Formal Traceability & Coverage (2026-03-03)

**Goal:** Connect human requirements to formal models with bidirectional, queryable traceability — answer "which specs verify requirement X?" and "which requirements broke?" when a check fails.

**Shipped:** 18/18 requirements satisfied (SCHEMA-01..04, TRACE-01..05, ANNOT-01..05, DECOMP-01..04). 7 phases, 17 plans, 70 commits. Audit: tech_debt (accepted).

**Key features shipped:**
- Schema foundation — `requirement_ids[]` in model-registry and check-result schema; 18 runners emit requirement attribution via centralized requirement-map.cjs
- Property annotations — `@requirement` tags on all 43 formal model files (TLA+, Alloy, PRISM); extract-annotations.cjs parser (188 properties, 207 links)
- Traceability matrix — `bin/generate-traceability-matrix.cjs` produces property-level links with 63.8% coverage
- Bidirectional validation — asymmetric link detection + CI coverage guard (check-coverage-guard.cjs)
- Decomposition awareness — state-space risk analysis (22 TLA+ models), coverage preservation on splits
- Annotation resilience — generators embed @requirement in templates; spec-regen hook preserves annotations

## Shipped: v0.24 Quorum Reliability Hardening (2026-03-03)

**Goal:** Make quorum dispatch reliable end-to-end — every quorum call reliably delivers 3 votes by detecting dead slots pre-dispatch, self-healing around mid-session failures without user action, and providing observability into slot health, success rates, and flakiness.

**Shipped:** 12/12 requirements satisfied (FAIL-01/02, DISP-01–05, OBS-01–03, HEAL-01/02). 5 phases, 17 plans, 240 tests, 24/24 formal properties. Audit PASSED.

**Key features shipped:**
- Provider infrastructure — explicit slot-to-provider mapping; retry-with-backoff (2x, 1s/3s); provider-level skip on DOWN probe
- Dispatch reliability — 3s health probes, availability window filtering, success-rate + flakiness-aware ordering
- Observability — 10-field JSONL telemetry, delivery rate tracking, flakiness scoring with deprioritization
- Self-healing — Poisson binomial early escalation, maxDeliberation auto-adjust with atomic rollback
- Slot worker thin passthrough — prompt construction + output parsing in JS; 22-25k → 11-12k tokens per worker

## Shipped: v0.23 Formal Gates (2026-03-02)

**Goal:** Make TLC/Alloy/PRISM actual enforcing gates in every major QGSD workflow step — plan-phase, execute-phase, qgsd-verifier, and qgsd-roadmapper all run the model checkers and hard-block on counterexamples, with an integration test suite that proves the entire chain fires end-to-end.

**Shipped:** 11/11 requirements satisfied (WFI-01–05, ENF-01–03, IVL-01–03). 4 phases, 12 plans, 88 files, +12.8k lines. Audit PASSED.

## Previous Milestone: v0.22 Requirements Envelope (in progress)

**Goal:** Promote milestone requirements from a working document (`.planning/REQUIREMENTS.md`) into a validated, immutable formal artifact (`.formal/requirements.json`) that constrains what formal specs must prove — a Haiku validation pass catches duplicates, conflicts, and ambiguity before freezing, and modifications require explicit user consent.

**Target features:**
- Requirements aggregation — `new-milestone` compiles all phase requirements into `.formal/requirements.json` (structured, machine-readable) after roadmap creation
- Haiku validation gate — lightweight model reviews the full set for semantic duplicates, contradictions, and ambiguity; results presented to user for resolution before freezing
- Formal constraint binding — `generate-phase-spec.cjs` reads the envelope as source of truth for PROPERTY generation; specs that contradict frozen requirements are flagged as violations
- Immutability contract — hook/pre-commit guard blocks automated modifications to `.formal/requirements.json`; amendment workflow requires user approval + re-validation
- Drift detection — checker warns when `.planning/REQUIREMENTS.md` diverges from the frozen envelope; legitimate changes route through the amendment workflow

## Just Shipped: v0.21 FV Closed Loop (2026-03-01)

**Goal:** Transform QGSD's formal verification from a static pipeline into a living, self-updating system — feedback loops that update PRISM priors from empirical observations, structural models that track XState changes automatically, debugging tools that bridge spec↔impl divergence, a plan-to-spec pipeline that formally verifies planning decisions before quorum sees them, and operational signals that use FV results to drive roadmap prioritization and runtime decisions.

**Shipped:** 18/21 requirements satisfied (ARCH-01–03, LOOP-01–04, SPEC-01–04, PLAN-01–03, SIG-01–04). 3 procedural gaps (DIAG-01–03: implemented and tested but VERIFICATION.md missing). 6 phases, 24 plans, 86 commits, 131 files, +18.5k lines.

**Target features:**
- Central model registry — `.formal/model-registry.json` as single source of truth; all update flows (generate, debug, plan-promote, manual) write to `.formal/` directly; `promote-model.cjs` path for per-phase proposals → canonical specs; debug-discovered invariants write directly to `.formal/tla/` specs with session provenance
- Feedback loops — PRISM auto-calibration (export-prism-constants as pre-step in run-prism), XState auto-regeneration hook (PostToolUse → auto-regen all TLA+/Alloy specs), sensitivity sweep → PRISM recalibration, post-debug spec synthesis (new invariants → TLA+ candidates → accepted into central registry)
- Spec completeness — Stop hook TLA+ spec (HasPlanningCommand ∧ ¬HasQuorumEvidence ⟹ BLOCK), run-collapse spec-to-code drift audit + fix, quorum composition Alloy model (composition selection rules beyond vote counting), requirements as LTL formulas (truths: blocks → TLA+ PROPERTY checks)
- Diagnostic infrastructure — conformance trace divergence fix (diagnose and fix the 69% failure rate), counterexample-to-root-cause tool (attribute-trace-divergence.cjs), post-debug pivot decision support
- Planning integration (closes v0.16 deferral) — PLAN.md → TLA+ delta auto-synthesis pre-quorum, iterative verification loop (iterate plan until TLC passes), quorum slots vote with formal evidence attached
- Operational signals — TLC state-space coverage gap detector, phase dependency Petri net, PRISM failure probability → roadmap priority ranking, runtime probabilistic quorum gate (pre-quorum PRISM check)

## Just Shipped: v0.20 FV as Active Planning Gate (2026-03-01)

**Goal:** Wire QGSD's formal verification pipeline into its planning and verification workflows — TLC/Alloy/PRISM findings surface as hypotheses during `plan-phase`, formal check results appear in `VERIFICATION.md` during `execute-phase`, and the check-result schema is enriched to v2.1 spec to enable triage bundles and evidence dashboards.

**Shipped:** 20/20 requirements satisfied (SCHEMA-01–03, LIVE-01/02, PLAN-01–03, VERIFY-01/02, EVID-01/02, TRIAGE-01/02, UPPAAL-01–03, SENS-01–03). 9 phases, 28 plans.

**Target features:**
- Enriched check-result schema — `.formal/check-result.schema.json` extended to v2.1 (adds `check_id`, `surface`, `property`, `runtime_ms`, `summary`, `triage_tags`, `observation_window`); `write-check-result.cjs` and all 23 callers updated
- Liveness fairness CI lint — checker emits `result=inconclusive` when a liveness property lacks an explicit fairness declaration in `invariants.md`; enforced as a CI gate
- Planning gate — `run-formal-verify --only=tla` wired into `plan-phase.md` pre-quorum; TLC violations surface as hypotheses passed to the planner for the plan to address
- Verification gate — `run-formal-verify` wired into `qgsd-verifier`; `check-results.ndjson` digest included in `VERIFICATION.md`
- Evidence confidence — `never_observed` path entries in evidence summaries carry `confidence: low/medium/high` + `observation_window` metadata
- Triage bundle — `diff-report.md` and `suspects.md` generated from `check-results.ndjson` (replaces ad-hoc stdout parsing)
- UPPAAL timed race modeling — `quorum-races.xml` timed automaton uses empirical `runtime_ms` bounds as clock guards; TCTL queries surface minimum inter-slot gap and maximum timeout for consensus
- Sensitivity sweep — `run-sensitivity-sweep.cjs` sweeps MaxSize/tp_rate; top-3 high-impact parameters injected into planning quorum as `SENSITIVITY_CONTEXT`; `sensitivity-report.cjs` produces ranked human-readable report

**Phases:** v0.20-01..v0.20-09 (9 phases, 28 plans, 83 commits, 250 files, +39k/−3k lines)

## Just Shipped: v0.19 FV Pipeline Hardening (2026-02-28)

**Goal:** Add a governance layer to QGSD's existing formal verification pipeline — unified check-results output, cold-start calibration policy, liveness fairness declarations, redaction enforcement, evidence confidence qualifiers, and trace schema drift guards — making the FV infrastructure production-grade.

**Shipped:** 25/25 requirements satisfied (UNIF-01..04, CALIB-01..04, LIVE-01..02, REDACT-01..03, EVID-01..02, DRIFT-01..02, MCPENV-01..04, IMPR-01..04). All implementation gaps closed. All tech debt resolved (CALIB-04 wired v0.19-10, UNIF-03 fixed v0.19-11). Zero residual debt.

**Phases:** v0.19-01..v0.19-11 (11 phases, 26 plans)

## Shipped: v0.18 Token Efficiency (2026-02-27, audit in progress)

**Goal:** Reduce QGSD's per-run token consumption (currently 380k+ tokens per Nyquist-class run) by establishing per-slot token observability, enforcing tiered model sizing, introducing a structured task envelope context handoff, and making quorum fan-out risk-adaptive.

**Target features:**
- Token observability — `SubagentStop` hook + `agent_transcript_path` transcript parsing writes per-slot usage to `.planning/token-usage.jsonl`; `/qgsd:health` displays token consumption ranked by slot/stage
- Tiered model sizing — researcher and plan-checker sub-agents in `plan-phase.md` dispatched with `model="haiku"` (15-20× cost reduction vs sonnet); planner retains sonnet; user-configurable via `model_tier_planner`/`model_tier_worker` flat keys
- Task envelope — `task-envelope.json` sidecar written by researcher and planner with `objective`, `constraints`, `risk_level`, and `target_files`; passes structured context to quorum; eliminates N × full PLAN.md re-reads per round
- Adaptive quorum fan-out — `quorum.md` reads `risk_level` from envelope and dispatches 2/3/max workers for routine/medium/high risk; emits `--n N` for Stop hook R3.5 compliance; user `--n N` override preserved

## Incorporated into v0.21: v0.16 Formal Plan Verification (formerly deferred)

**Goal:** Core v0.16 features (plan-to-spec pipeline, iterative verification loop, quorum with formal evidence) are now closing as PLAN-01/02/03 requirements in v0.21 FV Closed Loop. Mind map generation and general-purpose code→spec pipeline deferred to a future milestone.

## Planned Milestone: v0.17 Auto-Chain Context Resilience

**Goal:** Make the execute-phase auto-advance chain resilient to Claude Code auto-compaction events by converting `transition.md` from inline execution to a spawnable `Task()` sub-agent, making the orchestrator re-entrant via STATE.md position writes, and ensuring each plan+execute cycle starts with fresh context.

**Target features:**
- Execute-phase re-entrancy — writes current position (phase, plan index, status) to STATE.md before each major sub-agent spawn; reads STATE.md at startup to resume interrupted chains
- Transition HANDOFF protocol — before spawning transition, execute-phase writes `TRANSITION-HANDOFF.md` with all context the transition workflow needs (completed phase, plan count, summaries digest, next phase); transition reads it; file cleaned up after
- Transition as spawnable Task — execute-phase spawns `transition.md` as `Task(subagent_type="qgsd-executor")` instead of calling inline; orchestrator context stays flat across all phase cycles
- Chain validation — end-to-end test: auto-advance chain survives simulated compaction; resume-work routing updated for new chain state patterns

## Shipped: v0.15 — Health & Tooling Modernization (2026-02-27)

**Goal:** Fix the GSD health checker to recognize QGSD's versioned phase naming convention, guard `--repair` against rich STATE.md data loss, archive legacy pre-versioning phase dirs, and surface quorum failure patterns in the health report.

**Shipped:** 4 phases — gsd-tools.cjs W005/W007/W002 versioned pattern support (eliminated 64 false positives), `--repair` guard (50-line threshold + `--force` bypass), legacy dir archive (22 dirs → archive/legacy/), W008 quorum-failures.json health warning. 6/6 requirements satisfied.

## Just Shipped: v0.14 FV Pipeline Integration (2026-02-26)

**Goal:** Commit and wire the existing untracked formal verification tools into the npm test suite and CI, parallelize the 20-step runner from 10 min to ~2 min, upgrade regex-based drift detection to AST, and add PRISM config injection from the quorum scoreboard.

**Phases:** v0.14-01..v0.14-05 (5 phases, 12 plans)

## Previously Shipped: v0.13 Autonomous Milestone Execution (2026-02-25)

**Delivered:** Removed all human checkpoints from the milestone execution loop — zero AskUserQuestion calls from new-milestone through complete-milestone.

**Shipped features:**
- LOOP-01/02/03: `transition.md` calls audit-milestone; IS_GAP_CLOSURE detection routes gap-closure phases to re-audit; audit-milestone auto-spawns plan-milestone-gaps on gaps_found
- QUORUM-01: plan-milestone-gaps phases submitted to R3 quorum for approval before ROADMAP update
- QUORUM-02: execute-phase gaps_found triggers quorum diagnosis and auto-resolution
- QUORUM-03: discuss-phase remaining user_questions routed to quorum in auto mode
- STATE-01: audit-milestone updates STATE.md with audit result
- TECH-01 fix: IS_GAP_CLOSURE anchored to `^### Phase ${COMPLETED_PHASE}:` with `-A 4` — eliminates false-positive from cross-phase content

**Phases:** v0.13-01..v0.13-06 (6 phases, 10 plans)

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

## Previous Milestone: v0.9 GSD Sync (COMPLETE 2026-02-27)

**Goal:** Port GSD 1.20.6 improvements into QGSD — context window self-monitoring hook, pre-execution Nyquist test validation, discuss-phase UX refinements, and bundled small fixes.

**Phases:** v0.9-01..v0.9-09 (9 phases, 13 plans)

**Shipped:** v0.9-01 (context window monitor hook), v0.9-02 (Nyquist validation layer), v0.9-03 (discuss-phase UX), v0.9-04 (Skill tool spawn guards, Gemini TOML fix, decimal phase parsing — FIX-01..04), v0.9-05 (qgsd-core/ rename), v0.9-06 (v0.9-03 VERIFICATION.md gap closure), v0.9-07 (NYQ-04 parse list gap closure), v0.9-08 (v0.9-05 re-verify), v0.9-09 (SC-4 end-to-end Nyquist demo)

**Requirements:** 13/13 (NYQ-01..05, DSC-01..03, CTX-01..02, FIX-01, REN-01..02)

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

- ✓ plan-phase formal scope scan — Step 4.5 keyword-matches `.formal/spec/` modules against phase description; populates `$FORMAL_SPEC_CONTEXT`; injects matching `invariants.md` files into planner `<files_to_read>` and `<formal_context>` block; fail-open (missing `.formal/spec/` = zero overhead) (WFI-01, ENF-03) — v0.23 (Phase v0.23-01)
- ✓ plan-phase checker formal_artifacts enforcement — Step 10 `<check_dimensions>` block flags missing `formal_artifacts:` frontmatter field as BLOCKER; validates path specificity; `<formal_context>` block conditionally verifies declaration or requires `formal_artifacts: none`; installed to `~/.claude` (WFI-02, ENF-03) — v0.23 (Phase v0.23-01)
- ✓ Liveness fairness lint — centralized check-liveness-fairness.cjs CI step with dynamic MC*.cfg discovery; emits result=inconclusive for liveness configs lacking fairness declarations; ci:liveness-fairness-lint as 26th STEPS entry in run-formal-verify.cjs (LIVE-01..02) — v0.20 (Phase v0.20-02)
- ✓ Planning gate — plan-phase.md step 8.3 runs `run-formal-verify.cjs --only=tla` pre-quorum; result=fail NDJSON entries surfaced as FV_HYPOTHESES in quorum review_context; fail-open (|| FV_EXIT=$?) so TLC failures never block plan creation (PLAN-01..03) — v0.20 (Phase v0.20-03)
- ✓ Schema enrichment — check-result.schema.json v2.1 (check_id, surface, property, runtime_ms, summary, triage_tags, observation_window); write-check-result.cjs + all 21 active callers updated (SCHEMA-01..03) — v0.20 (Phase v0.20-01)
- ✓ Verification gate — qgsd-verifier runs run-formal-verify post-implementation; VERIFICATION.md gains ## Formal Verification section with pass/fail/warn counts per formalism (VERIFY-01..02) — v0.20 (Phase v0.20-04)
- ✓ Triage bundle — generate-triage-bundle.cjs produces diff-report.md (per-check delta) + suspects.md (fail/triage_tags checks); called as final STEPS entry in run-formal-verify.cjs (TRIAGE-01..02) — v0.20 (Phase v0.20-06)
- ✓ UPPAAL timed race modeling — quorum-races.xml timed automaton with empirical runtime_ms clock guards; run-uppaal.cjs + uppaal:quorum-races STEPS entry; TCTL queries annotate minimum inter-slot gap + maximum consensus timeout (UPPAAL-01..03) — v0.20 (Phase v0.20-07)
- ✓ Sensitivity sweep — run-sensitivity-sweep.cjs sweeps MaxSize [1,2,3] and tp_rate [0.5,0.75,0.95]; sensitivity-report.ndjson + human-readable sensitivity-report.md; SENSITIVITY_CONTEXT injected into plan-phase quorum review_context (SENS-01..03) — v0.20 (Phase v0.20-08)
- ✓ Unified verdict format: all 13 FV checkers emit normalized NDJSON to check-results.ndjson; check-results-exit.cjs CI gate exits non-zero on any result=fail (UNIF-01..04) — v0.19 (Phases v0.19-01, v0.19-11)
- ✓ Calibration governance: .formal/policy.yaml cold-start thresholds + read-policy.cjs; conservative_priors.tp_rate/unavail wired directly to run-prism.cjs fallback constants; 18/18 tests (CALIB-01..04) — v0.19 (Phases v0.19-02, v0.19-10)
- ✓ Liveness fairness: invariants.md fairness declarations for all 8 surfaces; detectLivenessProperties() wired to all 5 TLC runners — emits result=inconclusive on missing declaration (LIVE-01..02) — v0.19 (Phases v0.19-03, v0.19-07)
- ✓ Enforcement layer: check-trace-redaction.cjs, never_observed confidence metadata in validate-traces.cjs, check-trace-schema-drift.cjs; all CI-wired via run-formal-verify.cjs STEPS (REDACT-01..03, EVID-01..02, DRIFT-01..02) — v0.19 (Phase v0.19-04)
- ✓ MCP environment model: QGSDMCPEnv.tla formal fault-tolerance proof; MCMCPEnv in SURFACE_MAP + VALID_CONFIGS; invariants.md EventualDecision fairness; mcp-availability.pm composite-key filter + module.exports fix; all CI-wired (MCPENV-01..04) — v0.19 (Phases v0.19-05, v0.19-08)
- ✓ R3.6 iterative improvement protocol: slot-worker parses `Improvements:` field (IMPR-01), quorum emits `QUORUM_IMPROVEMENTS` HTML signal with de-duplication (IMPR-02), plan-phase and quick both implement R3.6 outer loop (IMPR-03/04); CLAUDE.md file-read instructions removed from 7 agent/workflow files and replaced with self-contained inline guidance; 27 new tests — v0.19 (Phase v0.19-06)
- ✓ Liveness fairness wiring: all 4 remaining TLC runners (run-oscillation-tlc.cjs, run-breaker-tlc.cjs, run-protocol-tlc.cjs, run-account-manager-tlc.cjs) now call `detectLivenessProperties(configName, cfgPath)` on the success path, emitting `result=inconclusive` when the companion `invariants.md` has no fairness declaration — closes LIVE-02, 12 new tests GREEN — v0.19 (Phase v0.19-07)
- ✓ PRISM mcp-availability.pm model calibrated from scoreboard UNAVAIL rates; readMCPAvailabilityRates() helper + 4 integration tests (MCPENV-04) — v0.19 (Phase v0.19-05)
- ✓ PRISM config injection — `readScoreboardRates()` in run-prism.cjs reads quorum-scoreboard.json, injects empirical TP/unavail rates as `-const` flags; caller override wins; conservative priors (0.85/0.15) when no scoreboard; 4 integration tests in run-prism.test.cjs (PRISM-01, PRISM-02) — v0.14 (Phase v0.14-04)
- ✓ Parallelized `run-formal-verify.cjs` — generate step sequential, tla/alloy/prism/petri groups concurrent via Promise.all; wall-clock timing in summary (PERF-01, PERF-02) — v0.14 (Phase v0.14-03)
- ✓ Drift detector wired into `npm test` with esbuild+require() AST walk; TLA+ orphan phases = fail(), bidirectional guard drift enforcement via Check 5 (DRFT-01..03) — v0.14 (Phase v0.14-02)
- ✓ BROKEN-01 resolved: xstate-to-tla.cjs writes to QGSDQuorum_xstate.tla, never clobbering hand-authored canonical spec; CI hardened (path triggers + continue-on-error removed) — v0.14 (Phase v0.14-02)
- ✓ Commit and integrate untracked FV tools with test coverage; run-formal-verify.cjs calls xstate-to-tla.cjs as STEPS[0] (INTG-01..04) — v0.14 (Phase v0.14-01)
- ✓ Autonomous milestone execution loop wired end-to-end (LOOP-01/02/03): transition.md calls audit-milestone; IS_GAP_CLOSURE routes gap-closure phases to re-audit; audit-milestone auto-spawns plan-milestone-gaps on gaps_found — v0.13 (Phase v0.13-01)
- ✓ plan-milestone-gaps, execute-phase, and discuss-phase all gated by R3 quorum (QUORUM-01/02/03) — AskUserQuestion replaced in every autonomous loop position — v0.13 (Phase v0.13-02)
- ✓ audit-milestone updates STATE.md with audit result after writing MILESTONE-AUDIT.md (STATE-01) — v0.13 (Phase v0.13-01)
- ✓ IS_GAP_CLOSURE grep anchored to `^### Phase` with `-A 4` — eliminates false-positive routing of primary phases with downstream gap-closure dependents (TECH-01) — v0.13 (Phase v0.13-05/06)
- ✓ Quorum rounds execute as parallel Task fan-outs (wave-barrier): worker per slot → synthesizer barrier → optional Round 2 → final verdict; cuts round-trip from N×timeout to ~1×max(timeout) — v0.11 (Phase v0.11-01 — PAR-01..05)
- ✓ Scoreboard writes atomic (tmpPath + renameSync at all sites); `merge-wave` subcommand applies N parallel worker votes in one transaction — v0.11 (Phase v0.11-01 — PAR-03/04)
- ✓ Nyquist validation layer — `VALIDATION.md` template + `plan-phase.md` Step 5.5 (generates per-phase test-map at plan time); halt guard blocks plan creation when absent (NYQ-01..05) — v0.9 (Phases v0.9-02, v0.9-07)
- ✓ Discuss-phase UX — recommended-choice highlighting in gray-area prompts + loop-back option instead of hard stop (DSC-01..03) — v0.9 (Phase v0.9-03)
- ✓ Context window monitor hook injects WARNING/CRITICAL into `additionalContext` at configurable thresholds (CTX-01..05) — v0.9 (Phase v0.9-01)
- ✓ Skill tool spawn guards in plan-phase.md (5×) and discuss-phase.md (1×); Gemini TOML files; decimal phase parsing via normalizePhaseName (FIX-01..04) — v0.9 (Phase v0.9-04)
- ✓ Renamed `get-shit-done/` → `qgsd-core/`; bin/install.js reads from qgsd-core/; all 9 agent files updated (REN-01..04) — v0.9 (Phase v0.9-05)
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
- ✓ Health checker versioned phase naming, repair safety guard, legacy dir archive, quorum failure visibility (HLTH-01..03, SAFE-01..02, VIS-01) — v0.15
- ✓ Provider infrastructure with retry-backoff, live health dispatch with availability windows, structured telemetry with flakiness scoring, self-healing consensus with Poisson binomial early escalation, slot worker thin passthrough 22k→11k tokens (FAIL-01/02, DISP-01–05, OBS-01–03, HEAL-01/02) — v0.24
- ✓ Bidirectional requirement-model traceability, @requirement annotations on 43 formal models, traceability matrix generator with 63.8% coverage, CI coverage guard, state-space risk analysis (SCHEMA-01..04, TRACE-01..05, ANNOT-01..05, DECOMP-01..04) — v0.25
- ✓ Per-slot policy configuration, batch credential rotation, portable roster export/import, SDK bundling elimination with architecture linter, cross-model decomposition analysis (PLCY-01–03, CRED-01/02, PORT-01–03, PRST-01/02, REN-03, DASH-01–03, ARCH-10, DECOMP-05) — v0.26
- ✓ Unified observe skill, fingerprint-deduplicating debt ledger, P->F residual layer in solve with two-track remediation, pluggable production source handlers (DEBT-01–06, FP-01–04, OBS-01–08, PF-01–05) — v0.27
- ✓ Configurable hook profiles (minimal/standard/strict), SHA-256 quorum response caching with git-HEAD invalidation, pass@k consensus reporting, token budget monitoring with auto-downgrade, stall detection, smart compaction suggestions, security sweep scanner, session state reminders, unified harness diagnostic (PROF-01–04, CLEAN-01–02, CACHE-01–04, PASSK-01–02, BUDG-01–03, STALL-01–02, SMART-01–02, SEC-01–03, STATE-01–02, DIAG-01–03) — v0.28
- ✓ Three-layer formal verification architecture (Evidence/Semantics/Reasoning) with inter-layer gates (Grounding 82.2%, Abstraction, Validation 1.0), FMEA hazard model, 32 model-driven test recipes, cross-layer dashboard, nf-solve layer sweeps, design impact analysis (EVID-01–05, SEM-01–04, RSN-01–05, GATE-01–04, INTG-01–06) — v0.29
- ✓ Hook input validation — per-event-type JSON schema validation for all 14 hook stdin inputs with structured stderr diagnostics and fail-open behavior (VALID-01) — v0.31 (Phase v0.31-01)
- ✓ Hook priority ordering — deterministic priority-based execution ordering in install.js with Critical/Normal/Low tiers, circuit-breaker always first, user-configurable via hook_priorities in nf.json (PRIO-01) — v0.31 (Phase v0.31-01)
- ✓ Dynamic model selection — task-classifier.cjs with COMPLEXITY_MAP, TIER_SLOT_MAP slot filtering, thinking_budget_scaling, /nf:tokens dashboard (TOKN-01–04) — v0.30 (Phase v0.30-01)
- ✓ File-based execution state — execution-progress.cjs with compaction injection, iteration cap, stuck detection (VERF-01) — v0.30 (Phase v0.30-02)
- ✓ Memory persistence — memory-store.cjs with 6 JSONL categories, session reminders, compaction snapshots (MEMP-01–04) — v0.30 (Phase v0.30-03)
- ✓ Continuous learning — learning-extractor, skill-extractor, SessionEnd hook pipeline, confidence scoring with weekly decay (LRNG-01–04) — v0.30 (Phases v0.30-04/08/09)
- ✓ Continuous verification — boundary-batched checks, done_conditions evaluator, 3-run budget cap (VERF-02–03) — v0.30 (Phase v0.30-05)
- ✓ Subagent orchestration — domain-specific context retrieval, phase context stack, pre-dispatch enrichment (ORCH-01–03) — v0.30 (Phase v0.30-06)
- ✓ Worktree parallelization — nf-worktree-executor agent, worktree-merge.cjs, Pattern D parallel dispatch, SERIAL_FILES detection (PARA-01–02) — v0.30 (Phase v0.30-07)
- ✓ Circuit breaker evidence persistence — cross-session oscillation signature memory with 50-entry cap and preemptive warnings (BRKR-01) — v0.31 (Phase v0.31-02)
- ✓ Per-slot latency budgets — latency_budget_ms as hard ceiling in providers.json, TIMEOUT telemetry (LTCY-01) — v0.31 (Phase v0.31-02)
- ✓ Review-only tool restriction — structural --allowedTools for ccr slots, prompt-level for non-ccr (EXEC-01) — v0.31 (Phase v0.31-02)
- ✓ Rule sharding — paths: frontmatter on all .claude/rules/ files for per-turn selective loading (SHARD-01) — v0.31 (Phase v0.31-03)
- ✓ Config write adapter — bidirectional nested/flat key conversion, boolean/profile normalization (ADAPT-01) — v0.31 (Phase v0.31-03)
- ✓ Structured debate templates — YAML frontmatter + debate-formatter.cjs for programmatic parsing (ADR-01) — v0.31 (Phase v0.31-03)
- ✓ README above-the-fold restructure — TUI hero promoted from details, value props, comparison table, metrics grid, changelog, expanded nav bar (RDME-01–04, RDME-06–07) — v0.32 (Phase v0.32-01)
- ✓ README deep sections — Mermaid architecture diagram, Community section with Discord CTA, Getting Started rebalanced, Observability table fixed (RDME-05, RDME-08–10) — v0.32 (Phase v0.32-02)
- ✓ User Guide overhaul — Getting Started walkthrough with 5 screenshots, 5 feature sections with TUI screenshots, structural test suite (GUIDE-01–02) — v0.32 (Phase v0.32-03)
- ✓ Visual asset regeneration — 11 TUI screenshots via hardened VHS tape, dynamic Claude Code path resolution, determinism verification (VIS-01–02) — v0.32 (Phase v0.32-04)

### Active

<!-- Carry-forward: deferred from v0.3 -->
- [ ] npm publish qgsd@0.2.0 deferred — run `npm publish --access public` when ready (RLS-04)


### Out of Scope

- Calling model CLIs directly from hooks (fragile, external dependencies, auth complexity) — deferred as optional strict mode
- Modifying GSD workflows or agents — QGSD is additive only
- Per-project install (global only — matches GSD's install behavior)
- Fail-closed mode in v1 — fail-open matches CLAUDE.md R6 and avoids blocking work

## Context

nForma v0.32 shipped 2026-03-09 (14/14 requirements, 4 phases). 32 milestones completed (v0.1–v0.32). Documentation & README Overhaul milestone restructured README for immediate value communication and rebuilt User Guide with visual walkthrough. Next milestone TBD — run `/nf:new-milestone` to start. v0.2.0 npm publish still deferred by user decision.

**Codebase:** ~100,000+ lines (JS + MD), 500+ files. 92+ formal models (TLA+, Alloy, PRISM), 35K+ conformance traces.
**Tech stack:** Node.js, Claude Code hooks (UserPromptSubmit + Stop + PreToolUse + PostToolUse), npm package. Rebranded from QGSD to nForma (v0.28, skill prefix `/nf:`).
**Known tech debt:** Pre-existing TLC counterexamples (deliberation:tlc, oscillation:tlc); 567 untested assumptions in assumption-register.json; 6,369 instrumentation_bug traces; state-candidates.json informational only (no consumer); v0.2.0 npm publish deferred.

## Constraints

- **Architecture**: Plugin extension only — no GSD source modifications, zero coupling to GSD version
- **Dependencies**: Pure Claude Code hooks system — no external CLIs, no API keys beyond what Claude Code already manages via MCPs
- **Install**: Global (~/.claude/) following GSD's install pattern
- **Scope**: v1 covers quorum enforcement + circuit breaker + activity tracking

## Binding Rules

### R9 — Spec Objectives Are Immutable During Verification

**Principle:** Spec structure must track reality, but spec objectives must never be weakened to match reality's shortcomings.

**Two distinct concerns:**
1. **Spec models MUST accurately reflect the real system** — if the code has 5 states, the spec should model 5 states. An inaccurate model produces meaningless verification results.
2. **Target objectives/pass criteria MUST NOT be lowered** — if the spec says 100% stability is required and code achieves 80%, the fix is in the code, not in relaxing the spec.

**"Weakening" is explicitly defined as any of:**
- Relaxing numeric thresholds (e.g., 100% -> 80%, 3-round cap -> 5-round cap)
- Removing invariants or liveness properties from a spec
- Softening "must" to "should" or "shall" to "may" in success criteria
- Reducing the count of success criteria for a phase
- Changing FAIL verdicts to PASS without code changes
- Narrowing the scope of what a truth or property covers

**Enforcement points (R9):**
- **Planner (R9):** PLAN must_haves truths must be derived from ROADMAP success_criteria, not invented independently. Must not reduce scope.
- **Plan checker (R9):** Checker must verify PLAN truths cover all ROADMAP success_criteria for the phase. Missing criteria = blocker.
- **Verifier (R9):** Pre-verification baseline captures ROADMAP success_criteria as immutable reference. Deviations between PLAN must_haves and ROADMAP criteria are flagged before verification begins.
- **Spec generation (R9):** `generate-phase-spec.cjs` reads truths from PLAN frontmatter. If truths are weakened relative to ROADMAP criteria, TLA+ PROPERTY stubs inherit the weakness. R9 requires truths to match ROADMAP criteria.

**Any proposed objective relaxation requires explicit user approval** with justification documented in the Key Decisions table.

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
| QGSDStopHook.tla uses WF_vars() in Spec formula (not FAIRNESS in .cfg) | Mixing FAIRNESS line in .cfg with fairness in Spec formula causes TLC conflict; single-place fairness in .tla is canonical | Design decision — v0.21-04 SPEC-01 |
| HighRiskFullFanOut uses `>= #c.availableSlots` not `min[a,b]` | Alloy 6.2.0 CLI exec mode does not support `min[]` integer function; over-approximation is sound because `selectedSlots in availableSlots` bounds selection | Deviation documented — v0.21-04 SPEC-03 |
| generate-phase-spec.cjs reads truths from *-PLAN.md frontmatter, not task-envelope.json | task-envelope.json has empty truths at planning time; PLAN.md frontmatter has 26 truths after plan creation | Design decision — v0.21-04 SPEC-04 |
| QGSDOscillation.tla net-diff modeled nondeterministically (SetNetChange) | hasReversionInHashes is not exported; nondeterministic over-approximation is sound and preserves TLC correctness | Confirmed correct — v0.21-04 SPEC-02 audit |
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
| IS_GAP_CLOSURE uses -A 4 not -A 3: Gap Closure field at offset 4 from ^### Phase X: | Counting Goal/Depends on/Requirements/Gap Closure = 4 lines after heading; -A 3 would miss it; anchored grep eliminates false-positives from cross-phase Depends-on lines | Phase v0.13-05 — TECH-01 |
| QUORUM-03 second pass uses 3-round deliberation cap (not 10) | Secondary pre-filter pattern matches R4, not full R3; shorter cap avoids context bloat in discuss-phase auto mode | Phase v0.13-02 |
| QUORUM-02 uses compact prompt (1-sentence-per-gap, max 20 words) | execute-phase orchestrator context ~10-15%; full VERIFICATION.md text would overflow | Phase v0.13-02 |
| Scoreboard update ordering: update-scoreboard.cjs BEFORE any downstream Task spawn | All 3 plans; prevents scoreboard writes being lost if downstream Task spawning fails | Phase v0.13-02 |
| subagent_type="general-purpose" for plan-milestone-gaps Task spawn | No dedicated qgsd-plan-milestone-gaps subagent registered; no model= to avoid resolve-model errors | Phase v0.13-01 |
| installer sync (node bin/install.js --claude --global) is canonical mechanism for qgsd-core/ edits | Installed copy ~/.claude/qgsd/ is what Claude reads at runtime; source edits without install sync = silent non-deployment | Phase v0.13-06 — INT-03 |
| continue-on-error: true on formal-verify.yml master runner step | JARs/binaries may be absent in some CI environments; failures visible in logs without blocking; matches verify-quorum-health guard pattern | Phase v0.14-01 — INTG-03 |
| _xstate suffix (Option A) for BROKEN-01 | Generated spec writes to QGSDQuorum_xstate.tla — hand-authored QGSDQuorum.tla (phase var, AgentSymmetry, MinQuorumMet invariants) remains canonical; quorum-approved in v0.14 gap planning | Phase v0.14-02 — BROKEN-01 |
| esbuild inline bundling (not external:['xstate']) in check-spec-sync.cjs | external flag causes MODULE_NOT_FOUND in /tmp bundle (no node_modules); same inline bundling pattern as xstate-to-tla.cjs | Phase v0.14-02-02 |
| TLA+ orphan phases promoted from warn() to fail() | DRFT-03 requirement says "states or guards" must be hard failures for TLA+ (Alloy orphans remain warn — Alloy may legitimately use different state space) | Phase v0.14-02-03 |
| Guard drift enforcement uses .formal/tla/guards/qgsd-workflow.json as cross-reference source | Bidirectional: xstateGuardNames vs JSON keys; JSON keys vs machine; camelCase XState → PascalCase TLA+ mapping documented inline | Phase v0.14-02-03 — Check 5 |
| STEPS[0] split into generate:tla-from-xstate + generate:alloy-prism-specs (total 20→21) | xstate-to-tla.cjs generates TLA+/cfg only; generate-formal-specs.cjs retained as separate step for Alloy/PRISM — preserves full pipeline coverage | Phase v0.14-01 — INTG-04 |
| node --check for syntax smoke in run-formal-verify.test.cjs | Script has top-level async IIFE that spawns child processes immediately on require(); node --check validates syntax without triggering execution | Phase v0.14-01-02 — testing pattern |
| VALID_CONFIGS guard in run-account-manager-tlc.cjs evaluated before Java check | --config=invalid test reliable without Java installed; guard order confirmed by reading source before writing tests | Phase v0.14-01-02 — testing pattern |

| PRISM_BIN=prism sentinel in run-prism.test.cjs skips existence check | With `PRISM_BIN=prism`, the existence check is bypassed (sentinel value); spawnSync attempts `prism` from PATH (fails with ENOENT), but `[run-prism] Args:` log line is printed before spawn — enabling test assertion on -const flags without PRISM installed | Phase v0.14-04 — testing pattern |
| readScoreboardRates() computes aggregate mean across SLOTS | Per-slot TP and UNAVAIL rates averaged across ['gemini', 'opencode', 'copilot', 'codex']; 4 fallback paths all return conservative priors 0.85/0.15 | Phase v0.14-04 — PRISM-01 |

| STEPS ordering: CI enforcement runs inside orchestrator before NDJSON summary read | NDJSON summary read at end of runOnce() must see all CI entries; ci:trace-redaction + ci:trace-schema-drift added as STEPS entries (tool: 'ci'); both scripts are idempotent — safe to run inside orchestrator + standalone CI | Phase v0.19-11 — UNIF-03 |
| conservative_priors wired directly to run-prism.cjs fallback constants | policy.yaml is authoritative source; hardcoded constants overrode policy values at runtime; CALIB-04 closes the gap — `policy.conservative_priors.tp_rate` and `.unavail` replace PRISM_PRIOR_TP/UNAVAIL | Phase v0.19-10 — CALIB-04 |
| MCMCPEnv in SURFACE_MAP + separate invariants.md with EventualDecision fairness | TLC verifies quorum fault-tolerance under arbitrary MCP failures; WF_vars triple for slots × rounds × votes declares weak fairness explicitly; CI step added to formal-verify.yml | Phase v0.19-08 — MCPENV-02 |
| readMCPAvailabilityRates composite-key filter (contains ':' or '/') | Scoreboard keys like `claude-1:model-id` and `/path/to/file` are not PRISM model IDs; composite-key filter before rates object construction prevents PRISM constant corruption | Phase v0.19-08 — MCPENV-04 |

| check-result.schema.json v2.1 additive-only | New fields added alongside existing 5-field format; old NDJSON lines remain valid — zero backward incompatibility; all 21 callers updated rather than wrapper approach | Phase v0.20-01 — SCHEMA-01..03 |
| Sensitivity sweep uses separate sensitivity-report.ndjson (not check-results.ndjson) | No VALID_FORMALISMS coupling; sweep records are per-parameter-value not per-check; avoids polluting the main check results used by triage bundle and verification gate | Phase v0.20-08 — SENS-01 |
| TLA+ gate at step 8.2 (not 8.3) to avoid sensitivity sweep collision | v0.20-08 inserted sensitivity at 8.3; v0.20-09 moved TLA+ gate to 8.2 — ordered as: 8.2 (TLA+) → 8.3 (sensitivity) → 8.4 (envelope) → 8.5 (quorum); step renumbering closes regression | Phase v0.20-09 — PLAN-01/02 |
| UPPAAL runtime_ms bounds from empirical check-results.ndjson (not hardcoded) | Clock guards derived from real TLA+/Alloy timing data; bounds auto-update as models evolve; hardcoded constants would require manual maintenance | Phase v0.20-07 — UPPAAL-01 |
| Planning gate is fail-open (|| FV_EXIT=$?) | TLC failures are surfaced as warnings (FV_HYPOTHESES) to the planner but never block plan creation; FV flakiness cannot break the planning workflow | Phase v0.20-03 — PLAN-03 |
| Retry wrapping: non-OAuth at main() dispatch, OAuth inside rotation loop | Retry logic must not interfere with existing OAuth rotation mechanism; per-attempt protection preserves rotation semantics | Phase v0.24-01 — FAIL-01 |
| Fail-open for unknown errors (retryable by default) | Unknown errors during service degradation should retry, not immediately fail; only CLI_SYNTAX and spawn errors are non-retryable | Phase v0.24-01 — FAIL-01 |
| Provider hostname normalization strips "api." prefix and TLDs | Creates flexible match keys for cache-to-provider mapping; substring containment handles varied provider configs | Phase v0.24-01 — FAIL-02 |
| Flakiness-aware dispatch: primary sort = flakiness ASC, secondary = success rate DESC | Reliable slots first; among equally reliable, highest success rate wins | Phase v0.24-03 — OBS-03 |
| Early escalation routing via --remaining-rounds CLI parameter | Backward compatible: without --remaining-rounds, CLI behaves as before (original consensus gate path) | Phase v0.24-04 — HEAL-01 |
| Atomic config updates with rollback on any failure | applyMaxDeliberationUpdate backs up files, updates machine.ts + config.json, regenerates specs, rolls back all on failure | Phase v0.24-04 — HEAL-02 |
| SC4 revised from "below 5k" to "below 12k" per-worker | Claude Code Task infrastructure contributes ~10k fixed overhead; agent-controllable cost reduced ~80% (2500→600 tokens) but platform floor dominates | Phase v0.24-05 — DISP-04/05 |
| Agent spec kept under 30 content lines with 1 Bash call | Thin passthrough: all prompt construction and output parsing in quorum-slot-dispatch.cjs; agent is pure orchestration | Phase v0.24-05 — DISP-04 |
| Debt schema uses JSON Schema draft-07 with explicit pattern matching (no AJV) | Zero-dependency validation keeps gsd-tools.cjs monolith portable; pattern fields validated at write time | Phase v0.27-01 — DEBT-01 |
| State machine as ALLOWED_TRANSITIONS lookup table (not external library) | Simple dict-of-arrays sufficient for 4-state lifecycle; no xstate overhead for offline data structure | Phase v0.27-01 — DEBT-03 |
| Two-track remediation heuristic (never auto-update invariants) | Drift + numeric threshold → parameter update dispatch; issue or invariant → investigation flag only; conservative default prevents formal model corruption | Phase v0.27-05 — PF-05 |
| Freeze semantics via resolving status | Entries in resolving immune to concurrent observe overwrites; prevents race between observe and solve cycles | Phase v0.27-05 — PF-04 |
| Fingerprint exact-match first, Levenshtein second | O(n) hash-map pass handles >90% of dedup; O(n^2) similarity only runs on unmatched remainder — keeps large ledgers fast | Phase v0.27-03 — FP-03 |
| Production source handlers are framework-ready stubs | No live endpoints required; handlers validate schema and return standard issue objects; real auth deferred to v0.28+ (WIRE-01..05) | Phase v0.27-04 — OBS-03/04/05 |
| HTML img tag with width=720 for hero screenshots | GitHub does not respect CSS width on images; explicit HTML width attr ensures consistent rendering across displays | v0.32-01 — RDME-01 |
| Manual anchor `<a id>` before details/summary blocks | GitHub does not reliably generate anchors from `<summary>` text; manual anchor before `<details>` ensures nav bar links work | v0.32-01 — RDME-07 |
| Dynamic VHS tape path resolution via ls + tail | Hardcoded Claude Code version paths break on updates; `$(ls -d ~/Library/Application\ Support/Claude/claude-code/*/ \| tail -1)` resolves current version automatically | v0.32-04 — VIS-02 |

## Current Status

v0.32 shipped. 32 milestones completed (v0.1–v0.32). Next milestone TBD — run `/nf:new-milestone` to start.

---
*Last updated: 2026-03-13 after v0.35 milestone*
