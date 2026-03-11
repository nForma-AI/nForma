# Roadmap: nForma

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1-17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18-22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23-31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32-38 (shipped 2026-02-23)
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
- ✅ **v0.28 — Agent Harness Optimization** — Phases v0.28-01..v0.28-04 (shipped 2026-03-06)
- ✅ **v0.29 — Three-Layer Formal Verification Architecture** — Phases v0.29-01..v0.29-06 (shipped 2026-03-06)
- ✅ **v0.30 — Advanced Agent Patterns** — Phases v0.30-01..v0.30-09 (shipped 2026-03-08)
- ✅ **v0.31 — Ruflo-Inspired Hardening** — Phases v0.31-01..v0.31-03 (shipped 2026-03-08)
- ✅ **v0.32 — Documentation & README Overhaul** — Phases v0.32-01..v0.32-04 (shipped 2026-03-09)
- ✅ **v0.33 — Outer-Loop Convergence Guarantees** — Phases v0.33-01..v0.33-06 (shipped 2026-03-10)
- [ ] **v0.34 — Semantic Gate Validation & Auto-Promotion** — Phases v0.34-01..v0.34-06 (in progress)

> **v0.2 through v0.33 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

---

## v0.34 — Semantic Gate Validation & Auto-Promotion

**Milestone Goal:** Evolve gate scoring from structural wiring checks to semantic correctness validation using graph-based proximity discovery and LLM-judged candidate pairing, then wire auto-promotion into the solve cycle.

## Phases

- [x] **Phase v0.34-01: Gate Renaming** - Rename Gate A/B/C to Wiring:Evidence/Purpose/Coverage with backward-compatible migration (completed 2026-03-11)
- [x] **Phase v0.34-02: Semantic Scoring** - Graph BFS candidate discovery + Haiku evaluation producing per-gate semantic_score (completed 2026-03-11)
- [ ] **Phase v0.34-03: Pairing & Auto-Promotion** - N:N candidate pairing workflow + solve-cycle auto-promotion with flip-flop protection
- [ ] **Phase v0.34-04: Semantic Scoring Pipeline Wiring** - Wire compute-semantic-scores.cjs into solve pipeline; fix gate schema v3 preservation (gap closure)
- [x] **Phase v0.34-05: Auto-Promotion State Initialization** - Initialize consecutive_clean_sessions; fix checkCleanSession semantic_score dependency (gap closure) (completed 2026-03-11)
- [x] **Phase v0.34-06: E2E Integration Test** - Integration test validating full semantic -> promotion pipeline (gap closure) (completed 2026-03-11)

## Phase Details

### Phase v0.34-01: Gate Renaming
**Goal**: Gate files, scripts, and displays use descriptive Wiring:Evidence/Purpose/Coverage names instead of opaque A/B/C labels
**Depends on**: Nothing (first phase)
**Requirements**: NAME-01, NAME-02, NAME-03, NAME-04
**Success Criteria** (what must be TRUE):
  1. Running compute-per-model-gates.cjs produces gate JSON files with wiring_score fields (not grounding_score/gate_b_score/gate_c_score)
  2. The TUI gate scoring page and solve report display "Wiring:Evidence", "Wiring:Purpose", "Wiring:Coverage" labels
  3. Old gate JSON files with legacy field names are still readable without errors — existing data is not lost during transition
  4. All scripts that consume gate scores (run-formal-verify.cjs, nf-solve, cross-layer dashboard) work correctly with renamed fields
**Plans**: TBD

### Phase v0.34-02: Semantic Scoring
**Goal**: Each gate carries a semantic_score derived from graph-based proximity discovery and LLM-judged candidate evaluation, measuring how well models actually cover their linked requirements
**Depends on**: Phase v0.34-01
**Requirements**: SEM-01, SEM-02, SEM-03, SEM-04, SEM-05
**Success Criteria** (what must be TRUE):
  1. Running the semantic scoring script discovers unlinked (model, requirement) pairs within 3 hops of the proximity graph with score > 0.6
  2. Strong candidates are evaluated by Haiku and receive a yes/no/maybe verdict stored with the candidate record
  3. Gate JSON files contain both wiring_score and semantic_score fields after a scoring run
  4. Running semantic scoring twice on the same graph state and model text produces identical results (idempotent)
**Plans**: 2 plans
  - [ ] v0.34-02-01-PLAN.md — Graph BFS candidate discovery (candidate-discovery.cjs + tests)
  - [ ] v0.34-02-02-PLAN.md — Haiku semantic evaluation + gate score aggregation (haiku-semantic-eval.cjs + compute-semantic-scores.cjs + tests)

### Phase v0.34-03: Pairing & Auto-Promotion
**Goal**: Graph-discovered candidate pairings flow through human confirmation into model-registry, and the solve cycle auto-promotes stable models from SOFT_GATE to HARD_GATE
**Depends on**: Phase v0.34-02
**Requirements**: PAIR-01, PAIR-02, PAIR-03, PAIR-04, PROMO-01, PROMO-02, PROMO-03, PROMO-04, PROMO-05
**Success Criteria** (what must be TRUE):
  1. candidate-pairings.json contains all discovered (model, requirement) candidates with proximity scores and Haiku verdicts
  2. Running /nf:resolve loads candidate-pairings.json and presents graph-suggested links for human confirmation
  3. Confirmed pairings are written to model-registry.json requirements arrays; rejected pairings are cached and not re-evaluated
  4. After 3 consecutive clean solve sessions (wiring >= 1.0, semantic >= 0.8, all formal checks pass), eligible models auto-promote from SOFT_GATE to HARD_GATE
  5. All promotions are logged to promotion-changelog.json and flip-flop detection prevents re-promotion of unstable models
**Plans**: TBD

### Phase v0.34-04: Semantic Scoring Pipeline Wiring
**Goal**: compute-semantic-scores.cjs is called in the nf-solve pipeline and gate JSON files retain schema v3 semantic_score fields across solve cycles
**Depends on**: Phase v0.34-02, Phase v0.34-03
**Requirements**: SEM-03, SEM-04
**Gap Closure**: Closes gaps from audit — integration issues #1, #2, #5; flow "Semantic validation pipeline"
**Success Criteria** (what must be TRUE):
  1. nf-solve.cjs invokes compute-semantic-scores.cjs after gate computation
  2. compute-per-model-gates.cjs preserves semantic_score fields (schema v3) instead of overwriting to v2
  3. After a full solve cycle, gate JSON files contain both wiring_score and semantic_score fields
**Plans**: 1 plan
Plans:
- [ ] v0.34-04-01-PLAN.md — Schema v3 preservation + pipeline wiring (compute-per-model-gates.cjs + nf-solve.cjs)

### Phase v0.34-05: Auto-Promotion State Initialization
**Goal**: consecutive_clean_sessions is properly initialized and checkCleanSession() correctly evaluates semantic_score from enriched gates
**Depends on**: Phase v0.34-04
**Requirements**: PROMO-02, PROMO-03, PROMO-04
**Gap Closure**: Closes gaps from audit — integration issue #3, #4; flow "Auto-promotion pipeline"
**Success Criteria** (what must be TRUE):
  1. solve-state.json contains consecutive_clean_sessions field initialized to 0
  2. checkCleanSession() reads semantic_score from enriched gates (not always 0) and correctly evaluates >= 0.8 threshold
  3. After 3 consecutive clean sessions, auto-promotion fires and logs to promotion-changelog.json
**Plans**: TBD

### Phase v0.34-06: E2E Integration Test
**Goal**: Integration test validates the complete semantic scoring -> gate enrichment -> auto-promotion pipeline end-to-end
**Depends on**: Phase v0.34-04, Phase v0.34-05
**Requirements**: (validation of SEM-03, SEM-04, PROMO-02, PROMO-03, PROMO-04)
**Gap Closure**: Closes E2E flow gaps from audit
**Success Criteria** (what must be TRUE):
  1. Test runs compute-semantic-scores, verifies gate files contain semantic_score
  2. Test simulates 3 clean sessions and verifies auto-promotion triggers
  3. Test verifies promotion-changelog.json is written with correct fields
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in sequence: v0.34-01 -> v0.34-02 -> v0.34-03 -> v0.34-04 -> v0.34-05 -> v0.34-06

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.34-01. Gate Renaming | 2/2 | Complete    | 2026-03-11 |
| v0.34-02. Semantic Scoring | 0/TBD | Complete    | 2026-03-11 |
| v0.34-03. Pairing & Auto-Promotion | 0/TBD | Not started | - |
| v0.34-04. Semantic Scoring Pipeline Wiring | 0/1 | Not started | - |
| v0.34-05. Auto-Promotion State Initialization | 0/TBD | Complete    | 2026-03-11 |
| v0.34-06. E2E Integration Test | 0/TBD | Complete    | 2026-03-11 |

---

*Roadmap created: 2026-02-20*
*Last updated: 2026-03-11 after v0.34-04 planning*
