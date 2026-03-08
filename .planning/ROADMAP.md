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
- ✅ **v0.30 — Advanced Agent Patterns** — Phases v0.30-01..v0.30-06 (shipped 2026-03-08), gap closure in progress

> **v0.2 through v0.30 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

### v0.30 Gap Closure

#### Phase v0.30-08: Continuous Learning Integration Fix
**Goal:** Close all LRNG-01..04 gaps identified by milestone audit — fix install.js SessionEnd hook registration, wire skill-extractor.cjs into automated pipeline, resolve config-loader convention tech debt, and produce missing VERIFICATION.md
**Depends on:** Phase v0.30-04 (executed but unverified)
**Requirements:** LRNG-01, LRNG-02, LRNG-03, LRNG-04
**Gap Closure:** Closes gaps from v0.30-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. `node bin/install.js --claude --global` registers nf-session-end.js as a SessionEnd hook in settings.json — re-install does not silently drop it
  2. skill-extractor.cjs is invoked automatically by nf-session-end.js during session end processing (not orphaned)
  3. context_retrieval_enabled config key uses config-loader two-layer merge (DEFAULT_CONFIG -> global -> project) instead of direct .claude/nf.json read
  4. Phase v0.30-04 has a VERIFICATION.md that validates LRNG-01..04 satisfaction with evidence
**Plans:** 2 plans
Plans:
- [ ] v0.30-08-01-PLAN.md — Fix install.js registration, wire skill-extractor, fix config-loader convention
- [ ] v0.30-08-02-PLAN.md — Create VERIFICATION.md for v0.30-04 with LRNG-01..04 evidence

---

## v0.31 — Ruflo-Inspired Hardening

### Overview

v0.31 hardens nForma's hook and quorum infrastructure with three layers of improvement: deterministic hook execution ordering with input validation, runtime safety boundaries for circuit breaker persistence and quorum slot control, and developer experience improvements for config normalization, rule sharding, and debate templates. All changes are internal quality improvements -- no new user-facing commands, just more reliable, observable, and maintainable behavior from existing ones.

### Phases

- [ ] **Phase v0.31-01: Hook Infrastructure Hardening** - Deterministic hook priority ordering and JSON schema validation for hook stdin
- [ ] **Phase v0.31-02: Runtime Safety Boundaries** - Circuit breaker trigger persistence, per-slot latency budgets, and restricted tool access for review-only slots
- [ ] **Phase v0.31-03: Config & Governance DX** - Rule relevance sharding, bidirectional config adapter, and structured debate templates

### Phase Details

#### Phase v0.31-01: Hook Infrastructure Hardening
**Goal**: Hooks execute in a deterministic, validated order so safety-critical hooks always run first and malformed input never causes silent failures
**Depends on**: Nothing (first phase)
**Requirements**: PRIO-01, VALID-01
**Success Criteria** (what must be TRUE):
  1. User can set `hook_priority` values in nf.json and observe that the circuit-breaker hook always executes before prompt-injection and other enhancement hooks, regardless of filesystem ordering
  2. User sees a diagnostic message on stderr when a hook receives malformed JSON on stdin, followed by a clean fail-open exit (not a crash or silent swallow)
  3. Hook stdin JSON is checked against a lightweight schema; fields with wrong types or missing required keys produce a structured error identifying the specific validation failure
**Plans**: TBD

#### Phase v0.31-02: Runtime Safety Boundaries
**Goal**: Quorum dispatch and circuit breaker operate within explicit safety boundaries -- latency budgets cut off slow slots, review-only slots cannot write files, and oscillation signatures are remembered across sessions
**Depends on**: Phase v0.31-01
**Requirements**: BRKR-01, LTCY-01, EXEC-01
**Success Criteria** (what must be TRUE):
  1. When circuit breaker fires, the oscillation trigger pattern (file set, alternation count, time window) is written to `.planning/formal/evidence/` as a JSON file that future sessions can read to preemptively detect the same signature -- the breaker eventually returns to monitoring state after resolution (formal: MonitoringReachable)
  2. User can set per-slot latency budgets in providers.json (e.g., `"latency_budget_ms": 15000`); a slot exceeding its budget is terminated mid-dispatch and marked TIMEOUT in telemetry instead of blocking the entire quorum pipeline
  3. Quorum slot workers performing review-only tasks (verification, code review) are dispatched with restricted tool access (Read/Grep/Glob only) -- no Bash, Write, or Edit tools available to review slots
  4. Quorum reaches a DECIDED state on every run where at least one slot responds, even when latency-budget timeouts remove slots mid-dispatch (formal: EventualConsensus)
**Plans**: TBD

#### Phase v0.31-03: Config & Governance DX
**Goal**: Users experience cleaner configuration, lower per-turn token cost from rule sharding, and parseable debate records
**Depends on**: Phase v0.31-01
**Requirements**: SHARD-01, ADAPT-01, ADR-01
**Success Criteria** (what must be TRUE):
  1. `.claude/rules/` files contain relevance tags (tool names, file globs, keywords) and only matching rules load per turn -- user can observe measurably fewer tokens consumed per turn when working in a narrow domain (e.g., only hook rules load during hook editing)
  2. Config values written to nf.json are normalized through an adapter layer -- boolean strings ("true"/"false") are stored as booleans, nested vs flat key formats are bidirectionally converted, and profile names are case-normalized so internal types never leak to config files
  3. Quorum debates in `.planning/quorum/debates/` follow a consistent template (Context, Question, Positions, Decision, Consequences) with frontmatter that downstream tools can parse programmatically
**Plans**: TBD

### Progress

**Execution Order:**
v0.31-01 -> v0.31-02 -> v0.31-03
(v0.31-03 can run after v0.31-01; v0.31-02 depends on v0.31-01)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.31-01. Hook Infrastructure Hardening | 0/TBD | Not started | - |
| v0.31-02. Runtime Safety Boundaries | 0/TBD | Not started | - |
| v0.31-03. Config & Governance DX | 0/TBD | Not started | - |
