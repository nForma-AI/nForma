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
- ✅ **v0.36 — Solve Loop Convergence & Correctness** — Phases v0.36-01..v0.36-05 (shipped 2026-03-15)

> **v0.2 through v0.36 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

---

## v0.37 — Close the Loop: Cross-Layer Feedback Integration

**Milestone Goal:** Close six information gaps between nForma subsystems so that knowledge flows bidirectionally — tests link back to requirements, scanners learn from FP feedback, gates self-promote, and quorum debates produce reusable precedents.

## Phases

- [x] **Phase v0.37-01: Annotation Back-Linking** - Test and code files link back to requirements via @requirement annotations and proximity graph edges (completed 2026-03-16)
- [x] **Phase v0.37-02: Gate Auto-Promotion** - Models with consecutive clean passes auto-promote from SOFT_GATE to HARD_GATE with logged evidence (completed 2026-03-16)
- [x] **Phase v0.37-03: Scanner FP Tuning** - Scanners track per-category false-positive rates and auto-adjust suppression thresholds (completed 2026-03-16)
- [x] **Phase v0.37-04: Quorum Precedents** - Debate archives are mined for reusable decisions that enrich future quorum dispatch (completed 2026-03-16)
- [x] **Phase v0.37-05: Hypothesis Targeting** - Hypothesis measurement transitions influence solve remediation wave ordering (completed 2026-03-16)

## Phase Details

### Phase v0.37-01: Annotation Back-Linking
**Goal**: Requirements traceability flows backward from tests and code to requirements, eliminating false orphan flags
**Depends on**: Nothing (first phase)
**Requirements**: TLINK-01, TLINK-02, TLINK-03, CLINK-01, CLINK-02
**Success Criteria** (what must be TRUE):
  1. A test file with `@requirement TLINK-01` is not flagged as orphaned by the T->R scanner for that requirement ID
  2. Running `bin/annotate-tests.cjs` on a test directory produces `@requirement` comment suggestions based on proximity graph edges
  3. T->R scanner output includes an annotation coverage percentage alongside the orphan test count
  4. C->R scanner consulting proximity-index.json suppresses flagging for code-requirement pairs with score >= 0.6
  5. `@requirement` annotations in source files (bin/*.cjs) create direct edges in the proximity graph builder output
**Plans:** 3/3 plans complete
Plans:
- [ ] v0.37-01-01-PLAN.md — Proximity graph source annotation edges + C->R scanner suppression (CLINK-01, CLINK-02)
- [ ] v0.37-01-02-PLAN.md — T->R scanner annotation recognition + coverage reporting (TLINK-01, TLINK-03)
- [ ] v0.37-01-03-PLAN.md — annotate-tests.cjs suggestion tool (TLINK-02)

### Phase v0.37-02: Gate Auto-Promotion
**Goal**: Gates self-promote when models demonstrate sustained correctness, removing manual promotion overhead
**Depends on**: Nothing (independent)
**Requirements**: GPROMO-01, GPROMO-02, GPROMO-03
**Success Criteria** (what must be TRUE):
  1. model-registry.json entries contain a `consecutive_pass_count` field that increments on pass and resets to 0 on fail
  2. A model with consecutive_pass_count >= 3, wiring >= 1.0, and semantic >= 0.8 auto-promotes from SOFT_GATE to HARD_GATE without user intervention
  3. Each auto-promotion is logged to promotion-changelog.json with an evidence snapshot during solve Phase 4 (report)
**Plans:** 1/1 plans complete
Plans:
- [ ] v0.37-02-01-PLAN.md — consecutive_pass_count tracking + gated HARD_GATE promotion + tests (GPROMO-01, GPROMO-02, GPROMO-03)

### Phase v0.37-03: Scanner FP Tuning
**Goal**: Scanners self-calibrate by tracking false-positive rates and raising suppression thresholds for chronic offenders
**Depends on**: Phase v0.37-01 (annotation back-linking reduces baseline FP rates that tuning builds upon)
**Requirements**: FPTUNE-01, FPTUNE-02, FPTUNE-03
**Success Criteria** (what must be TRUE):
  1. solve-classifications.json tracks per-scanner per-category FP rates across a rolling window of the last 10 sessions
  2. A scanner with FP rate > 60% over 5+ sessions has its suppression threshold auto-raised by 0.1 (capped at 0.9)
  3. Running `/nf:solve --report-only` displays a per-scanner FP rate table in the diagnostics output
**Plans**: TBD

### Phase v0.37-04: Quorum Precedents
**Goal**: Past quorum decisions become queryable knowledge that enriches future quorum dispatch with relevant context
**Depends on**: Nothing (independent)
**Requirements**: QPREC-01, QPREC-02, QPREC-03
**Success Criteria** (what must be TRUE):
  1. Running `bin/extract-precedents.cjs` against debate archives produces `.planning/quorum/precedents.json` with BLOCK/APPROVE decisions and reasoning
  2. Quorum dispatch prompts include up to 3 keyword-matched precedents relevant to the current question
  3. Precedents older than 90 days are automatically pruned and do not appear in dispatch prompts
**Plans:** 2/2 plans complete
Plans:
- [ ] v0.37-04-01-PLAN.md — Extract-precedents.cjs tool + tests (QPREC-01)
- [ ] v0.37-04-02-PLAN.md — Precedent matching, TTL pruning, and dispatch injection (QPREC-02, QPREC-03)

### Phase v0.37-05: Hypothesis Targeting
**Goal**: Hypothesis measurement transitions directly influence which layers get remediated first in solve waves
**Depends on**: Nothing (uses solve-wave-dag.cjs from v0.36)
**Requirements**: HTARGET-01, HTARGET-02
**Success Criteria** (what must be TRUE):
  1. When a hypothesis transitions from UNMEASURABLE to CONFIRMED or VIOLATED, its parent layer receives +1 priority weight in the next solve remediation wave
  2. solve-wave-dag.cjs reads hypothesis measurements and adjusts wave ordering so layers with recent transitions execute before layers without
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in sequence: v0.37-01 -> v0.37-02 -> v0.37-03 -> v0.37-04 -> v0.37-05
(Phases 02, 04, 05 are independent but sequenced for orderly delivery; Phase 03 depends on Phase 01)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.37-01. Annotation Back-Linking | 0/3 | Complete    | 2026-03-16 |
| v0.37-02. Gate Auto-Promotion | 0/1 | Complete    | 2026-03-16 |
| v0.37-03. Scanner FP Tuning | 0/TBD | Complete    | 2026-03-16 |
| v0.37-04. Quorum Precedents | 0/2 | Complete    | 2026-03-16 |
| v0.37-05. Hypothesis Targeting | 0/TBD | Complete    | 2026-03-16 |

---
*Last updated: 2026-03-16 after v0.37-04 phase planning*
