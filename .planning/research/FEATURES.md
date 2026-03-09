# Feature Research: Outer-Loop Convergence Guarantees (v0.33)

**Domain:** Iterative formal verification convergence with cross-session tracking
**Researched:** 2026-03-09
**Confidence:** MEDIUM (novel domain-specific integration; patterns drawn from numerical methods, control systems, deployment pipelines, and defect prediction -- no direct precedent for this exact combination)

## Feature Landscape

This research covers the six features targeted by v0.33, analyzed against the existing nf:solve infrastructure:
- 19-layer residual sweep with per-layer counts (9 automatable + 5 informational in TLA+, 19 total in implementation)
- solve-state.json storing latest run snapshot (iteration, per-layer residuals, converged boolean)
- Gate A/B/C evaluation per formal model with pass/fail + reason
- Gate maturity progression: ADVISORY -> SOFT_GATE -> HARD_GATE with hysteresis thresholds
- promotion-changelog.json logging all maturity transitions (currently shows flip-flop: 8+ identical ADVISORY->SOFT_GATE entries for same models)
- per-model-gates.json (schema v2, 127 models tracked)
- NFSolveOrchestrator.tla inner-loop spec (verified, 3432 states)
- Circuit breaker with git-history oscillation detection and cross-session evidence persistence (oscillation-signatures.json)

---

### Table Stakes (Users Expect These)

Features that a convergence-guaranteed solve loop must have. Without these, "convergence" is unmeasurable and unenforceable.

| Feature | Why Expected | Complexity | Depends On (Existing) | Notes |
|---------|--------------|------------|----------------------|-------|
| **Cross-session residual trend tracker** | Without persistent history, every solve run starts blind. Users cannot tell if 10 runs improved anything or just churned. Any convergence claim requires time-series evidence. The current solve-state.json stores only the latest snapshot -- no history. | MEDIUM | solve-state.json (exists, single-run snapshot), solve-sessions/ (exists, markdown summaries, 20-session rotation) | Append-only JSONL file (`solve-trend.jsonl`) capturing per-run snapshots: timestamp, iteration_count, per-layer residuals, total residual, converged boolean, gate summary. ~200 bytes/entry. Must include per-layer trend detection: Mann-Kendall non-parametric test (distribution-free, resistant to outliers in short series) reporting DECREASING/STABLE/INCREASING/OSCILLATING per layer. Requires >= 5 data points before meaningful analysis. |
| **Layer oscillation breaker (Option C)** | The inner loop has stall detection (ConvergedStall in TLA+: `currentResidual = prevResidual`) but no per-layer oscillation memory across sessions. A layer going 90->80->85->90 across runs wastes remediation budget. This is the headline convergence guarantee. | HIGH | Cross-session trend tracker (for historical per-layer data), nf-solve.cjs remediate dispatch, nf-circuit-breaker.js (pattern precedent: run-collapse detection, evidence persistence, human escalation via oscillation-signatures.json) | Core invariant: no individual layer oscillates more than once. If a layer's residual increases after a prior decrease within the tracked history, one "oscillation credit" is consumed. Second oscillation -> block automated remediation for that layer + human escalation. Threshold: delta > 5% of layer baseline to filter noise. Analogous to the existing circuit breaker's file-set oscillation detection but applied to residual layers instead of git commit patterns. |
| **Per-model gate persistence in solve pipeline** | per-model-gates.json (schema v2, 127 models) and compute-per-model-gates.cjs (--aggregate --json mode) already exist but the solve pipeline does not write per-model gate reasons by default. Gate results are computed but not persisted with explanations. | LOW | compute-per-model-gates.cjs (exists, --write-per-model flag exists but opt-in), per-model-gates.json (exists, has gate_a/b/c pass+reason per model), nf-solve.cjs sweepPerModelGates() (exists, reads aggregated data) | Wire --write-per-model as default behavior in solve pipeline. Persist gate_a_reason, gate_b_reason, gate_c_reason in solve-state.json output. Carry reasons into solve report. Use gate pass/fail counts as an additional convergence signal. Mostly plumbing work on existing code paths. |
| **Gate maturity stabilization gates** | The promotion-changelog.json already demonstrates the problem: repeated ADVISORY->SOFT_GATE entries for the same models (quorum-votes.als, NFQuorum.tla) within seconds of each other across solve runs. Without a cooldown/stabilization period, maturity flip-flops make gate enforcement meaningless. | MEDIUM | promotion-changelog.json (exists, append-only, shows flip-flop evidence), compute-per-model-gates.cjs appendPromotion() (exists, no cooldown logic), per-model-gates.json (exists, has gate_maturity field but no timestamp tracking) | Three mechanisms needed: (1) Flip-flop detection: scan promotion-changelog for same-model entries alternating between levels; flag models with >= 3 direction changes as UNSTABLE. (2) Cooldown enforcement: add `last_promoted_at` / `last_demoted_at` timestamps to per-model gate records; require configurable stabilization window (default: 2 consecutive solve sessions or 1 hour) before re-promotion. (3) Stabilization count: require N consecutive passes at current level before promotion to next. Pattern from Flagger/Argo Rollouts canary analysis. |

### Differentiators (Competitive Advantage)

Features that go beyond table stakes and provide genuine novel value. These make nForma's convergence provable rather than merely observed.

| Feature | Value Proposition | Complexity | Depends On (Existing) | Notes |
|---------|-------------------|------------|----------------------|-------|
| **NFSolveConvergence TLA+ spec (outer loop)** | The inner loop is already TLA+ verified (NFSolveOrchestrator.tla, 3432 states, 6 safety + 3 liveness properties). Extending this to prove the outer loop converges under Option C assumptions is meta-verification: using TLA+ to verify the verification tool. Very few systems have formal convergence proofs for their own verification pipelines. | HIGH | NFSolveOrchestrator.tla (exists, provides inner-loop composition target), finalized oscillation breaker design (must model real semantics) | Liveness: `<>(converged = TRUE)` under fairness. Safety: `[](oscillation_count[layer] <= 1)` for all layers. Must model: cross-session state (bounded residual history, last N=3-5 sessions), Option C blocking rule, gate maturity transitions. Key challenge: TLC state explosion from session history -- use bounded abstraction. Should compose with (not duplicate) the inner-loop spec. Must be written LAST after Option C design is finalized. |
| **Predictive power feedback loop** | Linking runtime bugs back to formal properties answers "is this formal model actually useful?" Most formal verification systems measure coverage (how much is specified) but never effectiveness (how many bugs did the specs actually catch). A bugs_predicted/total_bugs score per model tells users which models earn their maintenance cost. | HIGH | traceability-matrix.json (exists, v0.25, links requirements to models at 63.8% coverage), failure-taxonomy.json (exists, v0.29, failure mode catalog), test-recipes.json (exists, v0.29, 32 model-driven test recipes), check-results.ndjson (exists, v0.20, enriched schema v2.1), observe skill (exists, v0.27, surfaces bugs from GitHub/Sentry) | Requires new artifact: bug-to-property.json linking observed bugs to formal properties that could have caught them. Scoring: per-model recall (bugs caught / total relevant bugs). Defect prediction literature is clear: recall matters more than precision (a missed bug costs more than a false alarm). Must build the reverse link from the existing forward-traceability infrastructure. |
| **Convergence velocity estimation** | Beyond "are we converging?", estimate "when will we converge?" using residual decay rate extrapolation from the time series. If a layer needs 50+ sessions to converge, it needs architectural intervention, not more solve iterations. | MEDIUM | Cross-session trend tracker (>= 10 data points needed) | Fit exponential decay to per-layer residual time series. Report estimated sessions-to-convergence. Secondary feature -- useful for planning but not convergence-critical. Defer until trend data has accumulated. |
| **Automatic escalation classification** | When oscillation breaker fires, classify root cause: genuine regression vs measurement instability. | MEDIUM | Oscillation breaker, existing Haiku classifier pattern (hooks/nf-circuit-breaker.js uses claude-haiku-4-5-20251001 for GENUINE vs REFINEMENT classification) | Reuse Haiku reviewer pattern. Feed oscillation context (which layer, what changed, git diff) to classifier. Output: GENUINE_REGRESSION / MEASUREMENT_NOISE / INSUFFICIENT_EVIDENCE. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automatic oscillation resolution** | "If it oscillates, just fix it automatically." | Oscillation signals a design conflict between layers that automated remediation cannot resolve. Auto-resolution masks fundamental issues and is literally the fix->break->fix cycle that Option C prevents. | Human escalation with structured diagnosis. The breaker presents oscillation history + Haiku classification; a human decides the resolution. |
| **Global convergence score (single number)** | "Give me one number for formal model health." | Collapses too much information. Current residuals span vastly different scales (git_heatmap: 6245, l3_to_tc: 1). A score of 0.7 is uninterpretable -- which layers are stuck? Leads to gaming the metric. | Per-layer trend sparklines in the solve report with top-3 action items. The trend tracker provides raw data; the report phase synthesizes actionable guidance. |
| **Real-time convergence dashboard** | "Show a live graph during solve." | Solve runs take 30-120 seconds. Real-time visualization (WebSocket, state streaming) adds substantial infrastructure for a 2-minute window. This is a CLI tool. | Post-run ASCII sparkline of residual trend per layer in the terminal report. Zero infrastructure. |
| **Automatic gate demotion on evidence regression** | "If a model's evidence score drops, automatically demote it." | Creates instability. Evidence scores fluctuate as new code is written (new tests may temporarily reduce coverage percentages). Auto-demotion triggers re-promotion triggers oscillation -- exactly what stabilization gates prevent. | Demotion warnings in solve report. Flag regressed models but require explicit human or quorum decision to demote. |
| **Relaxation/dampening of residuals** | "Apply numerical relaxation (MOOSE-style) to smooth oscillations." | MOOSE relaxation operates on continuous numerical values with well-defined norms. nf-solve residuals are discrete mismatch counts. Dampening 90 to 67.5 is meaningless -- you either have 90 mismatches or you do not. | Discrete oscillation bounding (Option C): count direction changes, not amplitude. The breaker operates on the discrete space correctly. |
| **Weighted layer importance** | "Some layers matter more than others." | Introduces subjective tuning that obscures whether convergence is real. A "converged" system with a red-but-low-weight layer is misleading. | All layers must converge independently. Priority can inform ordering of fix attempts, but not the convergence definition. |

## Feature Dependencies

```
Cross-session residual trend tracker
    |
    +--required-by--> Per-layer trend detection (Mann-Kendall, part of tracker)
    |                     |
    |                     +--required-by--> Layer oscillation breaker (Option C)
    |                     |                     |
    |                     |                     +--required-by--> NFSolveConvergence TLA+ spec
    |                     |                     |                     (models finalized Option C semantics)
    |                     |                     |
    |                     |                     +--enhanced-by--> Automatic escalation classification
    |                     |
    |                     +--enables--------> Convergence velocity estimation (needs >= 10 points)
    |
    +--enhances--------> Gate maturity stabilization gates (trend data informs windows)

Per-model gate persistence in solve pipeline
    |
    +--enhances--------> Gate maturity stabilization gates (reasons explain blocked promotions)
    |
    +--enhances--------> Predictive power feedback loop (per-model scores are inputs)

Gate maturity stabilization gates
    +--requires--------> promotion-changelog.json (EXISTS, flip-flop detection source)
    +--requires--------> compute-per-model-gates.cjs (EXISTS, promotion logic)
    +--independent-of--> Cross-session residual time series (operates on changelog, not residuals)

Predictive power feedback loop
    +--requires--------> traceability-matrix.json (EXISTS, v0.25)
    +--requires--------> failure-taxonomy.json (EXISTS, v0.29)
    +--requires--------> Bug source linkage (NEW: bug-to-property.json)
    +--independent-of--> Cross-session time series (different data pipeline)
```

### Dependency Notes

- **Trend tracker is foundational:** Both the oscillation breaker and TLA+ spec depend on cross-session history. Build first.
- **Oscillation breaker before TLA+ spec:** The spec models Option C. Implement the breaker, stabilize the design, then model it. Writing the spec first means rewriting it when the design changes.
- **Stabilization gates are partially independent:** Flip-flop detection operates on promotion-changelog.json, not on residual time series. Can start in parallel with trend tracker. Full temporal stabilization benefits from trend data but does not require it.
- **Predictive power is the most independent feature:** Depends on existing v0.25/v0.29 artifacts plus a new reverse-linkage artifact. No dependency on time series features. Can be built in any phase.
- **Per-model gate persistence is lowest risk:** Extends existing code paths with minimal new logic. Good early delivery for quick value.

## MVP Definition

### Phase 1: Measurement Foundation

- [ ] **Cross-session residual trend tracker** -- append-only JSONL, per-layer trend detection
- [ ] **Per-model gate persistence with reasons** -- wire --write-per-model as default, persist reasons in solve-state.json
- [ ] **Promotion flip-flop detection** -- scan changelog for alternating patterns, flag UNSTABLE models

### Phase 2: Convergence Enforcement

- [ ] **Layer oscillation breaker (Option C)** -- per-layer direction tracking, one-oscillation-credit, human escalation
- [ ] **Gate maturity stabilization gates** -- cooldown window, stabilization count, timestamp tracking

### Phase 3: Formal Proof + Measurement

- [ ] **NFSolveConvergence TLA+ spec** -- outer-loop model with Option C, convergence liveness proof
- [ ] **Predictive power feedback loop** -- bug-to-property backlinks, per-model recall scoring

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Cross-session residual trend tracker | HIGH | LOW | LOW | P1 |
| Per-model gate persistence w/ reasons | MEDIUM | LOW | LOW | P1 |
| Promotion flip-flop detection | MEDIUM | LOW | LOW | P1 |
| Layer oscillation breaker (Option C) | HIGH | HIGH | MEDIUM | P1 |
| Gate maturity stabilization gates | HIGH | MEDIUM | LOW | P1 |
| NFSolveConvergence TLA+ spec | HIGH | HIGH | HIGH | P2 |
| Predictive power feedback loop | MEDIUM | HIGH | MEDIUM | P2 |

**Priority key:**
- P1: Must have -- directly implements convergence guarantees (the milestone goal)
- P2: Should have -- proves or measures the guarantees; system works without them

## Existing Infrastructure Inventory

| Existing Artifact | Used By Feature | How |
|-------------------|----------------|-----|
| solve-state.json | Trend tracker | Snapshot source; trend file appends these per-run |
| solve-sessions/ (20-rotation) | Trend tracker | Existing session storage pattern to follow |
| promotion-changelog.json | Stabilization gates | Flip-flop detection source; already shows the problem |
| per-model-gates.json (schema v2) | Gate persistence, Stabilization | Has gate_maturity + pass/reason per gate; needs timestamps |
| compute-per-model-gates.cjs | Gate persistence, Stabilization | --aggregate --json and --write-per-model flags exist |
| NFSolveOrchestrator.tla | TLA+ outer spec | Inner-loop model to compose with; 4 convergence conditions already modeled |
| oscillation-signatures.json | Oscillation breaker | Pattern precedent: cross-session evidence persistence + preemptive warnings |
| nf-circuit-breaker.js | Oscillation breaker | Architectural pattern: run-collapse detection, Haiku classifier, human escalation |
| traceability-matrix.json (v0.25) | Predictive power | Forward links (requirement -> model) at 63.8% coverage |
| failure-taxonomy.json (v0.29) | Predictive power | Failure mode catalog for matching against bugs |
| test-recipes.json (v0.29) | Predictive power | 32 model-driven test recipes; predictive hit source |
| check-results.ndjson (v0.20) | Predictive power | Enriched schema v2.1 with property attribution |

## Analogies to Established Patterns

| nf-solve Concept | Established Analogy | Key Difference |
|-----------------|---------------------|----------------|
| Cross-session residual tracking | Numerical iterative refinement (Wilkinson 1963): track residual norms across iterations, terminate on stall or convergence | nf-solve residuals are discrete counts, not continuous norms. Mann-Kendall trend test (non-parametric) is appropriate where Cauchy convergence tests are not. |
| Option C oscillation breaker | Control system hysteresis / debounce: signal must be stable for N cycles before considered valid | nf-solve uses a credit system (1 oscillation allowed) rather than amplitude dampening. The existing circuit breaker already implements the harder variant for git file sets. |
| Gate stabilization | Flagger/Argo Rollouts canary promotion: sustained metric health over analysis window before promoting | nf-solve uses session count + wall-clock time rather than continuous metric streams. Cooldown window is coarser-grained but appropriate for the invocation frequency (minutes to hours between runs). |
| Predictive power scoring | Defect prediction model evaluation (recall, precision, F1, AUC) | Recall-first scoring: a model that catches 1 real bug with 10 false alarms is more valuable than a model with perfect precision catching 0 bugs. Literature is unambiguous on this point. |
| TLA+ outer-loop convergence | Banach fixed-point theorem / MOOSE Picard iteration convergence proof | The formal proof uses TLA+ temporal logic (liveness under fairness) rather than mathematical convergence theorems. Must use bounded session abstraction (last N=3-5) to keep TLC tractable. |

## Sources

- [Iterative Refinement - Wikipedia](https://en.wikipedia.org/wiki/Iterative_refinement) -- classical convergence guarantees for residual-based iteration
- [TLA+ Specification and Verification with TLC, Apalache, and TLAPS](https://inria.hal.science/hal-03844516/document) -- TLA+ model checking including bounded and liveness verification
- [Model checking safety and liveness via k-induction](https://www.sciencedirect.com/science/article/pii/S0167642320301404) -- bounded model checking for convergence properties
- [Oscillation Detection in Process Industries (ML-based)](https://pubs.acs.org/doi/10.1021/acs.iecr.9b01456) -- pattern detection in iterative control systems
- [Bug Prediction Models: seeking the most efficient](https://www.researchgate.net/publication/377808174_Bug_Prediction_Models_seeking_the_most_efficient) -- evaluation metrics for defect prediction
- [Method-level Bug Prediction: Problems and Promises](https://dl.acm.org/doi/10.1145/3640331) -- linking predictions to actionable outcomes
- [Software Defect Prediction Based on ML/DL](https://www.mdpi.com/2673-2688/5/4/86) -- precision, recall, F1, AUC evaluation
- [Hysteresis - Wikipedia](https://en.wikipedia.org/wiki/Hysteresis) -- state-dependent switching with memory (stabilization gate foundation)
- [AI will make formal verification go mainstream (Kleppmann 2025)](https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html) -- AI-assisted formal verification trends
- Existing codebase: NFSolveOrchestrator.tla (inner-loop model), nf-circuit-breaker.js (oscillation detection precedent), compute-per-model-gates.cjs (gate maturity logic), promotion-changelog.json (flip-flop evidence)

---
*Feature research for: Outer-Loop Convergence Guarantees (v0.33)*
*Researched: 2026-03-09*
