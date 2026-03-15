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
- ✅ **v0.34 — Semantic Gate Validation & Auto-Promotion** — Phases v0.34-01..v0.34-06 (shipped 2026-03-11)
- ✅ **v0.35 — Install & Setup Bug Fixes** — Phases v0.35-01..v0.35-04 (shipped 2026-03-13)

> **v0.2 through v0.35 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

---

## v0.36 — Solve Loop Convergence & Correctness

**Milestone Goal:** Fix active bugs in the solve diagnostic engine, add convergence correctness guarantees (cycle detection, split residual metrics), parallelize remediation dispatch, resolve structural blockers (L2 layer, shared constants), and build comprehensive test coverage.

## Phases

- [x] **Phase v0.36-01: Shared Infrastructure** - Extract shared constants, gate utility, configurable Haiku model, and fix aggregate cache invalidation (completed 2026-03-14)
- [x] **Phase v0.36-02: Diagnostic Correctness** - Fix focus filter propagation, missing-file false pass, and classification cache keying (completed 2026-03-14)
- [x] **Phase v0.36-03: Convergence Intelligence** - Add cycle detection, split residual buckets, capped-layer reporting, and baseline drift detection (completed 2026-03-14)
- [x] **Phase v0.36-04: Architecture & Parallelism** - Resolve L2 layer structural decision and implement wave-parallel remediation dispatch (completed 2026-03-14)
- [x] **Phase v0.36-05: Test Harness** - End-to-end convergence tests, cascade effect tests, focus filter tests, and classification golden set (completed 2026-03-15)

## Phase Details

### Phase v0.36-01: Shared Infrastructure
**Goal**: Common modules exist so all subsequent phases import from single sources of truth instead of duplicating logic
**Depends on**: Nothing (first phase)
**Requirements**: STRUCT-02, STRUCT-03, STRUCT-04, PERF-02
**Success Criteria** (what must be TRUE):
  1. `require('bin/layer-constants.cjs').LAYER_KEYS` returns the canonical 19-layer key array, and solve-trend-helpers, oscillation-detector, and convergence-report all import from it — no local key arrays remain in any consumer
  2. `resolveGateScore(gateData)` from `bin/gate-score-utils.cjs` correctly resolves v1 and v2 gate schema fields, and nf-solve.cjs, solve-trend-helpers.cjs, and cross-layer-dashboard.cjs all use it — no duplicated fallback chains remain
  3. Haiku model version for classification is read from `nf.json` config at runtime, with `claude-haiku-4-5-20251001` as fallback when the config key is absent
  4. After `per_model_gates` writes per-model gate files, `_aggregateCache` is cleared — subsequent alignment layer reads reflect the newly written gate data, not stale cached values
**Plans**: TBD

### Phase v0.36-02: Diagnostic Correctness
**Goal**: The solve diagnostic engine produces accurate residuals — no false zeros from missing files, no leaked unscoped results, no stale classification cache hits
**Depends on**: Phase v0.36-01
**Requirements**: DIAG-01, DIAG-02, CLASS-01
**Success Criteria** (what must be TRUE):
  1. Running `nf:solve --focus AUTH` propagates the focus filter to all 19 layers — every layer either filters its output to the focus set or marks results with `scoped: false`
  2. When `check-results.ndjson` or `requirements.json` is missing, affected layers report `residual: -1` (unknown) instead of `residual: 0` — preventing false convergence signals
  3. D-to-C classification cache keys are SHA-256 content hashes of claim text — changing doc content at the same line number invalidates the cached verdict and triggers reclassification
**Plans**: TBD

### Phase v0.36-03: Convergence Intelligence
**Goal**: The solve loop detects and reports convergence pathologies — oscillation cycles are caught, residual categories are separated, gate caps are visible, and baseline drift is flagged
**Depends on**: Phase v0.36-01
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04
**Success Criteria** (what must be TRUE):
  1. Per-layer residual history is tracked across iterations; when an A-B-A-B oscillation pattern spans 4+ iterations on any layer, that layer is reported as oscillating and excluded from further dispatch — consistent with the formal ConvergenceEventuallyResolves invariant that resolution must terminate rather than loop indefinitely
  2. Solve output reports residual in three distinct buckets (`automatable`, `manual`, `informational`) — the user sees each bucket separately and never a misleading combined total
  3. When any gate dispatch hits the max-3-per-cycle cap, the output JSON includes a `capped_layers` array — users can distinguish "residual remains because capped" from "residual remains because stuck"
  4. At report time, the baseline is re-snapshotted and compared to session-start baseline; drift exceeding 10% is flagged to the user with an explicit warning — preventing misleading before/after deltas from mid-session external edits
**Plans**: TBD

### Phase v0.36-04: Architecture & Parallelism
**Goal**: The L2 structural blocker is resolved (Gate B scores above zero) and remediation dispatch runs in parallel waves instead of sequential steps
**Depends on**: Phase v0.36-01, Phase v0.36-02
**Requirements**: STRUCT-01, PERF-01
**Success Criteria** (what must be TRUE):
  1. L2 (Semantics) layer is either populated with at least 3 semantic models OR collapsed to a 2-layer architecture with Gate A evaluating L1-to-L3 directly — in either case, Gate B no longer reports a permanent zero score
  2. Solve remediation dispatches layers in dependency-ordered waves (max 6 waves) — independent layers within a wave run in parallel, and total remediation wall-clock time is measurably shorter than the previous 13 sequential steps
**Plans**: TBD

### Phase v0.36-05: Test Harness
**Goal**: Comprehensive test coverage validates convergence, cascade effects, focus filtering, and classification accuracy against the implementations from prior phases
**Depends on**: Phase v0.36-02, Phase v0.36-03, Phase v0.36-04
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. An end-to-end integration test runs 3 solve iterations against fixture data and asserts that residual on automatable layers decreases monotonically or stabilizes — consistent with the formal ResolvedAtWriteOnce invariant that convergence progress is never silently reverted
  2. Cascade effect unit tests verify that R-to-F remediation creating new formal models increases F-to-T residual, and the convergence check correctly identifies this as progress (not regression)
  3. Focus filter completeness tests assert all 19 layers either filter by focusSet or mark results with `scoped: false` — no layer silently ignores the filter
  4. A golden set of 100 pre-labeled classification items (25 per category: dtoc, ctor, ttor, dtor) measures Haiku precision and recall per category — establishing a quantitative accuracy baseline
**Plans**: TBD

## Progress

**Execution Order:**
v0.36-01 -> v0.36-02 / v0.36-03 (parallel after 01) -> v0.36-04 (after 01 + 02) -> v0.36-05 (after 02 + 03 + 04)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.36-01. Shared Infrastructure | 1/1 | Complete    | 2026-03-14 |
| v0.36-02. Diagnostic Correctness | 2/2 | Complete    | 2026-03-14 |
| v0.36-03. Convergence Intelligence | 2/2 | Complete    | 2026-03-14 |
| v0.36-04. Architecture & Parallelism | 2/2 | Complete    | 2026-03-14 |
| v0.36-05. Test Harness | 2/2 | Complete    | 2026-03-15 |

---

*Roadmap created: 2026-02-20*
*Last updated: 2026-03-15 after v0.36-05 phase completion (v0.36 milestone complete)*
