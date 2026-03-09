# Project Research Summary

**Project:** nForma v0.33 -- Outer-Loop Convergence Guarantees
**Domain:** Iterative formal verification convergence tracking for nf:solve
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

The v0.33 milestone adds cross-session convergence guarantees to nForma's existing 19-layer solve pipeline. Today, each `nf:solve` run is stateless -- `solve-state.json` is overwritten, session summaries are pruned to 20, and no mechanism detects whether repeated runs are making progress or oscillating. The research confirms this is a well-scoped problem: the data sizes are tiny (12 layers, max 200 changelog entries, ~20 sessions), the required algorithms are elementary (linear regression, run-length encoding, ratio scoring), and the existing codebase already has proven patterns for every technique needed (NDJSON append files, cross-session signature persistence, Haiku-based classification). Zero new npm dependencies are required.

The recommended approach is a layered build: first establish the time series infrastructure and fix pre-existing data quality issues (promotion changelog deduplication), then add oscillation detection and stabilization gates, then predictive power scoring, and finally the TLA+ meta-verification spec. This ordering is driven by strict data dependencies -- oscillation detection consumes time series data, stabilization gates consume the changelog, and the TLA+ spec must model the finalized algorithms. The architecture introduces 4 new `.cjs` scripts and 4 new JSON/NDJSON data files, all following the established zero-dependency pattern. Integration with existing code is minimal: ~10 lines added to `nf-solve.cjs`'s finalize block, ~7-line guard clauses in two promotion scripts, and template additions to the solve report.

The primary risks are (1) false positive oscillation detection due to legitimate multi-layer cascades being misidentified as oscillation, (2) over-constrained convergence metrics that treat scope growth (adding requirements) as divergence, and (3) breaking the existing inner-loop convergence behavior by coupling outer-loop state into `solve-state.json`. All three are preventable with disciplined architecture: separate files for outer-loop state, per-layer granularity with grace periods, and scope-growth-aware metrics that store requirement counts alongside residuals.

## Key Findings

### Recommended Stack

Zero new npm dependencies. All new scripts are self-contained `.cjs` files using Node.js built-ins (`fs`, `path`, `crypto`). The formal pipeline currently has zero external dependencies, and the required algorithms (OLS regression in 5 lines, moving average in 1 line, run-length encoding in 10 lines, ratio computation in 1 line) do not justify adding any. Data sizes are too small for performance to matter.

**Core technologies:**
- Node.js built-in `fs`: NDJSON append/read for time series -- same pattern as existing `check-results.ndjson`
- Inline OLS linear regression: trend detection on residual series -- 15-line implementation, no library warranted
- TLA+ (TLC model checker): NFSolveConvergence spec -- already in formal verify pipeline, new spec proves outer-loop convergence

**New files (not libraries):**
- `bin/convergence-history.cjs` (~150 LOC): append time series, query trends, compute moving averages
- `bin/detect-oscillation.cjs` (~200 LOC): per-layer oscillation detection with Option C enforcement
- `bin/score-predictive-power.cjs` (~250 LOC): link test failures to formal properties, score per model
- `bin/stabilization-gates.cjs` (~180 LOC): cooldown enforcement before re-promotion

### Expected Features

**Must have (table stakes):**
- Cross-session residual time series -- foundation for all convergence claims
- Per-layer trend detection -- aggregate total hides layer-level regressions
- Layer oscillation breaker (Option C) -- prevents unbounded fix-break-fix cycles
- Stabilization gates for promotions -- stops the flip-flop already visible in changelog data
- Promotion flip-flop detection -- diagnosis of historical alternating patterns
- Solve session persistence in machine-readable JSONL format

**Should have (differentiators):**
- Predictive power scoring -- invert coverage metric into effectiveness metric (bugs_predicted/total_bugs)
- NFSolveConvergence TLA+ spec -- meta-verification: TLA+ proving the TLA+ verification tool converges
- Convergence velocity estimation -- "when will we converge?" extrapolation for planning
- Per-model gate persistence with reasons -- `--write-per-model` wired as default
- Automatic escalation classification -- Haiku-based root cause when breaker fires

**Defer (v2+):**
- Automatic oscillation resolution -- masks design conflicts, human judgment required
- Global convergence threshold -- layers have vastly different scales
- Real-time convergence dashboard -- over-engineering for a CLI tool
- Weighted layer importance -- introduces subjective tuning that obscures convergence
- MOOSE-style relaxation/dampening -- inapplicable to discrete mismatch counts

### Architecture Approach

The architecture adds a cross-session convergence layer on top of the existing single-run solve pipeline. New scripts read existing state files (`solve-state.json`, `promotion-changelog.json`, `check-results.ndjson`) but never write to them. Cross-session state lives in dedicated new files. Integration with existing code is through 3 call sites in `nf-solve.cjs`'s finalize block, 2 guard clauses in promotion scripts, and template additions to the solve report. All new calls are fail-open (try/catch) so a corrupt convergence file never blocks the inner loop.

**Major components:**
1. `convergence-history.cjs` -- append-only time series with FIFO pruning (100 entries), trend analysis via linear regression
2. `detect-oscillation.cjs` -- per-layer oscillation detection using direction-reversal counting, verdict persistence in `oscillation-verdicts.json`
3. `stabilization-gates.cjs` -- cooldown enforcement (time + session count) before auto re-promotion, flip-flop counting
4. `score-predictive-power.cjs` -- test failure to formal property linkage, recall-first scoring per model
5. `NFSolveConvergence.tla` -- TLA+ spec with safety (no layer oscillates >1x) and conditional liveness (convergence under fairness)

### Critical Pitfalls

1. **False positive oscillation on legitimate cascades** -- Multi-layer solvers produce temporary per-variable regression during convergence (Gauss-Seidel effect). Use 5-session sliding windows with linear regression slopes, not consecutive-pair comparison. Add 2-3 session grace periods after promotion events.

2. **Over-constrained convergence blocking scope growth** -- Adding new requirements legitimately increases residuals. Store requirement counts in each time series entry; separate scope growth from regression in the convergence metric. Never hard-block on total residual increase without checking requirement count changes.

3. **Breaking existing inner-loop convergence** -- Outer-loop state must live in separate files. The outer loop reads `solve-state.json` but NEVER writes to it. Run existing TLC specs after every phase to verify no inner-loop invariant regression. Recovery cost is HIGH if this goes wrong.

4. **Promotion changelog deduplication failure (pre-existing)** -- Current changelog has 4+ identical promotions within 2 minutes for the same model. Fix deduplication BEFORE building any convergence analysis on this data. Building trend analysis on dirty data produces garbage results.

5. **TLA+ spec missing fairness declarations** -- Liveness properties are vacuously true without explicit fairness assumptions. The existing liveness fairness CI lint (v0.20) must pass on the new spec. Model Option C as safety (invariant), convergence as conditional liveness.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Time Series Foundation and Data Quality
**Rationale:** Everything else depends on clean historical data. The convergence metric definition and storage format must be right from the start -- changing them later invalidates all accumulated time series data. Pre-existing changelog dedup bug must be fixed before any convergence tracker reads the changelog.
**Delivers:** `convergence-history.cjs`, `convergence-history.json`, JSONL session persistence, changelog deduplication fix, `nf-solve.cjs` finalize integration (append call)
**Addresses:** Solve session persistence (JSONL), cross-session residual time series, per-model gate persistence wiring
**Avoids:** Pitfall 4 (unbounded time series), Pitfall 5 (inner-loop breakage), Pitfall 7 (changelog dedup)

### Phase 2: Oscillation Detection and Trend Analysis
**Rationale:** Depends on Phase 1 time series data. Option C oscillation breaker is the core safety feature of v0.33 -- it prevents unbounded fix-break-fix cycles. Trend detection is a prerequisite for oscillation detection (distinguishing genuine oscillation from noise).
**Delivers:** `detect-oscillation.cjs`, `oscillation-verdicts.json`, per-layer trend reporting, `solve.md` Phase 3c integration
**Uses:** convergence-history.json (from Phase 1), inline OLS regression
**Implements:** Layer oscillation breaker (Option C), per-layer trend detection
**Avoids:** Pitfall 1 (false positive oscillation -- grace periods and window-based analysis built in from start)

### Phase 3: Gate Maturity Stabilization
**Rationale:** Independent of oscillation detection (operates on promotion-changelog.json, not residual time series). Can be built in parallel with Phase 2, but sequencing after Phase 2 ensures the deduped changelog from Phase 1 is available.
**Delivers:** `stabilization-gates.cjs`, `stabilization-gates.json`, guard clauses in `compute-per-model-gates.cjs` and `promote-gate-maturity.cjs`
**Addresses:** Stabilization gates, promotion flip-flop detection
**Avoids:** Pitfall 6 (wrong stabilization window -- use time + session count from day one)

### Phase 4: Predictive Power Feedback
**Rationale:** Needs a stable convergence loop (Phases 1-3) to produce meaningful data. Scoring models on an oscillating system gives noise. Keep predictive power as informational (not a gate input) for the first milestone to avoid Goodhart's Law metric gaming.
**Delivers:** `score-predictive-power.cjs`, `predictive-power.json`, solve-report.md predictive power section
**Addresses:** Predictive power scoring, automatic escalation classification
**Avoids:** Pitfall 3 (metric gaming -- severity-weighted, informational-only initially)

### Phase 5: TLA+ Meta-Verification
**Rationale:** Must be written last because the spec models the finalized algorithms from Phases 1-4. Writing the spec before the oscillation breaker design is stable means rewriting it when the design changes.
**Delivers:** `NFSolveConvergence.tla`, `MCconvergenceOuter.cfg`, liveness fairness lint validation
**Addresses:** NFSolveConvergence TLA+ spec, convergence velocity estimation
**Avoids:** Pitfall 8 (missing fairness -- explicit declarations required, liveness fairness CI lint must pass)

### Phase 6: Solve Report Integration
**Rationale:** Consumes all outputs from Phases 1-5. Purely presentational -- template additions to solve-report.md for trend, oscillation, and predictive power sections.
**Delivers:** Updated `solve-report.md` with cross-session trend, oscillation verdicts, and model predictive power sections
**Addresses:** All reporting and UX concerns from pitfalls research

### Phase Ordering Rationale

- **Data dependencies drive ordering:** convergence-history (Phase 1) feeds oscillation detection (Phase 2) and trend analysis. Stabilization gates (Phase 3) are independent of time series but need the deduped changelog from Phase 1. Predictive power (Phase 4) needs stable loop data. TLA+ spec (Phase 5) formalizes the finalized system.
- **Safety-critical features come early:** Option C oscillation breaker (Phase 2) is the core guarantee. Stabilization gates (Phase 3) prevent the already-visible flip-flop pattern.
- **Observation before enforcement:** Phase 1 establishes measurement. Phase 2-3 add enforcement. Phase 4 adds scoring (informational first). Phase 5 adds formal proof. This avoids the anti-pattern of enforcing constraints before understanding the data.
- **Inner-loop isolation preserved throughout:** Every phase reads existing files, writes to new separate files. No phase modifies `solve-state.json` schema or `promotion-changelog.json` entry format.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Oscillation detection threshold tuning requires real data analysis. The 5-session window and noise threshold (delta > 5% of baseline) are educated guesses that need validation against the actual residual history once Phase 1 is live.
- **Phase 4:** Predictive power scoring requires defining what counts as a "bug predicted" vs "bug found by other means." The linkage between formal properties and test failures via traceability-matrix.json needs careful design.
- **Phase 5:** TLA+ spec fairness assumptions need to be identified during Phase 1 metric design, even though the spec is written in Phase 5. Document fairness requirements early.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Well-documented NDJSON append pattern already used in the codebase. Changelog dedup is straightforward.
- **Phase 3:** Stabilization gates follow the established guard-before-mutate pattern with clear precedent in Flagger/Argo Rollouts.
- **Phase 6:** Report template additions with no new logic.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All patterns verified against existing codebase. Data sizes confirmed trivial. |
| Features | MEDIUM | Novel combination of techniques (formal verification + convergence tracking + defect prediction). Individual techniques well-documented, but integration is unprecedented. |
| Architecture | HIGH | All integration points verified against source code line numbers. Existing inner-loop TLC spec provides regression safety net. |
| Pitfalls | HIGH | Multiple pitfalls confirmed by direct evidence in existing data (changelog dedup, flip-flop patterns). Cascade false-positive risk validated by Gauss-Seidel convergence theory. |

**Overall confidence:** HIGH -- The domain is novel but the implementation techniques are standard. The biggest risk is metric design (convergence definition, oscillation thresholds), not technology.

### Gaps to Address

- **Oscillation threshold calibration:** The 5-session window and noise threshold are theoretical defaults. Need empirical validation against real residual data after Phase 1 ships. Plan for a tuning pass after 10+ sessions of data accumulate.
- **Scope-growth detection mechanism:** The research identifies the need to store requirement counts alongside residuals, but the exact mechanism for detecting "new requirements added between sessions" vs "existing requirements regressed" needs design work during Phase 1 planning.
- **Predictive power linkage definition:** How exactly does a formal property "predict" a bug? The traceability-matrix.json provides requirement-to-test links, but the temporal ordering (formal check failed BEFORE test caught it) needs a precise definition and data model.
- **Stabilization window defaults:** The research recommends 3 sessions + 30 min (SOFT_GATE) and 5 sessions + 2 hours (HARD_GATE), but these are educated guesses. Plan for configurable values with empirical tuning.
- **Mann-Kendall vs OLS for trend detection:** FEATURES.md recommends Mann-Kendall (non-parametric, resistant to outliers); STACK.md and ARCHITECTURE.md use OLS linear regression. Both work for this data size. Recommend OLS for simplicity (5 lines vs 30+ lines for Mann-Kendall) with the option to upgrade if outlier resistance becomes necessary.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `bin/nf-solve.cjs` (3623 lines), `bin/compute-per-model-gates.cjs`, `bin/promote-gate-maturity.cjs` -- verified integration points
- Existing data: `solve-state.json` (12 layers, residuals 0-6245), `promotion-changelog.json` (67KB, dedup issues confirmed)
- Existing patterns: `hooks/nf-circuit-breaker.js` (oscillation signatures), `check-results.ndjson` (NDJSON append)
- Existing TLA+: `NFSolveOrchestrator.tla` (386 lines, inner-loop spec)

### Secondary (MEDIUM confidence)
- [MOOSE Fixed-Point Iteration](https://mooseframework.inl.gov/syntax/Executioner/FixedPointAlgorithms/) -- relaxation and oscillation handling in coupled physics solvers
- [Flagger/Argo Rollouts](https://docs.flagger.app/usage/how-it-works) -- canary promotion with sustained metric health gates
- [The 4/delta Bound: LLM-Verifier convergence](https://arxiv.org/pdf/2512.02080) -- convergence bounds for iterative verification loops
- [Effort-aware defect prediction metrics](https://link.springer.com/article/10.1007/s10664-022-10186-7) -- recall-prioritized evaluation

### Tertiary (LOW confidence)
- Mann-Kendall trend test applicability to discrete count data with < 20 data points -- needs validation against actual residual series
- Convergence velocity estimation accuracy with < 10 data points -- may produce unreliable extrapolations

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
