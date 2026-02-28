# Requirements: QGSD v0.20 FV as Active Planning Gate

**Defined:** 2026-02-28
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.20 Requirements

### Schema (SCHEMA)

- [ ] **SCHEMA-01**: `formal/check-result.schema.json` extended with `check_id`, `surface`, `property`, `runtime_ms`, `summary`, `triage_tags`, `observation_window` fields per v2.1 spec
- [ ] **SCHEMA-02**: `write-check-result.cjs` emits all v2.1 fields; validation enforces required fields; callers receive typed interface
- [x] **SCHEMA-03**: All 23 callers in `run-formal-verify.cjs` STEPS updated to pass `check_id`, `surface`, `property`, `runtime_ms`, `summary` to `write-check-result.cjs`

### Liveness Lint (LIVE)

- [ ] **LIVE-01**: CI step detects liveness properties lacking a fairness declaration in `invariants.md` and emits `result=inconclusive` instead of `pass`
- [ ] **LIVE-02**: `run-formal-verify.cjs` STEPS includes a `ci:liveness-fairness-lint` step that enforces LIVE-01

### Planning Gate (PLAN)

- [ ] **PLAN-01**: `plan-phase.md` workflow includes a formal verification step (pre-quorum) that runs `run-formal-verify --only=tla`
- [ ] **PLAN-02**: TLC `fail` results from `check-results.ndjson` are surfaced to the planner as hypotheses to address before quorum sees the plan
- [ ] **PLAN-03**: Planning gate is fail-open — TLC failures are surfaced as warnings to the planner, not hard blockers that prevent plan creation

### Verification Gate (VERIFY)

- [ ] **VERIFY-01**: `qgsd-verifier` agent runs `run-formal-verify` after implementation and includes `check-results.ndjson` digest in `VERIFICATION.md`
- [ ] **VERIFY-02**: `VERIFICATION.md` template gains a `## Formal Verification` section summarizing pass/fail/warn counts per formalism (tla, alloy, prism, ci)

### Evidence Confidence (EVID)

- [ ] **EVID-01**: `never_observed` path entries in `validate-traces.cjs` evidence output carry `confidence: low|medium|high` based on trace volume and window duration
- [ ] **EVID-02**: `observation_window` metadata (window_start, window_end, n_traces, n_events, window_days) written to `check-results.ndjson` for evidence-driven checks

### Triage Bundle (TRIAGE)

- [ ] **TRIAGE-01**: `bin/generate-triage-bundle.cjs` reads `check-results.ndjson` and writes `formal/diff-report.md` (per-check delta from last run) and `formal/suspects.md` (checks with `result=fail` or `triage_tags` set)
- [ ] **TRIAGE-02**: `run-formal-verify.cjs` calls `generate-triage-bundle.cjs` as the final step after all checks complete

### UPPAAL Timed Race Modeling (UPPAAL)

- [ ] **UPPAAL-01**: A UPPAAL timed automaton model (`formal/uppaal/quorum-races.xml`) captures the concurrency structure of the quorum protocol — specifically when concurrent slot responses and timeout expirations fire relative to each other. The model uses `runtime_ms` bounds from `check-results.ndjson` as empirical timing constraints (clock guards and invariants), not hardcoded constants.
- [ ] **UPPAAL-02**: `bin/run-uppaal.cjs` executes the UPPAAL model checker (verifyta CLI) against `quorum-races.xml` and writes a check result to `check-results.ndjson` using the v2.1 schema (SCHEMA-01 prerequisite). The STEPS entry `uppaal:quorum-races` is added to `run-formal-verify.cjs`.
- [ ] **UPPAAL-03**: The model surfaces at least two critical measurement points as annotated properties: (a) the minimum inter-slot response gap that prevents a race condition, (b) the maximum timeout value for which the quorum can still reach consensus before the planning gate deadline.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Blocking plan creation on TLC failures | PLAN-03 fail-open rule — FV informs planners, does not gate them; prevents FV flakiness from breaking the workflow |
| Running full 23-step formal verify during plan-phase | Too slow for interactive planning; TLA+ subset only keeps it under 60s |
| Backwards-incompatible schema change | Existing NDJSON lines with 5-field format remain valid; new fields are additive |
| v0.16 plan-to-spec pipeline | Deferred — synthesizing PLAN.md into TLA+ spec fragments is a separate milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | v0.20-01 | Pending |
| SCHEMA-02 | v0.20-01 | Pending |
| SCHEMA-03 | v0.20-01 | Complete |
| LIVE-01 | v0.20-02 | Pending |
| LIVE-02 | v0.20-02 | Pending |
| PLAN-01 | v0.20-03 | Pending |
| PLAN-02 | v0.20-03 | Pending |
| PLAN-03 | v0.20-03 | Pending |
| VERIFY-01 | v0.20-04 | Pending |
| VERIFY-02 | v0.20-04 | Pending |
| EVID-01 | v0.20-05 | Pending |
| EVID-02 | v0.20-05 | Pending |
| TRIAGE-01 | v0.20-06 | Pending |
| TRIAGE-02 | v0.20-06 | Pending |
| UPPAAL-01 | v0.20-07 | Pending |
| UPPAAL-02 | v0.20-07 | Pending |
| UPPAAL-03 | v0.20-07 | Pending |

**Coverage:**
- v0.20 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
