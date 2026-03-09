# Pitfalls Research

**Domain:** Outer-loop convergence guarantees for nf:solve iterative refinement
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase analysis + formal model inspection)

## Critical Pitfalls

### Pitfall 1: False Positive Oscillation Detection from Cascade-Induced Residual Increase

**What goes wrong:**
The layer oscillation breaker (Option C) flags a layer as "oscillating" when its residual increases after remediation, but the increase is actually a cascade artifact. Fixing R->F gaps (residual 90) surfaces previously-hidden F->T gaps, causing that layer's residual to rise. Option C sees: iteration 1 residual=5, iteration 2 residual=12 (after R->F fix exposed hidden gaps), iteration 3 residual=8 (partially fixed). If the breaker compares iteration 1 vs iteration 3 and sees the "improvement then regression" pattern, it incorrectly triggers human escalation on a layer that is making real forward progress.

**Why it happens:**
The existing TLA+ spec (`NFSolveOrchestrator.tla` line 204-214) already models cascade awareness with `layersChanged` as a non-deterministic boolean -- but the convergence check only compares total residuals and layer-level change flags. It does not track *why* a residual increased (cascade discovery vs. genuine regression). When Option C adds per-layer oscillation detection on top of this, the naive approach of "did residual go up then down then up" will produce false positives on any layer downstream of a remediated layer.

**How to avoid:**
- Define oscillation as: same layer's residual returns to a value within epsilon of a *previous iteration's value* after having changed -- not merely "increased then decreased." True oscillation is periodic; cascade is monotonic discovery.
- Track per-layer residual vectors across iterations. Oscillation = the layer has been remediated 2+ times AND the residual delta sequence contains a sign reversal back toward a prior value. Cascade = residual increased on a layer that was NOT directly remediated in the preceding iteration.
- Add a `cascade_source` field to each layer residual entry. When R->F remediation runs, mark F->T, F->C as potential cascade targets. Exempt cascade targets from oscillation detection for 1 iteration after the source layer changes.
- The TLA+ spec should model cascade explicitly: introduce a `cascadePending` set that clears after one re-diagnose pass.

**Warning signs:**
- Human escalation fires on the first or second solve run after introducing Option C
- Layers that were never directly remediated get flagged as oscillating
- Escalation rate > 30% of convergence loop iterations

**Phase to address:**
Phase 1 (Layer Oscillation Breaker) -- this must be designed correctly from the start. Retrofitting cascade awareness after deployment means changing the escalation logic that humans have already learned to trust.

---

### Pitfall 2: Trend Tracker Unbounded Growth Corrupts Cross-Session State

**What goes wrong:**
The cross-session residual trend tracker appends time-series data to a persistent file on every `nf:solve` run. Currently, `solve-state.json` stores only the latest run (12 layers, ~60 lines). A naive trend tracker that appends full layer residuals per run will grow unboundedly. After 50 runs across a milestone with 19 layers, the file reaches ~5KB -- manageable. But the real problem is that trend analysis on stale data produces misleading conclusions. If the codebase undergoes a major refactor between milestones, old residual baselines become meaningless, and a "trending up" signal may just reflect the new baseline.

**Why it happens:**
Time-series append is the obvious implementation. Developers add `history.push(currentRun)` and defer cleanup. The file grows slowly enough that no single run notices the problem. Meanwhile, the trend analysis code treats all historical entries as equally valid, even entries from before structural changes that invalidated the residual semantics.

**How to avoid:**
- Cap history at a rolling window (recommended: 20 runs). Prune on write, not lazily.
- Add an `epoch` marker. When the user starts a new milestone or the layer set changes (layers added/removed), increment the epoch. Trend analysis only considers entries within the current epoch.
- Store the trend file at `.planning/formal/solve-trend.jsonl` (append-only JSONL, one line per run). This avoids JSON parse-then-rewrite of the entire history -- just append a line and read the last N lines for analysis.
- Include a `layer_set_hash` field (hash of sorted layer keys) per entry. If the hash changes, start a new epoch automatically.
- Size guard: if file exceeds 100KB, truncate to last 20 entries on next write.

**Warning signs:**
- `solve-trend.jsonl` exceeds 50KB
- Trend analysis reports "worsening" trend immediately after milestone boundary
- Layer keys in old entries don't match current layer set

**Phase to address:**
Phase 1 (Cross-Session Trend Tracker) -- the data format must include epoch markers from day one. Migrating a flat history to epoched format after accumulation requires manual intervention.

---

### Pitfall 3: Promotion Changelog Flip-Flop Already Happening Without Gates

**What goes wrong:**
The promotion-changelog.json already contains 200 entries for only 2 models -- `quorum-votes.als` and `NFQuorum.tla` each have 100 identical `ADVISORY -> SOFT_GATE` auto_promotion entries. This means auto_promotion runs on every solve iteration without checking current level, re-promoting models that are already at SOFT_GATE. When stabilization gates are added, they will inherit this broken behavior: the gate sees "100 recent promotions" and either (a) treats them all as distinct promotions, concluding the model is highly unstable, or (b) the cooldown timer resets on every redundant promotion, creating an infinite cooldown.

**Why it happens:**
`compute-per-model-gates.cjs` (called by nf-solve) promotes models based on evidence readiness without first checking the model's current gate level. The promotion is idempotent in effect (ADVISORY -> SOFT_GATE is a no-op if already SOFT_GATE) but still appends to the changelog. This is a pre-existing bug that becomes critical when the stabilization gate feature reads the changelog as its input signal.

**How to avoid:**
- Before adding stabilization gates, fix the auto_promotion guard: skip promotion if `current_level >= target_level`. This is a prerequisite bug fix, not part of the stabilization feature itself.
- Deduplicate the existing changelog: collapse consecutive identical entries for the same model into a single entry with a `count` field.
- Stabilization gates should read *distinct level transitions* from the changelog, not raw entry count. Define a transition as: `from_level != to_level` AND `to_level != previous_to_level_for_this_model`.
- Add a `promotion_hash` (model + from + to) and skip append if the last entry for that model has the same hash.

**Warning signs:**
- promotion-changelog.json grows by 2+ entries per solve run
- Any model has > 5 changelog entries per epoch
- Stabilization gate cooldown never completes

**Phase to address:**
Phase 0 (prerequisite fix before any stabilization logic). The existing 200-entry changelog must be cleaned up and the guard added before gate maturity stabilization can function correctly. Without this, Phase 3 (Stabilization Gates) will build on broken data.

---

### Pitfall 4: TLA+ State Space Explosion in NFSolveConvergence Spec

**What goes wrong:**
The existing `NFSolveOrchestrator.tla` models residuals as integers in `0..MaxResidual` and has 12 phases, 9 automatable layers, and 5 info layers. With `MaxResidual=100` and `MaxIterations=5`, the state space is already large. The new `NFSolveConvergence` spec needs to model the *outer loop* -- multiple solve runs across sessions, each containing an inner convergence loop. If the outer spec embeds the inner spec's full state space, the product is combinatorially explosive: `(inner states) ^ (outer iterations)`. Even with MaxResidual=10 and MaxIterations=3, modeling 5 outer runs produces billions of states.

**Why it happens:**
The natural inclination is to compose the inner loop spec inside the outer loop spec. TLA+ does not have native "subroutine" abstraction -- every variable is global, every state is explored. Developers model the outer loop with the same granularity as the inner loop, leading to state space explosion that makes TLC model checking infeasible (hours or out-of-memory).

**How to avoid:**
- Abstract the inner loop. The outer convergence spec should NOT import NFSolveOrchestrator's full state machine. Instead, model each inner solve run as a single atomic action that takes `(layers, residuals) -> (layers', residuals', converged)` with non-deterministic residual outcomes bounded by monotonicity constraints.
- Use refinement: prove that the abstracted inner-loop action refines NFSolveOrchestrator's behavior (separately), then use the abstraction in the outer spec.
- Keep outer spec variables minimal: `outerIteration`, `residualHistory` (sequence of totals), `layerOscillationCount` (function from layer to count), `gateMaturity` (function from model to maturity level).
- Set aggressive bounds: `MaxOuterRuns=5`, `MaxResidual=10` (abstract scale), `MaxLayers=4` (representative subset). Use symmetry reduction where possible.
- Run TLC with `-workers 8` and breadth-first search. If state space exceeds 10M states, the abstraction is too fine-grained.

**Warning signs:**
- TLC runs for > 5 minutes on the convergence spec
- State count exceeds 1M during model checking
- The spec has > 8 VARIABLES
- Debugging requires `-dump` files larger than 100MB

**Phase to address:**
Phase 4 (TLA+ Convergence Spec) -- but the abstraction strategy must be designed in Phase 1 alongside the data model, because the TLA+ spec's variables mirror the implementation's data structures.

---

### Pitfall 5: Predictive Power Measurement Bias from Survivorship

**What goes wrong:**
The predictive power feedback loop scores formal models by `bugs_predicted / total_bugs`. This metric is biased by survivorship: models that predict easily-caught bugs score high, while models that *should have* predicted subtle bugs but didn't are invisible in the denominator. A model with 3/3 prediction rate looks perfect, but if 10 bugs occurred in its domain and 7 were caught by tests before hitting formal verification, the model's true predictive power is 3/10. Worse, models covering well-tested areas will appear stronger than models covering poorly-tested areas, creating a perverse incentive to focus formal effort where it's least needed.

**Why it happens:**
The natural data source is the solve pipeline's own results: "this model flagged a residual, and that residual corresponded to a test failure." But this only counts bugs that both the model AND the test suite detected. Bugs caught only by tests (false negatives for the model) require cross-referencing test failure history with formal model coverage -- a join that doesn't currently exist.

**How to avoid:**
- Define the denominator carefully: `total_bugs` = all test failures in files covered by the model's requirement traceability links (from traceability-matrix), not just bugs the model predicted.
- Use the existing traceability matrix (63.8% coverage from v0.25) to map test failures to formal model coverage areas. If a test fails in a file linked to requirement R-07, and model M covers R-07, then M had an opportunity to predict that bug regardless of whether it did.
- Track three metrics per model: (1) **precision** = predicted_and_failed / predicted, (2) **recall** = predicted_and_failed / total_failures_in_scope, (3) **F1** = harmonic mean. Use recall as the primary gate signal, not precision.
- Bootstrap with historical data: mine git history for test failures that occurred after formal models were added. This provides initial calibration without waiting for new bugs.

**Warning signs:**
- Any model scores predictive power > 0.9 (likely survivorship bias)
- Models covering untested areas score 0.0 (denominator problem)
- Predictive power rankings don't change after 5+ solve runs (stale signal)

**Phase to address:**
Phase 3 (Predictive Power Feedback Loop) -- the metric definition is a design decision, not an implementation detail. Getting it wrong means the feedback loop reinforces effort in the wrong places.

---

### Pitfall 6: additionalContext Token Budget Contention Blocks Convergence Signals

**What goes wrong:**
The hook system uses `additionalContext` for injecting convergence signals, but multiple sources already compete for this channel: quorum instructions, circuit breaker recovery prompts, thinking budget scaling, context stack injection (capped at 800 chars), session state reminders, and telemetry surfacing. The nf-prompt.js module-level cap is 2000 chars. Adding trend tracker warnings ("residual trending up on layer X"), oscillation alerts ("layer Y breaker triggered"), and predictive power summaries will either (a) exceed the cap and get silently truncated, or (b) crowd out higher-priority injections like quorum instructions, breaking the core enforcement loop.

**Why it happens:**
`additionalContext` is a shared channel with no priority-based allocation. Each feature adds its injection independently. The 800-char hook-level cap and 2000-char module-level cap were set before convergence features existed. No feature negotiates with others for budget -- they all write independently and hope the total fits.

**How to avoid:**
- Implement a priority-based injection budget allocator. Assign each injection source a priority tier: Tier 1 (quorum instructions, circuit breaker) gets guaranteed 1200 chars. Tier 2 (convergence signals) gets the remainder up to the 2000 cap. Tier 3 (informational: trends, predictive power) only injects if budget remains.
- Convergence signals should use a separate channel when possible. For signals that need to reach the solve pipeline (not the LLM), write to `solve-state.json` or a dedicated `convergence-signals.json` file instead of additionalContext.
- For signals that must reach the LLM (e.g., oscillation breaker human escalation), use the existing circuit breaker pattern: write a markdown file and inject its path, not its content.
- Test the total injection size across a full solve run with all features active. Measure empirically, don't estimate.

**Warning signs:**
- `additionalContext` output exceeds 1500 chars in any hook invocation
- Quorum instructions get truncated (quorum fails to form)
- Multiple hooks inject on the same prompt event

**Phase to address:**
Phase 1 -- the budget allocator must exist before any new injection sources are added. Adding sources first and allocating budget later means the first feature works, the second silently breaks the first.

---

### Pitfall 7: Per-Model Gate Persistence Creates Stale Lock-In

**What goes wrong:**
Wiring `--write-per-model` with reasons into the solve pipeline makes gate levels persistent across sessions. But persistent gates create lock-in: if a model is promoted to HARD_GATE based on evidence that later becomes stale (e.g., the code it models is refactored), the gate blocks workflows on a model that no longer reflects reality. The current auto_promotion logic (which already fires 100 times redundantly) combined with persistent gates could lock a model at HARD_GATE permanently even after its grounding evidence degrades.

**Why it happens:**
Gate persistence is designed to prevent flip-flop (good), but without a corresponding *demotion* mechanism based on evidence staleness, it creates one-way ratchets. The stabilization gate feature addresses promotion cooldowns but may not address the inverse: "this model hasn't been validated against current code in N days, demote it."

**How to avoid:**
- Implement bidirectional gate movement: promotion requires evidence readiness, demotion triggers when grounding score drops below threshold or the model's source files change significantly (git diff).
- Add a `last_validated` timestamp to each model's gate record. If `now - last_validated > staleness_threshold` (recommended: 7 days or 10 solve runs), automatically demote one level.
- Gate persistence should store the evidence snapshot (score, total, timestamp) that justified the level. On each solve run, compare current evidence to stored snapshot. If current score < stored score * 0.8, flag for review.
- Never persist HARD_GATE without explicit human approval. Auto-promotion should cap at SOFT_GATE; HARD_GATE requires human escalation (consistent with Option C's philosophy).

**Warning signs:**
- Models at HARD_GATE whose source files were modified since last validation
- Gate levels that only increase, never decrease across 20+ runs
- Grounding score (Gate A, currently 82.2%) drops but no gate demotions occur

**Phase to address:**
Phase 2 (Per-Model Gate Persistence) -- bidirectional movement must be part of the initial persistence design. Adding demotion after models are locked at high levels requires a migration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing trend data in solve-state.json instead of separate file | No new files | solve-state.json grows unboundedly; JSON reparse on every read | Never -- use separate JSONL file |
| Skipping epoch markers in trend data | Simpler append logic | Stale cross-milestone data corrupts trend analysis | Never -- epoch is cheap to add |
| Using total residual for oscillation detection instead of per-layer | Simpler comparison | False positives from cascade; false negatives when layers cancel out | Only in Phase 0 prototype, must replace by Phase 1 |
| Relying on promotion-changelog.json as-is for stabilization gates | No migration needed | 200 redundant entries pollute gate maturity signals | Never -- fix the guard first |
| Embedding inner loop in outer TLA+ spec | Single spec to maintain | State space explosion; TLC becomes infeasible | Never -- use abstraction refinement |
| Measuring predictive power by precision only | Simple metric, quick to implement | Survivorship bias; effort allocated to already-well-tested areas | Only as Phase 2 intermediate metric, must add recall by Phase 3 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Trend tracker + solve-state.json | Overwriting solve-state.json with trend data or vice versa | Separate files: `solve-state.json` (latest snapshot), `solve-trend.jsonl` (append-only history) |
| Oscillation breaker + existing circuit breaker | Confusing layer oscillation (formal model convergence) with git oscillation (code edit patterns) | Different detection algorithms, different state files, different escalation paths. Layer oscillation breaker operates at solve-pipeline level; circuit breaker operates at git-commit level |
| Predictive power + traceability matrix | Assuming traceability coverage = predictive scope | Traceability matrix has 63.8% coverage -- models with no traceability links have undefined predictive power, not zero |
| Stabilization gates + auto_promotion | Cooldown timer resets on every redundant promotion | Fix the idempotency guard in compute-per-model-gates.cjs before adding cooldowns |
| TLA+ convergence spec + existing NFSolveOrchestrator | Importing NFSolveOrchestrator directly into convergence spec | Use refinement mapping; convergence spec references abstract inner-loop action only |
| Per-model gates + 19-layer sweep | Gate checks run inside sweep, adding latency to each of 19 layers | Gate checks should run once per solve iteration (pre-sweep), not per-layer. Cache gate decisions for the iteration. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Trend file JSON parse on every solve | Solve startup latency increases with history length | Use JSONL (line-oriented); read last N lines with tail, not full parse | > 50 runs in history |
| Per-model gate recomputation during sweep | Each of 19 layers re-calls compute-per-model-gates.cjs | Cache gate computation result; invalidate only on model file change | > 30 models in registry |
| Oscillation detection scanning full history | O(n*m) where n=iterations, m=layers per iteration | Sliding window of last 3 iterations only; discard older per-layer data | > 10 iterations per solve run |
| TLC model checking on convergence spec per solve run | Minutes of delay before remediation starts | Run convergence spec only on demand (`--verify-convergence`), not in standard sweep | State space > 100K states |
| Predictive power score recomputation from full git history | Mining git log for test failures is O(commits * tests) | Pre-compute and cache; update incrementally on new test failures only | > 1000 commits in scope |

## "Looks Done But Isn't" Checklist

- [ ] **Trend tracker:** Often missing epoch boundaries -- verify that trend analysis ignores pre-epoch data by checking `layer_set_hash` matches
- [ ] **Oscillation breaker:** Often missing cascade exemption -- verify that layers not directly remediated in the preceding iteration cannot trigger oscillation alerts
- [ ] **Predictive power:** Often missing recall metric -- verify that the denominator includes all test failures in scope, not just model-predicted ones
- [ ] **Stabilization gates:** Often missing the prerequisite promotion guard fix -- verify that promotion-changelog.json does not contain consecutive identical entries for the same model
- [ ] **TLA+ convergence:** Often missing abstraction proof -- verify that the abstract inner-loop action is shown to refine NFSolveOrchestrator (separate TLC run), not just assumed
- [ ] **Per-model persistence:** Often missing demotion path -- verify that models can move DOWN gate levels when evidence degrades, not just up
- [ ] **Token budget:** Often missing empirical measurement -- verify total additionalContext size with ALL features active simultaneously, not tested in isolation
- [ ] **solve-state.json:** Often missing backward compatibility -- verify that old format (no trend data) is handled gracefully by new code

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False positive oscillation detection | MEDIUM | Disable breaker, audit flagged layers, add cascade exemption, re-run solve |
| Unbounded trend file | LOW | Truncate to last 20 entries, add epoch markers, re-run |
| Promotion changelog pollution | LOW | Deduplicate changelog, add idempotency guard, re-run |
| TLA+ state explosion | HIGH | Must redesign spec with abstraction refinement; no quick fix |
| Predictive power survivorship bias | MEDIUM | Redefine metric, recompute from historical data, update all stored scores |
| Token budget overflow | MEDIUM | Implement priority allocator, audit all injection sources, test combined size |
| Stale gate lock-in | MEDIUM | Add staleness check, batch-demote models past threshold, add demotion to persistence logic |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| False positive oscillation (cascade) | Phase 1: Layer Oscillation Breaker | Zero false escalations on a solve run where only R->F is remediated |
| Trend tracker unbounded growth | Phase 1: Cross-Session Trend Tracker | `solve-trend.jsonl` stays under 50KB after 30 runs; epoch boundary on layer set change |
| Promotion changelog flip-flop | Phase 0: Prerequisite fix | promotion-changelog.json grows by <= 2 entries per solve run after fix |
| TLA+ state space explosion | Phase 4: NFSolveConvergence spec | TLC completes in < 60 seconds with 10M state cap |
| Predictive power survivorship bias | Phase 3: Predictive Power Feedback | Recall metric computed and stored; no model scores > 0.9 precision without >= 0.5 recall |
| Token budget contention | Phase 1: Budget allocator prerequisite | Total additionalContext < 2000 chars with all features active |
| Per-model gate lock-in | Phase 2: Per-Model Gate Persistence | At least one model demoted in test scenario where source files change post-promotion |

## Sources

- Direct analysis of `/Users/jonathanborduas/code/QGSD/.planning/formal/solve-state.json` -- current 12-layer residual snapshot with no history
- Direct analysis of `/Users/jonathanborduas/code/QGSD/.planning/formal/promotion-changelog.json` -- 200 entries, 100 per model, all identical ADVISORY->SOFT_GATE (flip-flop evidence)
- Direct analysis of `/Users/jonathanborduas/code/QGSD/.planning/formal/tla/NFSolveOrchestrator.tla` -- existing inner-loop spec with cascade modeling via non-deterministic `layersChanged`
- Direct analysis of `/Users/jonathanborduas/code/QGSD/hooks/nf-prompt.js` -- 800 char hook-level cap, 2000 char module-level cap for additionalContext
- Direct analysis of `/Users/jonathanborduas/code/QGSD/bin/nf-solve.cjs` -- 19 layer keys in sweep, per-model gate computation, solve-state.json write logic
- TLA+ state space analysis: training data knowledge on TLC performance characteristics (MEDIUM confidence -- verify with TLC profiling during Phase 4)

---
*Pitfalls research for: Outer-loop convergence guarantees for nf:solve*
*Researched: 2026-03-09*
