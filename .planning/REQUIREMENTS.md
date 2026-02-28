# Requirements: QGSD v0.19 FV Pipeline Hardening

**Defined:** 2026-02-27
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v1 Requirements

Requirements for v0.19 milestone. Adapted from external v2.1 plan to QGSD's existing FV substrate (v0.12/v0.14 tools).

### UNIF — Unified Verdict Format

Normalize all FV tool output to one canonical stream so triage, CI, and dashboards read a single source.

- [ ] **UNIF-01**: All FV checkers (TLC, Alloy, PRISM, trace validator, redaction) append one normalized JSON line to `formal/check-results.ndjson` per check run, conforming to `formal/check-result.schema.json`
- [ ] **UNIF-02**: `run-formal-verify.cjs` orchestrator generates `formal/check-results.ndjson` as its canonical output artifact (replacing ad-hoc per-tool stdout)
- [ ] **UNIF-03**: Triage bundle (diff-report summary in `run-formal-verify.cjs`) reads from `check-results.ndjson`, not tool stdout
- [ ] **UNIF-04**: CI step exits non-zero when any `result=fail` entry exists in `check-results.ndjson`

### CALIB — Calibration Governance

Prevent day-one calibration thrash: PRISM checks must warn (not fail) until sufficient evidence accumulates.

- [x] **CALIB-01**: `formal/policy.yaml` defines cold-start thresholds (`min_ci_runs`, `min_quorum_rounds`, `min_days`) and steady-state calibration mode (`warn`/`fail`)
- [x] **CALIB-02**: `run-prism.cjs` reads `policy.yaml` and emits `result=warn` (never `result=fail`) for calibration checks during cold start
- [x] **CALIB-03**: Evidence-driven checks include `observation_window` metadata (window_start/end, n_rounds, n_events) in their `check-results.ndjson` entry
- [x] **CALIB-04**: PRISM conservative-priors fallthrough documented in `policy.yaml` with threshold values for switching from priors to empirical scoreboard rates

### LIVE — Liveness Fairness Declarations

Make liveness properties operationally meaningful by requiring explicit fairness assumptions.

- [x] **LIVE-01**: Each liveness property in TLA+ specs has a companion entry in `formal/spec/<surface>/invariants.md` declaring the fairness assumption (`WF_vars`/`SF_vars`/`SF_actions`) and realism rationale
- [x] **LIVE-02**: TLA+ checker emits `result=inconclusive` (not `result=pass`) when a liveness `.cfg` is present but the corresponding `invariants.md` has no fairness declaration

### REDACT — Redaction Enforcement

Make PII/secret redaction structurally enforced, not just documented.

- [x] **REDACT-01**: `formal/trace/redaction.yaml` defines forbidden keys (field names) and forbidden value patterns (regex) for trace event payloads
- [x] **REDACT-02**: `bin/check-trace-redaction.cjs` validates all trace event files against `redaction.yaml` and appends a `formalism=redaction` entry to `check-results.ndjson`
- [x] **REDACT-03**: CI step runs `check-trace-redaction.cjs` and fails when any forbidden key or pattern is found in trace artifacts

### EVID — Evidence Confidence

"Never observed" paths require time qualifiers before they can be trusted as absence evidence.

- [x] **EVID-01**: `validate-traces.cjs` `never_observed` output includes support metadata: `n_rounds`, `window_days`, `confidence` tier
- [x] **EVID-02**: Confidence thresholds defined: low = <50 rounds or <3 days; medium = ≥500 rounds and ≥14 days; high = ≥10k rounds and ≥90 days (quorum rounds as event volume analogue)

### DRIFT — Trace Schema Drift Guard

Schema changes to `trace.schema.json` must atomically co-update validator and emitter.

- [x] **DRIFT-01**: `bin/check-trace-schema-drift.cjs` detects when `formal/trace/trace.schema.json` is modified without co-modifying `validate-traces.cjs` or trace emitter files in the same commit
- [x] **DRIFT-02**: CI step runs `check-trace-schema-drift.cjs` and fails on non-atomic schema changes

### MCPENV — MCP Environment Modeling

Model MCP servers as nondeterministic environment processes to verify QGSD's retry/fallback behavior formally.

- [x] **MCPENV-01**: `formal/spec/mcp-calls/environment.md` defines MCP servers as nondeterministic environment processes with allowed response set (success/failure/timeout/reorder) and timing model (retry limits, backoff assumptions)
- [x] **MCPENV-02**: TLA+ spec `formal/tla/QGSDMCPEnv.tla` models MCP call behavior — nondeterministic response choices within declared bounds; checks quorum's fault-tolerance properties under arbitrary MCP failures
- [x] **MCPENV-03**: Trace schema extended to include `request_id`, `peer` (MCP slot name), `outcome` (success/fail/timeout), `attempt` (retry count) for MCP-interaction events; `validate-traces.cjs` validates these fields
- [x] **MCPENV-04**: PRISM model `formal/prism/mcp-availability.pm` calibrated from scoreboard UNAVAIL rates using existing `readScoreboardRates()` pattern; emits availability property check to `check-results.ndjson`

### IMPR — R3.6 Iterative Improvement Protocol

Implement R3.6 end-to-end: slot-worker improvements field, quorum signal emission, outer loop in orchestrators.

- [x] **IMPR-01**: `agents/qgsd-quorum-slot-worker.md` parses `Improvements:` section from model output when `request_improvements: true`; result block includes `improvements:` YAML field; test coverage via unit or integration tests
- [x] **IMPR-02**: `commands/qgsd/quorum.md` collects `improvements:` fields from final-round worker blocks, de-duplicates, and emits `<!-- QUORUM_IMPROVEMENTS_START [...] QUORUM_IMPROVEMENTS_END -->` HTML comment signal
- [x] **IMPR-03**: `qgsd-core/workflows/plan-phase.md` implements R3.6 outer loop: parses QUORUM_IMPROVEMENTS signal, spawns improvement-revision planner, loops up to 10 iterations with conflict detection; installed to `~/.claude/qgsd/`
- [x] **IMPR-04**: `qgsd-core/workflows/quick.md` implements matching R3.6 outer loop; all direct `CLAUDE.md` file-read instructions removed from workflow/agent files and replaced with self-contained references; installed to `~/.claude/qgsd/`

## v2 Requirements

Deferred to future release.

### MCPENV Extensions

- **MCPENV-05**: Alloy model for MCP roster constraints (which combinations of UNAVAILABLE slots still satisfy min_quorum)
- **MCPENV-06**: Petri net visualization of MCP call lifecycle with deadlock detection

### v0.16 Deferred

- **SPEC-01**: Plan-to-spec pipeline — PLAN.md → formal spec fragments (TLA+/Alloy/PRISM)
- **SPEC-02**: Iterative verification loop — Claude iterates on PLAN.md until formal verification passes
- **SPEC-03**: Mind map generation — PLAN.md → Mermaid mind map for quorum visual context

## Out of Scope

| Feature | Reason |
|---------|--------|
| v0.17 Auto-Chain Context Resilience | Different milestone track — execute-phase re-entrancy; not part of FV hardening |
| Alloy environment model for MCP | Deferred to v2 (MCPENV-05) — add after TLA+ model validated |
| Redaction of PLAN.md content | Out of scope — traces only; PLAN.md redaction is a separate concern |
| Per-surface PRISM models beyond quorum + MCP | High complexity; MCPENV-04 covers the highest-value case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UNIF-01 | Phase v0.19-01 | Pending |
| UNIF-02 | Phase v0.19-01 | Pending |
| UNIF-03 | Phase v0.19-01 | Pending |
| UNIF-04 | Phase v0.19-01 | Pending |
| CALIB-01 | Phase v0.19-02 | Complete |
| CALIB-02 | Phase v0.19-02 | Complete |
| CALIB-03 | Phase v0.19-02 | Complete |
| CALIB-04 | Phase v0.19-02 | Complete |
| LIVE-01 | Phase v0.19-03 | Complete |
| LIVE-02 | Phase v0.19-07 | Complete |
| REDACT-01 | Phase v0.19-04 | Complete |
| REDACT-02 | Phase v0.19-04 | Complete |
| REDACT-03 | Phase v0.19-04 | Complete |
| EVID-01 | Phase v0.19-04 | Complete |
| EVID-02 | Phase v0.19-04 | Complete |
| DRIFT-01 | Phase v0.19-04 | Complete |
| DRIFT-02 | Phase v0.19-04 | Complete |
| MCPENV-01 | Phase v0.19-05 | Complete |
| MCPENV-02 | Phase v0.19-08 | Complete |
| MCPENV-03 | Phase v0.19-05 | Complete |
| MCPENV-04 | Phase v0.19-08 | Complete |
| IMPR-01 | Phase v0.19-06 | Complete |
| IMPR-02 | Phase v0.19-06 | Complete |
| IMPR-03 | Phase v0.19-06 | Complete |
| IMPR-04 | Phase v0.19-06 | Complete |

**Coverage:**
- v1 requirements: 25 total (UNIF-01..04, CALIB-01..04, LIVE-01..02, REDACT-01..03, EVID-01..02, DRIFT-01..02, MCPENV-01..04, IMPR-01..04)
- Mapped to phases: 25
- Unmapped: 0 ✓
- Gap closure phases: LIVE-02 → v0.19-07, MCPENV-02/04 → v0.19-08

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-28 after Phase v0.19-09 complete — LIVE-01, REDACT-01..03, EVID-01..02, DRIFT-01..02, MCPENV-01..04 checkboxes and traceability table updated from Pending to Complete*
