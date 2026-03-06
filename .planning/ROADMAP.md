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

<details>
<summary>v0.28 Phase Details (not started)</summary>

### Overview

This milestone optimizes the nForma agent harness for production use -- adding configurable hook profiles, quorum response caching, budget-aware model downgrade, stall detection, smart compaction timing, security sweep, session state reminders, and a unified harness diagnostic tool. All 10 features integrate into existing hooks and scripts; no new hook files are needed.

### Phases

- [ ] **Phase v0.28-01: Foundation -- Hook Profiles + De-Sloppify** - Configurable hook profiles and post-verification cleanup subagent
- [ ] **Phase v0.28-02: Data Pipeline -- Quorum Cache + Pass@k Metrics** - SHA-256 quorum response caching and pass@k conformance tracking
- [ ] **Phase v0.28-03: Runtime Intelligence -- Budget Downgrade + Stall Detection + Smart Compact** - Token budget monitoring, stall escalation, and workflow-aware compaction suggestions
- [ ] **Phase v0.28-04: Safety & Diagnostics -- Security Sweep + Session State + Harness Diagnostics** - Verify-time security scanning, session state reminders, and unified diagnostic reporting

</details>

## v0.29 — Three-Layer Formal Verification Architecture

### Overview

This milestone organizes nForma's existing 92+ formal models and 35K+ conformance traces into a three-layer architecture (Evidence, Semantics, Reasoning) connected by three inter-layer gates (Grounding, Abstraction, Validation). The build is strictly bottom-up: Layer 1 establishes what is actually observed, Layer 2 grounds the operational model in real traces, and Layer 3 connects hazard analysis back to evidence and code. Each gate quantifies alignment between its adjacent layers, producing a single cross-layer dashboard that shows verification health at a glance.

## Phases

- [ ] **Phase v0.29-01: Layer Manifest and Evidence Foundation** - Register all formal artifacts into layer architecture and build L1 evidence collection infrastructure
- [ ] **Phase v0.29-02: Semantics Layer and Gate A Grounding** - Derive operational semantics from traces and quantify how well models explain observed behavior
- [ ] **Phase v0.29-03: Reasoning Enrichment and Gate B Abstraction** - Apply FMEA hazard analysis to operational model and enforce traceability from reasoning back to semantics
- [ ] **Phase v0.29-04: Gate C Validation and Test Generation** - Close the loop from reasoning outputs to executable test scenarios with nf-solve and run-formal-verify integration
- [ ] **Phase v0.29-05: Dashboard and Progressive Maturity Rollout** - Surface cross-layer alignment in a single terminal view

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
**Plans**: TBD

### Phase v0.29-02: Semantics Layer and Gate A Grounding
**Goal**: Layer 2 captures what the system is supposed to do (invariants, mismatches, assumptions) grounded in Layer 1 evidence, with a quantitative alignment score
**Depends on**: Phase v0.29-01
**Requirements**: SEM-01, SEM-02, SEM-03, SEM-04, GATE-01
**Success Criteria** (what must be TRUE):
  1. Running the invariant catalog script produces a unified catalog containing both declared invariants (from TLA+/Alloy specs) and observed invariants (mined from traces) with source attribution
  2. Running a trace comparison produces JSONL mismatch entries tracking every L2-model vs L1-trace disagreement with resolution status (open/explained/bug)
  3. Running the assumption register script produces a catalog of assumptions made when deriving L2 from L1, each with validation status and linked L2 states
  4. Running Gate A produces a numeric grounding_score (traces_explained / total_traces) with target >= 80% and classifies every unexplained trace into instrumentation bug, model gap, or genuine violation
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

### Phase v0.29-05: Dashboard and Progressive Maturity Rollout
**Goal**: Users see cross-layer verification health in a single terminal view and all models progress through gate maturity levels
**Depends on**: Phase v0.29-04
**Requirements**: INTG-04
**Success Criteria** (what must be TRUE):
  1. Running the cross-layer alignment dashboard displays L1 coverage %, Gate A score, Gate B score, and Gate C score in a single terminal view
  2. The dashboard reflects real-time state: changes from any prior phase (new traces, updated models, gate score changes) appear on next dashboard invocation
**Plans**: TBD

## Progress

**Execution Order:** v0.29-01 -> v0.29-02 -> v0.29-03 -> v0.29-04 -> v0.29-05

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.29-01. Layer Manifest and Evidence Foundation | 0/TBD | Not started | - |
| v0.29-02. Semantics Layer and Gate A Grounding | 0/TBD | Not started | - |
| v0.29-03. Reasoning Enrichment and Gate B Abstraction | 0/TBD | Not started | - |
| v0.29-04. Gate C Validation and Test Generation | 0/TBD | Not started | - |
| v0.29-05. Dashboard and Progressive Maturity Rollout | 0/TBD | Not started | - |
