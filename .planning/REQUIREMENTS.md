# Requirements: QGSD v0.14 FV Pipeline Integration

**Defined:** 2026-02-25
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v1 Requirements

Requirements for v0.14 release. Continuation of v0.12 formal verification tooling — integration, hardening, and performance.

### Integration

Commit and wire the existing untracked formal verification tools into the source tree with proper test coverage and pipeline integration.

- [x] **INTG-01**: User can run `bin/xstate-to-tla.cjs` as a committed, tested tool that transpiles an XState machine to TLA+ spec + TLC model config
- [x] **INTG-02**: User can run `bin/run-formal-verify.cjs` as a committed, tested master runner for all formal verification steps
- [x] **INTG-03**: CI automatically runs formal verification on push/PR via `.github/workflows/formal-verify.yml` (file committed and verified)
- [ ] **INTG-04**: `run-formal-verify.cjs` calls `xstate-to-tla.cjs` as its spec generation step (pipeline is end-to-end wired)

### Drift Detection

Drift between the XState machine (source of truth) and formal specs fails visibly in `npm test`.

- [ ] **DRFT-01**: `npm test` fails when XState machine and TLA+/Alloy/PRISM specs are out of sync (check-spec-sync.cjs wired into test suite)
- [ ] **DRFT-02**: Drift detector uses TypeScript compiler/AST walk instead of regex for state extraction — catches transition and guard names, not just state list
- [ ] **DRFT-03**: Drift detector detects orphaned handwritten specs — TLA+ states or guards with no corresponding XState state

### Performance

Parallelization cuts total formal verification runtime by 5×.

- [ ] **PERF-01**: `run-formal-verify.cjs` runs TLA+, Alloy, and PRISM tool groups concurrently (parallel execution, not sequential)
- [ ] **PERF-02**: Total formal verification runtime drops from ~10 min to ~2 min on a standard machine

### PRISM Config Injection

Scoreboard empirical rates flow automatically into PRISM model parameters.

- [ ] **PRISM-01**: PRISM model receives TP/TN rates derived from quorum scoreboard as model parameters at run time
- [ ] **PRISM-02**: Rate injection is automatic — no manual editing of `.pm` files required between quorum runs

### Developer Experience

Watch mode enables continuous verification during development.

- [ ] **DX-01**: `node bin/run-formal-verify.cjs --watch` re-runs verification automatically when the XState machine file changes

## v2 Requirements

Deferred to future release.

- **INTG-05**: `xstate-to-tla.cjs` supports XState v5 parallel states (AND-states) in TLA+ output
- **DRFT-04**: Drift detector produces a human-readable diff report (not just pass/fail)
- **DX-02**: `--watch` mode shows incremental results per tool group (not full re-run summary)
- **PRISM-03**: PRISM config injection supports per-milestone scoreboard slices (not just all-time rates)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New formal models (new `.als`, `.pm`, `.tla` files) | v0.12 shipped the model set; v0.14 hardens the pipeline, not the models |
| Modifying GSD workflows | QGSD is additive only — out of scope per architecture constraint |
| TLA+ LSP / IDE integration | High effort, minimal gain; defer indefinitely |
| PRISM GUI integration | GUI tooling conflicts with CI-first approach |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTG-01 | Phase v0.14-01 | Complete |
| INTG-02 | Phase v0.14-01 | Complete |
| INTG-03 | Phase v0.14-01 | Complete |
| INTG-04 | Phase v0.14-01 | Pending |
| DRFT-01 | Phase v0.14-02 | Pending |
| DRFT-02 | Phase v0.14-02 | Pending |
| DRFT-03 | Phase v0.14-02 | Pending |
| PERF-01 | Phase v0.14-03 | Pending |
| PERF-02 | Phase v0.14-03 | Pending |
| PRISM-01 | Phase v0.14-04 | Pending |
| PRISM-02 | Phase v0.14-04 | Pending |
| DX-01 | Phase v0.14-05 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after initial definition*
