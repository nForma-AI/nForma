# Roadmap: nForma

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
- ✅ **v0.13 — Autonomous Milestone Execution** — Phases v0.13-01..v0.13-06 (shipped 2026-02-25)
- ✅ **v0.14 — FV Pipeline Integration** — Phases v0.14-01..v0.14-05 (shipped 2026-02-26)
- ✅ **v0.15 — Health & Tooling Modernization** — Phases v0.15-01..v0.15-04 (shipped 2026-02-27)
- ✅ **v0.19 — FV Pipeline Hardening** — Phases v0.19-01..v0.19-11 (completed 2026-02-28)
- ✅ **v0.20 — FV as Active Planning Gate** — Phases v0.20-01..v0.20-09 (shipped 2026-03-01)
- ✅ **v0.21 — FV Closed Loop** — Phases v0.21-01..v0.21-06 (shipped 2026-03-01)
- ✅ **v0.23 — Formal Gates** — Phases v0.23-01..v0.23-04 (shipped 2026-03-02)
- ✅ **v0.24 — Quorum Reliability Hardening** — Phases v0.24-01..v0.24-05 (shipped 2026-03-03)
- ✅ **v0.25 — Formal Traceability & Coverage** — Phases v0.25-01..v0.25-07 (shipped 2026-03-03)
- ✅ **v0.26 — Operational Completeness** — Phases v0.26-01..v0.26-06 (shipped 2026-03-04)
- ✅ **v0.27 — Production Feedback Loop** — Phases v0.27-01..v0.27-05 (shipped 2026-03-04)

> **v0.2 through v0.27 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

## v0.28 — Agent Harness Optimization

### Overview

This milestone optimizes the nForma agent harness for production use -- adding configurable hook profiles, quorum response caching, budget-aware model downgrade, stall detection, smart compaction timing, security sweep, session state reminders, and a unified harness diagnostic tool. All 10 features integrate into existing hooks and scripts; no new hook files are needed.

## Phases

- [x] **Phase v0.28-01: Foundation -- Hook Profiles + De-Sloppify** - Configurable hook profiles and post-verification cleanup subagent (completed 2026-03-06)
- [x] **Phase v0.28-02: Data Pipeline -- Quorum Cache + Pass@k Metrics** - SHA-256 quorum response caching and pass@k conformance tracking (completed 2026-03-06)
- [x] **Phase v0.28-03: Runtime Intelligence -- Budget Downgrade + Stall Detection + Smart Compact** - Token budget monitoring, stall escalation, and workflow-aware compaction suggestions (completed 2026-03-06)
- [x] **Phase v0.28-04: Safety & Diagnostics -- Security Sweep + Session State + Harness Diagnostics** - Verify-time security scanning, session state reminders, and unified diagnostic reporting (completed 2026-03-06)

## Phase Details

### Phase v0.28-01: Foundation -- Hook Profiles + De-Sloppify
**Goal**: Users can configure how aggressively nForma hooks enforce, and completed phases get automatic code quality review
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. User sets `hook_profile: "minimal"` in nf.json and only circuit breaker and precompact hooks fire on subsequent tool calls
  2. User sets `hook_profile: "strict"` in nf.json and quorum enforcement applies to all `/nf:` commands, not just planning commands
  3. Changing `hook_profile` in nf.json takes effect on the next tool call without restart or reinstall
  4. After a successful execute-phase verification, a cleanup subagent spawns and produces a structured report listing redundancy, dead code, and over-defensive patterns with file:line references
  5. Circuit breaker remains functional across all three profiles -- oscillation detection fires in minimal, standard, and strict modes (formal: MonitoringReachable invariant holds regardless of profile)
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.28-01-01-PLAN.md -- Config-loader profile infrastructure (HOOK_PROFILE_MAP, shouldRunHook, validation)
- [ ] v0.28-01-02-PLAN.md -- Cleanup subagent workflow and execute-phase integration
- [ ] v0.28-01-03-PLAN.md -- Hook profile guards and strict mode quorum expansion

### Phase v0.28-02: Data Pipeline -- Quorum Cache + Pass@k Metrics
**Goal**: Identical quorum dispatches are served from cache, and consensus efficiency is tracked per-round
**Depends on**: Phase v0.28-01
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04, PASSK-01, PASSK-02
**Success Criteria** (what must be TRUE):
  1. Running the same quorum dispatch twice within TTL produces identical results without any API calls on the second invocation, and the cache hit is logged to conformance-events.jsonl
  2. Cache auto-invalidates when git HEAD changes, quorum_active composition changes, or TTL expires
  3. Cache files are stored in `.planning/.quorum-cache/` and are gitignored
  4. `verify-quorum-health.cjs` reports pass@1, pass@3, and pass@k rates computed from conformance event history
  5. Quorum still reaches a DECIDED state on every run where at least one slot responds, whether results come from cache or live dispatch (formal: EventualConsensus invariant preserved)
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.28-02-01-PLAN.md -- Cache infrastructure, conformance schema, gitignore, planning-paths (CACHE-01, CACHE-03, CACHE-04)
- [ ] v0.28-02-02-PLAN.md -- Cache integration in nf-prompt.js and nf-stop.js hooks (CACHE-02)
- [ ] v0.28-02-03-PLAN.md -- pass@k tracking in nf-stop.js and reporting in verify-quorum-health.cjs (PASSK-01, PASSK-02)

### Phase v0.28-03: Runtime Intelligence -- Budget Downgrade + Stall Detection + Smart Compact
**Goal**: The harness monitors token spend, detects stalled slots, and suggests compaction at clean workflow boundaries
**Depends on**: Phase v0.28-01
**Requirements**: BUDG-01, BUDG-02, BUDG-03, STALL-01, STALL-02, SMART-01, SMART-02
**Success Criteria** (what must be TRUE):
  1. User sets `budget.session_limit_tokens` in nf.json and sees a budget warning injected into context when cumulative tokens exceed 60% of the limit
  2. When cumulative tokens exceed 85% of the session limit, the model profile automatically downgrades (quality to balanced, or balanced to budget) without user action
  3. Subscription-type slots (auth_type: "sub") are excluded from budget calculations
  4. When a quorum slot has not responded within the configured timeout (default 90s), it is marked stalled; after 2 consecutive stalled checkpoints with no new commits, the user receives a structured stall report
  5. At clean workflow boundaries (phase completion, verification done, commit just made), the user sees a `/compact` suggestion when context usage exceeds the warn threshold, including what will survive and what will be lost
**Plans:** 0/3 plans complete
Plans:
- [ ] v0.28-03-01-PLAN.md -- Config-loader extensions (budget, stall, smart_compact) and budget tracker module (BUDG-01, BUDG-02, BUDG-03)
- [ ] v0.28-03-02-PLAN.md -- Stall detector module with timeout tracking and structured reports (STALL-01, STALL-02)
- [ ] v0.28-03-03-PLAN.md -- Context monitor budget injection, smart compact suggestions, and install sync (SMART-01, SMART-02)

### Phase v0.28-04: Safety & Diagnostics -- Security Sweep + Session State + Harness Diagnostics
**Goal**: Verification includes security scanning, new sessions resume with state context, and a unified diagnostic tool reports harness health
**Depends on**: Phase v0.28-02, Phase v0.28-03
**Requirements**: SEC-01, SEC-02, SEC-03, STATE-01, STATE-02, DIAG-01, DIAG-02, DIAG-03
**Success Criteria** (what must be TRUE):
  1. Running verify-phase produces a `## Security Sweep` section in VERIFICATION.md listing any hardcoded secrets, debug artifacts, or API keys with file:line references
  2. Security sweep runs as a bin/ script at verify-phase boundary with zero latency impact on normal tool calls
  3. Starting a new session while STATE.md shows an in-progress phase injects a brief state reminder (phase number, current plan, last activity) into additionalContext
  4. State reminder fires only on new sessions, not on compaction events
  5. Running `bin/harness-diagnostic.cjs` (or `/nf:health`) produces a structured report covering per-slot availability, pass@k trend, cumulative token spend, stall events, and actionable recommendations
  6. Stop hook continues to BLOCK planning responses that lack quorum evidence and PASS responses that include it, regardless of which features are active (formal: LivenessProperty2 and LivenessProperty3 invariants preserved)
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.28-04-01-PLAN.md -- Security sweep script and conformance schema update (SEC-01, SEC-02, SEC-03)
- [ ] v0.28-04-02-PLAN.md -- Session state reminder in nf-session-start.js (STATE-01, STATE-02)
- [ ] v0.28-04-03-PLAN.md -- Harness diagnostic tool and /nf:health integration (DIAG-01, DIAG-02, DIAG-03)

## v0.28 Progress

**Execution Order:** v0.28-01 -> (v0.28-02 | v0.28-03) -> v0.28-04

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.28-01. Foundation -- Hook Profiles + De-Sloppify | 3/3 | Complete    | 2026-03-06 |
| v0.28-02. Data Pipeline -- Quorum Cache + Pass@k Metrics | 3/3 | Complete    | 2026-03-06 |
| v0.28-03. Runtime Intelligence -- Budget + Stall + Smart Compact | 0/3 | Complete    | 2026-03-06 |
| v0.28-04. Safety & Diagnostics -- Security + State + Diagnostics | 3/3 | Complete    | 2026-03-06 |

## v0.29 — Three-Layer Formal Verification Architecture

### Overview

This milestone organizes nForma's existing 92+ formal models and 35K+ conformance traces into a three-layer architecture (Evidence, Semantics, Reasoning) connected by three inter-layer gates (Grounding, Abstraction, Validation). The build is strictly bottom-up: Layer 1 establishes what is actually observed, Layer 2 grounds the operational model in real traces, and Layer 3 connects hazard analysis back to evidence and code. Each gate quantifies alignment between its adjacent layers, producing a single cross-layer dashboard that shows verification health at a glance.

## Phases

- [x] **Phase v0.29-01: Layer Manifest and Evidence Foundation** - Register all formal artifacts into layer architecture and build L1 evidence collection infrastructure (completed 2026-03-06)
- [x] **Phase v0.29-02: Semantics Layer and Gate A Grounding** - Derive operational semantics from traces and quantify how well models explain observed behavior (completed 2026-03-06)
- [x] **Phase v0.29-03: Reasoning Enrichment and Gate B Abstraction** - Apply FMEA hazard analysis to operational model and enforce traceability from reasoning back to semantics (completed 2026-03-06)
- [x] **Phase v0.29-04: Gate C Validation and Test Generation** - Close the loop from reasoning outputs to executable test scenarios with nf-solve and run-formal-verify integration (completed 2026-03-06)
- [x] **Phase v0.29-05: Dashboard and Progressive Maturity Rollout** - Surface cross-layer alignment in a single terminal view (completed 2026-03-06)
- [ ] **Phase v0.29-06: Tech Debt Cleanup — nf-solve Fixes and Bookkeeping Sync** - Fix nf-solve data contract mismatch and exit-code handling, sync stale REQUIREMENTS.md and ROADMAP.md entries

## Phase Details

### Phase v0.29-01: Layer Manifest and Evidence Foundation
**Goal**: Every formal artifact is classified into its layer, and Layer 1 provides complete, queryable evidence about what the system actually does at runtime
**Depends on**: Nothing (first phase)
**Requirements**: INTG-01, INTG-05, INTG-06, EVID-01, EVID-02, EVID-03, EVID-04, EVID-05
**Success Criteria** (what must be TRUE):
  1. Running a manifest query returns the layer classification (L1/L2/L3), gate relationships, and grounding status for any of the 92+ existing formal models
  2. Running the instrumentation map script produces a JSON catalog of all hook/handler emission points with their mapped state variables and coverage percentages
  3. Running the trace corpus stats script returns session-indexed, action-typed, transition-queryable metadata for the existing 35K+ conformance traces
  4. Running the failure taxonomy script classifies every check-result failure into exactly one of five categories (crash, timeout, logic-violation, drift, degradation)
  5. A canonical event vocabulary file exists and all Layer 1 scripts validate emitted event names against it, rejecting unknown events
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.29-01-01-PLAN.md -- Event vocabulary, layer manifest, and model registry foundation
- [ ] v0.29-01-02-PLAN.md -- Instrumentation map and trace corpus stats
- [ ] v0.29-01-03-PLAN.md -- Failure taxonomy and state candidate extractor

### Phase v0.29-02: Semantics Layer and Gate A Grounding
**Goal**: Layer 2 captures what the system is supposed to do (invariants, mismatches, assumptions) grounded in Layer 1 evidence, with a quantitative alignment score
**Depends on**: Phase v0.29-01
**Requirements**: SEM-01, SEM-02, SEM-03, SEM-04, GATE-01
**Success Criteria** (what must be TRUE):
  1. Running the invariant catalog script produces a unified catalog containing both declared invariants (from TLA+/Alloy specs) and observed invariants (mined from traces) with source attribution
  2. Running a trace comparison produces JSONL mismatch entries tracking every L2-model vs L1-trace disagreement with resolution status (open/explained/bug)
  3. Running the assumption register script produces a catalog of assumptions made when deriving L2 from L1, each with validation status and linked L2 states
  4. Running Gate A produces a numeric grounding_score (traces_explained / total_traces) with target >= 80% and classifies every unexplained trace into instrumentation bug, model gap, or genuine violation
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.29-02-01-PLAN.md -- Invariant catalog and assumption register (SEM-01, SEM-03)
- [ ] v0.29-02-02-PLAN.md -- Mismatch register and observed FSM derivation (SEM-02, SEM-04)
- [ ] v0.29-02-03-PLAN.md -- Gate A grounding score computation (GATE-01)

### Phase v0.29-03: Reasoning Enrichment and Gate B Abstraction
**Goal**: Layer 3 applies structured hazard analysis to the operational model and Gate B enforces that every reasoning artifact traces back to a Layer 2 source
**Depends on**: Phase v0.29-02
**Requirements**: RSN-01, RSN-02, RSN-03, GATE-02, GATE-04
**Success Criteria** (what must be TRUE):
  1. Running the hazard model script produces FMEA scores (Severity x Occurrence x Detection = RPN) for every L2 operational model state and transition
  2. Running the failure mode catalog script enumerates concrete failure modes per L2 state/transition with effects and severity classification
  3. Running the risk heatmap script produces a ranked transition list (highest-risk-first) combining FMEA severity with coverage gap data from Layer 1
  4. Running Gate B verifies every L3 artifact has derived_from links to L2 sources and reports any orphaned hazards
  5. Each model in the registry shows its current gate enforcement level (ADVISORY, SOFT_GATE, or HARD_GATE) and the level can be promoted
**Plans:** 2 plans
Plans:
- [ ] v0.29-03-01-PLAN.md -- FMEA hazard model and failure mode catalog (RSN-01, RSN-02)
- [ ] v0.29-03-02-PLAN.md -- Risk heatmap, Gate B traceability, and gate maturity promotion (RSN-03, GATE-02, GATE-04)

### Phase v0.29-04: Gate C Validation and Test Generation
**Goal**: Every Layer 3 finding maps to a concrete executable test scenario, and the three-layer pipeline integrates into nf-solve and run-formal-verify
**Depends on**: Phase v0.29-03
**Requirements**: RSN-04, RSN-05, GATE-03, INTG-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. Running Gate C verifies every L3 hazard/failure-mode maps to at least one concrete test scenario with input sequence, expected outcome, and oracle
  2. Running the test generation script produces test recipe JSON from L3 failure modes that can be executed by the existing test infrastructure
  3. Running the design impact analysis on a git diff shows instrumentation (L1), state (L2), and hazard (L3) effects of the change
  4. Running nf-solve includes three new layer-transition sweeps (L1->L2, L2->L3, L3->TC) in its convergence loop
  5. Running run-formal-verify includes three new gate check step groups that produce alignment scores and gap reports
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.29-04-01-PLAN.md -- Gate C validation + test recipe generation (RSN-04, GATE-03)
- [ ] v0.29-04-02-PLAN.md -- Design impact analysis (RSN-05)
- [ ] v0.29-04-03-PLAN.md -- nf-solve layer sweeps + run-formal-verify gate step group (INTG-02, INTG-03)

### Phase v0.29-05: Dashboard and Progressive Maturity Rollout
**Goal**: Users see cross-layer verification health in a single terminal view and all models progress through gate maturity levels
**Depends on**: Phase v0.29-04
**Requirements**: INTG-04
**Success Criteria** (what must be TRUE):
  1. Running the cross-layer alignment dashboard displays L1 coverage %, Gate A score, Gate B score, and Gate C score in a single terminal view
  2. The dashboard reflects real-time state: changes from any prior phase (new traces, updated models, gate score changes) appear on next dashboard invocation
**Plans:** 1/1 plans complete
Plans:
- [ ] v0.29-05-01-PLAN.md -- Cross-layer alignment dashboard with gate aggregation and terminal rendering

### Phase v0.29-06: Tech Debt Cleanup — nf-solve Fixes and Bookkeeping Sync
**Goal**: Fix nf-solve integration bugs (data contract mismatch and exit-code handling) and sync all stale planning document entries
**Depends on**: Phase v0.29-05
**Requirements**: (none — tech debt closure, no new requirements)
**Gap Closure**: Closes gaps from v0.29 milestone audit
**Success Criteria** (what must be TRUE):
  1. Running nf-solve sweepL1toL2 reports correct unexplained_breakdown values (not zeros) matching gate-a's unexplained_counts
  2. Running nf-solve sweeps with a gate that exits code 1 (target not met) still produces valid residual scores instead of error responses
  3. All 14 previously-stale REQUIREMENTS.md checkboxes show `[x]` Complete for verified requirements
**Plans:** 1/1 plans complete
Plans:
- [x] v0.29-06-01-PLAN.md -- Fix data contract mismatch + exit-code handling in gate sweeps

## Progress

**Execution Order:** v0.29-01 -> v0.29-02 -> v0.29-03 -> v0.29-04 -> v0.29-05 -> v0.29-06

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.29-01. Layer Manifest and Evidence Foundation | 3/3 | Complete    | 2026-03-06 |
| v0.29-02. Semantics Layer and Gate A Grounding | 3/3 | Complete    | 2026-03-06 |
| v0.29-03. Reasoning Enrichment and Gate B Abstraction | 2/2 | Complete    | 2026-03-06 |
| v0.29-04. Gate C Validation and Test Generation | 3/3 | Complete   | 2026-03-06 |
| v0.29-05. Dashboard and Progressive Maturity Rollout | 1/1 | Complete    | 2026-03-06 |
| v0.29-06. Tech Debt Cleanup — nf-solve Fixes and Bookkeeping Sync | 1/1 | Complete | 2026-03-06 |