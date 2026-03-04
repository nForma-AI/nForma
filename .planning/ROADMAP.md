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
- 📋 **v0.27 — Production Feedback Loop** — Phases v0.27-01..v0.27-05 (planned)

## Phases

> **v0.2 through v0.26 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

### 📋 v0.27 — Production Feedback Loop

**Milestone Goal:** Close the gap between QGSD's formal verification pipeline and production reality by adding a unified observe skill that pulls production signals, a fingerprint-deduplicating debt ledger, and a P->F residual layer in solve that compares formal model thresholds against observed production metrics.

- [ ] **Phase v0.27-01: Debt Schema & Fingerprinting Foundation** - Debt ledger schema, state machine, retention policy, and fingerprinting algorithms
- [ ] **Phase v0.27-02: Observe Skill Core** - Pluggable observe command replacing triage with parallel source fetching and debt write-through
- [ ] **Phase v0.27-03: Cross-Source Deduplication** - Fingerprint matching, near-duplicate merging, and formal parameter linkage
- [ ] **Phase v0.27-04: Production Source Types** - Prometheus, Grafana, and Logstash source handlers (framework-ready)
- [ ] **Phase v0.27-05: Solve P->F Integration** - Production-to-Formal residual layer closing the feedback loop

## Phase Details

### Phase v0.27-01: Debt Schema & Fingerprinting Foundation
**Goal**: A validated debt ledger exists with correct schema, state machine enforcement, retention policy, and deterministic fingerprinting algorithms for both issues and drifts
**Depends on**: Nothing (first phase)
**Requirements**: DEBT-01, DEBT-03, DEBT-04, FP-01, FP-02
**Status**: 1/3 plans complete (33%)
**Success Criteria** (what must be TRUE):
  1. `.formal/debt.json` exists with validated schema (id, fingerprint, title, occurrences, first_seen, last_seen, environments, status, formal_ref, source_entries) and ajv validation passes
  2. Debt status transitions enforce the state machine (open -> acknowledged -> resolving -> resolved) and reject invalid transitions (e.g., resolved -> open)
  3. Resolved entries older than max_age are archived to `.formal/debt-archive.jsonl` when retention runs
  4. Issues produce stable fingerprints via the hierarchical strategy (exception type -> function name -> message pattern hash) — same input always yields same fingerprint
  5. Drifts produce stable fingerprints by formal parameter key — identical parameter keys always map to the same fingerprint
**Plans**: 3 plans
Plans:
- [ ] v0.27-01-01-PLAN.md — Schema definition, validation, and state machine (DEBT-01, DEBT-03)
- [x] v0.27-01-02-PLAN.md — Issue and drift fingerprinting algorithms (FP-01, FP-02) ✅ (2026-03-04, 12min, 38 tests)
- [ ] v0.27-01-03-PLAN.md — Ledger I/O, retention policy, and integration test (DEBT-04)

### Phase v0.27-02: Observe Skill Core
**Goal**: Users can run `/qgsd:observe` to fetch issues from all configured sources in parallel, see severity-sorted output split into Issues and Drifts tables, and have results written to the debt ledger
**Depends on**: Phase v0.27-01
**Requirements**: OBS-01, OBS-02, OBS-06, OBS-07, OBS-08, DEBT-06
**Success Criteria** (what must be TRUE):
  1. `/qgsd:observe` fetches from all configured sources (GitHub, Sentry, Sentry feedback, bash) in parallel and renders a severity-sorted triage table — matching current `/qgsd:triage` behavior
  2. Adding a new source type requires only a new fetch handler function and config entry — no changes to the observe orchestrator
  3. Observe output presents two tables: Issues (discrete events) and Drifts (quantitative divergences from formal parameters)
  4. Observe config lives in `.planning/observe-sources.md` YAML frontmatter, backward-compatible with existing triage config
  5. One failing source does not block the others — each handler has configurable timeout and fail-open behavior
**Plans**: 3 plans
Plans:
- [ ] v0.27-01-01-PLAN.md — Schema definition, validation, and state machine (DEBT-01, DEBT-03)
- [ ] v0.27-01-02-PLAN.md — Issue and drift fingerprinting algorithms (FP-01, FP-02)
- [ ] v0.27-01-03-PLAN.md — Ledger I/O, retention policy, and integration test (DEBT-04)

### Phase v0.27-03: Cross-Source Deduplication
**Goal**: Observations from multiple sources are deduplicated by fingerprint, near-duplicates are merged, and debt entries link to formal model references
**Depends on**: Phase v0.27-01, Phase v0.27-02
**Requirements**: FP-03, FP-04, DEBT-02, DEBT-05
**Success Criteria** (what must be TRUE):
  1. New observations with matching fingerprints increment occurrence count and update last_seen instead of creating duplicate debt entries
  2. Cross-source near-duplicates are detected via Levenshtein similarity (configurable threshold, default 0.85) on titles when fingerprints do not match
  3. When two debt entries merge by fingerprint, source_entries from both are preserved and the entry with higher occurrence count is kept as primary
  4. Each debt entry can link to a formal reference (model file, parameter key, requirement ID) via the formal_ref field
**Plans**: 3 plans
Plans:
- [ ] v0.27-01-01-PLAN.md — Schema definition, validation, and state machine (DEBT-01, DEBT-03)
- [ ] v0.27-01-02-PLAN.md — Issue and drift fingerprinting algorithms (FP-01, FP-02)
- [ ] v0.27-01-03-PLAN.md — Ledger I/O, retention policy, and integration test (DEBT-04)

### Phase v0.27-04: Production Source Types
**Goal**: Observe supports Prometheus, Grafana, and Logstash as pluggable source types with framework-ready handlers
**Depends on**: Phase v0.27-02
**Requirements**: OBS-03, OBS-04, OBS-05
**Success Criteria** (what must be TRUE):
  1. `/qgsd:observe` with a `prometheus` source executes a PromQL query against a configured endpoint and maps results to the standard issue schema
  2. `/qgsd:observe` with a `grafana` source fetches active alerts from a configured Grafana instance and maps them to the standard issue schema
  3. `/qgsd:observe` with a `logstash` source runs an Elasticsearch query against a configured endpoint and maps hits to the standard issue schema
**Plans**: 3 plans
Plans:
- [ ] v0.27-01-01-PLAN.md — Schema definition, validation, and state machine (DEBT-01, DEBT-03)
- [ ] v0.27-01-02-PLAN.md — Issue and drift fingerprinting algorithms (FP-01, FP-02)
- [ ] v0.27-01-03-PLAN.md — Ledger I/O, retention policy, and integration test (DEBT-04)

### Phase v0.27-05: Solve P->F Integration
**Goal**: The solve command includes a Production-to-Formal residual layer that reads acknowledged debt, compares against formal thresholds, and dispatches remediation — closing the feedback loop
**Depends on**: Phase v0.27-01, Phase v0.27-03
**Requirements**: PF-01, PF-02, PF-03, PF-04, PF-05
**Success Criteria** (what must be TRUE):
  1. `bin/qgsd-solve.cjs` includes a P->F residual layer that reads `.formal/debt.json` and compares acknowledged drift entries against formal model thresholds
  2. The P->F residual count equals the number of acknowledged debt entries where production measurements diverge from formal parameter values
  3. Solve operates only on debt entries with status `acknowledged` — `open` entries are ignored until a human triages them
  4. New observe runs do not modify debt entries in `resolving` status — observations are frozen during a solve cycle
  5. P->F remediation dispatches `/qgsd:quick` tasks to update formal model parameters or flags investigation when production has regressed
**Plans**: 3 plans
Plans:
- [ ] v0.27-01-01-PLAN.md — Schema definition, validation, and state machine (DEBT-01, DEBT-03)
- [ ] v0.27-01-02-PLAN.md — Issue and drift fingerprinting algorithms (FP-01, FP-02)
- [ ] v0.27-01-03-PLAN.md — Ledger I/O, retention policy, and integration test (DEBT-04)

## Progress

**Execution Order:** v0.27-01 -> v0.27-02 -> v0.27-03 (also needs 01) -> v0.27-04 (parallel with 03) -> v0.27-05

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.27-01. Debt Schema & Fingerprinting Foundation | 0/TBD | Not started | - |
| v0.27-02. Observe Skill Core | 0/TBD | Not started | - |
| v0.27-03. Cross-Source Deduplication | 0/TBD | Not started | - |
| v0.27-04. Production Source Types | 0/TBD | Not started | - |
| v0.27-05. Solve P->F Integration | 0/TBD | Not started | - |
