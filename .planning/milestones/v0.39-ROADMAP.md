# Roadmap: nForma v0.39 — Dual-Cycle Formal Reasoning

## Overview

This milestone makes formal models the sandbox for both diagnosis and solutions. Three phases deliver the capability incrementally: foundational infrastructure (mode tagging, trace parsing, iteration config), then Cycle 1 diagnostic reframing (targeted diffs when models fail to reproduce bugs), then Cycle 2 solution simulation (fix ideas iterate in model space with automated convergence gates before code is touched). Each phase delivers a coherent, independently verifiable capability that builds on the previous.

## Phases

**Phase Numbering:**
- Milestone-scoped phases (v0.39-01, v0.39-02): Phases scoped to v0.39
- Decimal phases (v0.39-01.1): Urgent gap insertions within milestone

- [x] **Phase v0.39-01: Foundation & Infrastructure** - Verification mode tagging, trace parsing to structured JSON, configurable iteration limits (completed 2026-03-18)
- [x] **Phase v0.39-02: Cycle 1 Diagnostic** - Targeted diagnostic diffs, workflow reframing, quorum injection, guided model refinement (completed 2026-03-18)
- [x] **Phase v0.39-03: Cycle 2 Solution Simulation** - Fix normalization, consequence models, three-gate convergence, simulation loop UX (completed 2026-03-18)

## Phase Details

### Phase v0.39-01: Foundation & Infrastructure
**Goal**: Both cycles can distinguish diagnostic from validation runs, parse checker traces into diffable structures, and respect configurable iteration limits
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03
**Success Criteria** (what must be TRUE):
  1. Every model checker invocation carries a verification_mode tag ('diagnostic' or 'validation') that downstream consumers can read and act on
  2. TLC counterexample traces are parsed into structured JSON with per-state field extraction that can be programmatically compared
  3. Running with --max-iterations N limits both Cycle 1 and Cycle 2 loops to N iterations, and the default of 3 is persisted in .planning/config.json
**Plans**: 2 plans

Plans:
- [x] v0.39-01-01-PLAN.md — Verification mode tagging and configurable iteration limits (2 tasks, 23 tests, 100% pass)
- [ ] v0.39-01-02-PLAN.md — TLC trace parsing and diagnostic diff infrastructure

### Phase v0.39-02: Cycle 1 Diagnostic
**Goal**: When a model fails to reproduce a known bug, users see a targeted diagnostic ("model assumes X but bug shows Y") that guides specific model corrections instead of blind retry
**Depends on**: Phase v0.39-01
**Requirements**: DX1-01, DX1-02, DX1-03, DX1-04
**Success Criteria** (what must be TRUE):
  1. When a model passes (fails to reproduce bug), the system generates a human-readable mismatch diff identifying what the model assumes vs what the bug trace shows
  2. All user-facing output uses "model is incomplete/wrong" language instead of "bug not captured" -- the bug is ground truth, the model is the hypothesis
  3. Quorum workers receive diagnostic diff context in their prompts during refinement iterations so they can reason about what the model is missing
  4. Diagnostic diffs produce specific model correction proposals (which invariants to add/modify, which state variables are missing) rather than generic "try again" guidance
**Plans**: 3 plans

Plans:
- [x] v0.39-02-01-PLAN.md — Model state extractor and correction proposal generator modules (completed 2026-03-18)
- [x] v0.39-02-02-PLAN.md — Evidence-based language reframing across refinement loop and workflows
- [x] v0.39-02-03-PLAN.md — Wire diagnostic pipeline into refinement loop with quorum injection (completed 2026-03-18)

### Phase v0.39-03: Cycle 2 Solution Simulation
**Goal**: Fix ideas iterate entirely in model space -- normalized to mutations, simulated as consequence models, verified through convergence gates -- before any code is touched
**Depends on**: Phase v0.39-02
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04
**Success Criteria** (what must be TRUE):
  1. Users can express fix ideas as natural language, constraint sets, or code sketches and the system normalizes them to formal model mutations without manual translation
  2. Given a reproducing model and a normalized fix intent, the system generates a consequence model representing the post-fix system state
  3. The three-gate convergence check runs automatically: original invariants still hold AND bug no longer triggers (inverted check passes) AND no 2-hop neighbor regressions -- and once a convergence verdict is reached it is not silently reverted (reflecting write-once resolution semantics from the convergence formal model)
  4. The simulation loop displays iteration progress, per-gate pass/fail status, and convergence outcome, escalating to the user after max iterations are exhausted
  5. When an external dependency (model checker, quorum slot) becomes unavailable during simulation, the system preserves all accumulated state without corruption (no partial writes to logs or premature state deletion)
**Plans**: 3 plans

Plans:
- [x] v0.39-03-01-PLAN.md — Intent normalization and consequence model generation (completed 2026-03-18)
- [x] v0.39-03-02-PLAN.md — Three-gate convergence runner with write-once verdict persistence (completed 2026-03-18)
- [x] v0.39-03-03-PLAN.md — Simulation loop orchestrator and model-driven-fix Phase 4.5 integration (completed 2026-03-18)


## Progress

**Execution Order:**
Phases execute in milestone-then-sequence order: v0.39-01 -> v0.39-02 -> v0.39-03

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.39-01. Foundation & Infrastructure | 2/2 | Complete    | 2026-03-18 |
| v0.39-02. Cycle 1 Diagnostic | 3/3 | Complete    | 2026-03-18 |
| v0.39-03. Cycle 2 Solution Simulation | 3/3 | Complete    | 2026-03-18 |
