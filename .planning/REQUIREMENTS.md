# Requirements: QGSD v0.21 FV Closed Loop

**Defined:** 2026-03-01
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.21 Requirements

### Model Architecture — ARCH

All formal models must live in a single central directory that every part of QGSD writes to directly. Currently updates happen through three disconnected flows (manual edits, XState generation, per-phase scratch files) with no promotion path — insights from debug sessions, planning, and verification get siloed and lost.

- [ ] **ARCH-01**: Formal models have a single canonical home — `formal/` is declared the single source of truth for all living models; a `formal/model-registry.json` tracks each model's last-updated timestamp, update source (`generate`, `debug`, `plan-promote`, `manual`), and version; all update flows write to `formal/` directly, never to per-phase scratch only
- [ ] **ARCH-02**: Per-phase proposed specs have a promotion path to central — when a plan's `proposed-changes.tla` (PLAN-01) is accepted post-verification, a `promote-model.cjs` script merges the accepted invariants into the canonical `formal/tla/` spec and updates `model-registry.json`; promotes are atomic (tmp file + rename)
- [ ] **ARCH-03**: Debug-discovered invariants write to the central registry — when LOOP-04 accepts a new invariant candidate, it is written directly to the appropriate `formal/tla/<surface>.tla` spec (not a sidecar file); `model-registry.json` records `update_source: "debug"` and the session ID that produced it

### Feedback Loops — LOOP

The formal verification pipeline currently runs but does not update itself from what it observes. These requirements close the gap between empirical data and model inputs, making FV self-calibrating.

- [ ] **LOOP-01**: PRISM calibration is automatically current — `export-prism-constants.cjs` runs as a pre-step inside `run-prism.cjs` so PRISM always uses the latest scoreboard rates, not stale `rates.const`
- [ ] **LOOP-02**: TLA+/Alloy specs auto-regenerate when the XState machine changes — a PostToolUse hook on writes to `src/machines/qgsd-workflow.machine.ts` triggers `generate-formal-specs.cjs` automatically
- [ ] **LOOP-03**: Sensitivity sweep results feed back into PRISM calibration — after `run-sensitivity-sweep.cjs`, if empirical rates deviate from tested ranges, `rates.const` is updated and PRISM re-runs; CI fails if threshold is newly violated
- [ ] **LOOP-04**: Debug sessions capture new invariant candidates — `/qgsd:debug` gains a post-session step that asks "did this session reveal new state transitions or invariants?" and proposes them as TLA+ `PROPERTY` candidates for acceptance/rejection

### Spec Completeness — SPEC

The most critical parts of QGSD have no formal model. These requirements close the most important spec gaps.

- [ ] **SPEC-01**: Stop hook logic has a TLA+ specification — `QGSDStopHook.tla` formalizes `HasPlanningCommand ∧ ¬HasQuorumEvidence ⟹ decision = BLOCK`; TLC verifies safety (BLOCK ⟹ HasPlanningCommand) and liveness (HasQuorumEvidence ⟹ <>PASS); wired into `run-formal-verify.cjs`
- [ ] **SPEC-02**: Run-collapse algorithm is verified against its implementation — `QGSDOscillation.tla` is audited against `qgsd-circuit-breaker.js`; any drift (esp. the second-pass net-diff check) is identified and the spec updated to match the implementation's correct behavior; TLC re-verified
- [ ] **SPEC-03**: Quorum composition selection has an Alloy model — `quorum-composition.als` verifies composition selection rules: `∀ config: no config selects 0 slots when ≥1 available`, `risk_level=high ⟹ fan-out = maxSize`, `solo mode ⟹ exactly 1 slot polled`; wired into `run-alloy.cjs`
- [ ] **SPEC-04**: Requirements are verifiable as LTL formulas — `must_haves: truths:` blocks in `task-envelope.json` are translated to TLA+ `PROPERTY` checks in a per-phase scratch spec; `qgsd-verifier` runs TLC against them and reports "proved" vs "satisfied" in `VERIFICATION.md`

### Diagnostic Infrastructure — DIAG

69% of conformance traces currently diverge from the XState machine with no tooling to investigate why. These requirements build the missing debugging bridge between specs and implementations.

- [ ] **DIAG-01**: Conformance trace divergence is diagnosed and fixed — `validate-traces.cjs` is updated to export the first 10 divergent traces as structured objects (TTrace format); root cause attributed to specific XState guards or hook implementations; divergence rate reduced to <5%
- [ ] **DIAG-02**: A counterexample-to-root-cause tool exists — `bin/attribute-trace-divergence.cjs` takes a divergent trace, walks the XState machine guards, identifies which transition fails, and outputs a structured report: "fix XState guard X" or "fix hook implementation Y at line Z"
- [ ] **DIAG-03**: Divergence attribution surfaces the pivot decision — when `attribute-trace-divergence.cjs` finds a violation, it presents both fix directions with evidence: spec-bug path (update XState + regenerate) vs impl-bug path (fix hook + re-run traces); outputs written to `formal/diff-report.md`

### Planning Integration — PLAN

Closes the v0.16 deferral. Formal verification currently runs against the existing system; it does not verify proposed changes before they are built.

- [ ] **PLAN-01**: Plans auto-synthesize TLA+ deltas — `plan-phase.md` gains a step that generates a scratch TLA+ spec fragment from the plan's `must_haves: truths:` block, representing proposed state machine changes; saved to `.planning/phases/<phase>/formal/proposed-changes.tla`
- [ ] **PLAN-02**: An iterative verification loop gates planning — TLC runs against the proposed-changes spec; if it fails, Claude iterates on PLAN.md (capped at 3 attempts); quorum only sees a plan that either passes TLC or has reached the iteration cap with documented failures
- [ ] **PLAN-03**: Quorum slots receive formal evidence — the quorum slot-worker prompt gains a `formal_spec_summary` field (proposed TLA+ properties) and `verification_result` field (TLC pass/fail/inconclusive); agents vote with this mathematical context attached

### Operational Signals — SIG

Formal verification produces results that currently go unused for operational decisions. These requirements turn FV output into actionable signals.

- [ ] **SIG-01**: TLC state-space coverage gaps are visible — a new `bin/detect-coverage-gaps.cjs` diffs `{states TLC reaches}` vs `{states observed in conformance traces}`; unreached states are written to `formal/coverage-gaps.md` as a test/coverage backlog
- [ ] **SIG-02**: Phase dependency graph is a Petri net — `generate-petri-net.cjs` is extended to generate a Petri net from the roadmap's phase dependency structure (phases as transitions, completion tokens enable downstream phases); critical path is computed and shown via `--roadmap` flag
- [ ] **SIG-03**: PRISM failure probabilities rank roadmap items — a new `bin/prism-priority.cjs` reads PRISM model results and outputs a ranked list of failure modes by `P(failure) × impact`; output is injected into `plan-phase.md` quorum context as a roadmap prioritization signal
- [ ] **SIG-04**: Quorum rounds are gated by PRISM consensus probability — before each quorum round, current scoreboard availability rates are plugged into `formal/prism/mcp-availability.pm`; if `P(consensus_reached) < threshold` (default 0.70), the round is deferred with a structured warning rather than proceeding with a weak quorum

## v0.22 Requirements (deferred)

### Future Planning Integration

- **PLAN-FUTURE-01**: Mind map generation — PLAN.md → Mermaid mind map saved to `.planning/phases/<phase>/MINDMAP.md`, injected into quorum slot-worker context
- **PLAN-FUTURE-02**: General-purpose code → spec — expose the QGSD code-to-spec pipeline as a reusable tool for any project using QGSD (hybrid AST + JSDoc annotations)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Continuous Bayesian prior update | Cold-start → steady-state threshold (policy.yaml) is the right model; continuous Bayes adds complexity without proportional benefit |
| UPPAAL expansion beyond quorum races | Timed automata modelling is covered; additional UPPAAL models require tool expertise investment disproportionate to value |
| General-purpose JSDoc annotation spec extraction | Deferred to v0.22 |

## Traceability

*Populated during roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | — | Pending |
| ARCH-02 | — | Pending |
| ARCH-03 | — | Pending |
| LOOP-01 | — | Pending |
| LOOP-02 | — | Pending |
| LOOP-03 | — | Pending |
| LOOP-04 | — | Pending |
| SPEC-01 | — | Pending |
| SPEC-02 | — | Pending |
| SPEC-03 | — | Pending |
| SPEC-04 | — | Pending |
| DIAG-01 | — | Pending |
| DIAG-02 | — | Pending |
| DIAG-03 | — | Pending |
| PLAN-01 | — | Pending |
| PLAN-02 | — | Pending |
| PLAN-03 | — | Pending |
| SIG-01 | — | Pending |
| SIG-02 | — | Pending |
| SIG-03 | — | Pending |
| SIG-04 | — | Pending |

**Coverage:**
- v0.21 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after initial definition*
