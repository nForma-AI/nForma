# Architecture Patterns

**Domain:** Outer-loop convergence guarantees for nf:solve formal verification pipeline
**Researched:** 2026-03-09
**Confidence:** HIGH (all integration points verified against existing source code)

## Existing Architecture (Baseline)

The current nf:solve pipeline operates as a single-session convergence loop:

```
main()
  -> preflight() [bootstrap formal infra]
  -> refresh-evidence.cjs [pre-loop]
  -> for i = 1..maxIterations:
       computeResidual() [sweep 19 layer transitions]
       -> convergence check (total == prevTotal || total == 0)
       -> autoClose(residual) [remediation: 13 ordered sub-steps]
  -> write solve-state.json [snapshot, NOT time series]
  -> persistSessionSummary() [timestamped .md in solve-sessions/]
  -> formatReport / formatJSON -> stdout
```

### Key State Files

| File | What It Holds | Scope |
|------|--------------|-------|
| `solve-state.json` | Last-run snapshot: converged, iteration_count, final_residual_total, known_issues[] | Single run (overwritten) |
| `solve-sessions/*.md` | Timestamped human-readable session summaries | Per-run archive (max 20, FIFO pruned) |
| `model-registry.json` | 127 models with version, source_layer, gate_maturity, layer_maturity, requirements[] | Persistent |
| `promotion-changelog.json` | Array of {model, from_level, to_level, timestamp, evidence_readiness, trigger} | Persistent (append-only, capped at 200) |
| `gates/per-model-gates.json` | Per-model gate A/B/C pass/reason + evidence_readiness | Computed on demand (--write-per-model) |
| `gates/gate-{a,b,c}-*.json` | Aggregate gate scores | Computed on demand (--aggregate) |
| `layer-manifest.json` | L1/L2/L3 model entries with grounding_status | Persistent |

### Current Promotion Pipeline

```
compute-per-model-gates.cjs:
  for each model:
    evaluateGateA() -> grounding (L1->L2)
    evaluateGateB() -> abstraction (L2->L3)
    evaluateGateC() -> validation (L3->TC)
    maturity = sum(gateA + gateB + gateC)  // 0-3

    Auto-promote:  ADVISORY -> SOFT_GATE  if maturity >= 1 + evidence >= 1
                   SOFT_GATE -> HARD_GATE if maturity >= 3 + evidence >= 3
    Auto-demote:   SOFT_GATE -> ADVISORY  if evidence < 0.8 or maturity < 0.8
                   HARD_GATE -> SOFT_GATE if evidence < 2.5 or maturity < 2.5

    Hysteresis: promote threshold > demote threshold (boundary oscillation guard)
```

### Critical Gap

**No cross-session memory.** solve-state.json is overwritten each run. Session summaries are pruned to 20. promotion-changelog.json captures gate transitions but no cross-session analysis reads it. There is no mechanism to detect whether repeated solve runs are making progress, stalling, or oscillating.

## Recommended Architecture for 6 New Features

### Component Map

```
                         CROSS-SESSION CONVERGENCE LAYER (NEW)
+----------------------------------------------------------------------+
|                                                                      |
|  convergence-history.json    (NEW: append-only time series, 100 cap) |
|       |              |              |                                |
|       v              v              v                                |
|  +---------+  +--------------+  +----------------+                  |
|  | Trend   |  | Oscillation  |  | Predictive     |                  |
|  | Tracker |  | Breaker      |  | Power Scorer   |                  |
|  +----+----+  +------+-------+  +--------+-------+                  |
|       |              |                    |                          |
|       v              v                    v                          |
|  (inline)     oscillation-        predictive-power.json              |
|               verdicts.json       (model -> bugs_predicted/total)    |
|                      |                                               |
|                      v                                               |
|               HUMAN ESCALATION                                       |
|               (fix->break->fix blocked)                              |
|                                                                      |
|  stabilization-gates.json  <-- promotion-changelog.json (READ)       |
|  (cooldown tracking)                                                 |
|                                                                      |
|  NFSolveConvergence.tla  (NEW: outer-loop TLA+ spec)                 |
|                                                                      |
+----------------------------------------------------------------------+
          |                    |                    |
          v                    v                    v
+----------------------------------------------------------------------+
|  EXISTING SINGLE-RUN SCOPE (modified at integration seams only)      |
|                                                                      |
|  nf-solve.cjs main()                                                |
|    +-- preflight()        (unchanged)                                |
|    +-- computeResidual()  (unchanged)                                |
|    +-- autoClose()        -> reads oscillation-verdicts.json (NEW)   |
|    |                      -> skips blocked layers (NEW)              |
|    +-- finalize block     -> calls appendConvergenceEntry() (NEW)    |
|    +-- persistSession()   (unchanged)                                |
|                                                                      |
|  compute-per-model-gates.cjs                                         |
|    +-- auto-promotion     -> calls canPromote() guard (NEW)          |
|                                                                      |
+----------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|--------------|
| `bin/convergence-history.cjs` | Append time-series entries after each solve run; compute per-layer trend (slope, direction) over sliding window | convergence-history.json, nf-solve.cjs | **New** |
| `bin/detect-oscillation.cjs` | Scan per-layer residual history for fix-break-fix patterns; write verdicts file | convergence-history.json, oscillation-verdicts.json | **New** |
| `bin/score-predictive-power.cjs` | Link test failures to formal properties; score bugs_predicted/total_bugs per model | model-registry.json, check-results.ndjson, predictive-power.json | **New** |
| `bin/stabilization-gates.cjs` | Enforce cooldown before re-promotion; detect flip-flop in promotion-changelog | promotion-changelog.json, stabilization-gates.json, compute-per-model-gates.cjs | **New** |
| `.planning/formal/tla/NFSolveConvergence.tla` | TLA+ spec proving outer-loop convergence under Option C assumptions | Standalone formal model (separate from NFSolveOrchestrator.tla) | **New** |
| `bin/nf-solve.cjs` | Integration seams: append history entry at finalize, read oscillation verdicts in autoClose, wire --write-per-model | All new components | **Modified** (3 call sites) |
| `bin/compute-per-model-gates.cjs` | Check stabilization gate before auto-promoting; pass --write-per-model from solve | stabilization-gates.cjs | **Modified** (1 guard) |
| `commands/nf/solve-report.md` | Include trend and oscillation sections in report output | convergence-history.json, oscillation-verdicts.json, predictive-power.json | **Modified** (template) |

### Data Flow

#### Feature 1: Cross-Session Trend Tracker

**Where does time series live?** In a NEW file: `.planning/formal/convergence-history.json`. NOT in solve-state.json.

**Why separate file:** solve-state.json is a single-run snapshot consumed by solve-diagnose and solve-report. Adding a growing array changes its contract, bloats reads, and breaks existing consumers. The time series needs append-only semantics with bounded retention -- a different access pattern.

**Integration point:** End of `main()` in nf-solve.cjs (line ~3464), after solve-state.json write but before persistSessionSummary.

```
nf-solve.cjs main() finalize block:
  ... existing solveState write (line 3488) ...
  NEW: convergenceHistory.append({
    timestamp, converged, iteration_count,
    residuals: { r_to_f: 90, f_to_t: 0, ... },  // per-layer snapshot
    gates: { a: 0.247, b: 0.98, c: 0.787 },      // from gate files
    total: 114,
    automatable_total: 91                          // excludes informational layers
  })
  NEW: trendAnalysis = convergenceHistory.analyzeTrend({ window: 5 })
  ... existing persistSessionSummary (line 3501) ...
```

**How does solve-state.json evolve?** It does NOT. solve-state.json stays exactly as-is (7 top-level fields, overwritten each run). At most, add a single `last_trend_direction: "improving"|"stable"|"worsening"` summary field for quick status checks. No arrays, no history.

**convergence-history.json schema:**
```json
{
  "schema_version": "1",
  "max_entries": 100,
  "entries": [
    {
      "timestamp": "2026-03-09T23:23:23.831Z",
      "converged": false,
      "iteration_count": 1,
      "total": 114,
      "automatable_total": 91,
      "residuals": {
        "r_to_f": 90, "f_to_t": 0, "c_to_f": 0, "t_to_c": 0,
        "f_to_c": 1, "r_to_d": 0, "d_to_c": 23,
        "l1_to_l2": 7, "l2_to_l3": 4, "l3_to_tc": 1
      },
      "gates": { "a": 0.247, "b": 0.98, "c": 0.787 }
    }
  ]
}
```

#### Feature 2: Layer Oscillation Breaker

**Where does it hook in?** BEFORE remediation, inside `autoClose()` in nf-solve.cjs. Not after -- catching oscillation before remediation prevents the fix->break cycle from continuing.

```
autoClose(residual) {
  // NEW: read oscillation verdicts at top
  const verdicts = loadOscillationVerdicts();

  // For each layer with residual > 0:
  if (residual.f_to_t.residual > 0) {
    // NEW: check oscillation before remediation
    if (verdicts['f_to_t']?.blocked) {
      actions.push('f_to_t BLOCKED -- oscillation detected, human escalation required');
      // SKIP this layer's remediation (continue to next layer)
    } else {
      // existing remediation logic (spawnTool('formal-test-sync.cjs'))
    }
  }
  // ... same pattern for each layer ...
}
```

**Option C enforcement rule:** No individual layer oscillates more than once. Definition:
1. Read convergence-history.json last 10 entries
2. For each layer, extract residual time series: [r1, r2, r3, ...]
3. Compute deltas: [d1, d2, ...], filter noise (delta magnitude < 2 ignored)
4. Count sign alternations (negative->positive or positive->negative)
5. One full cycle (improve->worsen->improve) = 2 sign changes = WARNING
6. If layer worsens again after warning = BLOCKED

**Relationship to existing circuit breaker:** The hooks/nf-circuit-breaker.js detects git-level oscillation (same file sets being toggled back and forth). The layer oscillation breaker operates at a different abstraction level -- formal model residual trends across solve runs, not git commit patterns. They are complementary, not overlapping. The layer breaker runs inside nf-solve.cjs; the circuit breaker runs as a PreToolUse hook. Both use the same pattern (append-only history, FIFO pruning) as established in v0.31.

**Oscillation verdicts file: `.planning/formal/oscillation-verdicts.json`**
```json
{
  "schema_version": "1",
  "verdicts": {
    "l1_to_l2": {
      "pattern": [7, 3, 8, 2, 9],
      "cycle_count": 2,
      "blocked": true,
      "blocked_since": "2026-03-10T01:00:00Z",
      "last_seen": "2026-03-10T02:00:00Z"
    }
  }
}
```

**Auto-recovery:** 3 consecutive improving sessions (layer residual decreases 3 times in a row) clears the block. This prevents permanent blocking when the underlying issue is resolved.

#### Feature 3: Predictive Power Feedback

**How do test results flow back to model scoring?** Through the requirement linkage chain:

```
Test failure (@req SOLVE-01)
    -> requirement SOLVE-01
    -> model-registry.json: which models cover SOLVE-01?
    -> check-results.ndjson: did any of those models have check_result=fail
       BEFORE the test failure timestamp?
    -> YES = bugs_predicted++ for that model
    -> NO  = total_bugs++ without prediction credit
```

**Integration point:** Standalone script called from nf-solve.cjs finalize block (after convergence-history append) or on-demand via CLI.

**model-registry.json schema addition (optional field, backward-compatible):**
```json
{
  ".planning/formal/tla/NFSolveOrchestrator.tla": {
    "version": 1,
    "gate_maturity": "SOFT_GATE",
    "predictive_power": {
      "bugs_predicted": 3,
      "total_bugs": 10,
      "score": 0.3,
      "last_scored": "2026-03-10T00:00:00Z"
    }
  }
}
```

**Separate output file:** `.planning/formal/predictive-power.json` for aggregate scoring data, keeping model-registry changes minimal (one optional field).

#### Feature 4: Stabilization Gates

**Where in promotion pipeline?** Inside `compute-per-model-gates.cjs`, as a guard BEFORE the auto-promotion decision at lines 430-470.

```
// Existing auto-promotion: ADVISORY -> SOFT_GATE
if (maturity >= 1 && currentGate === 'ADVISORY') {
  // NEW: check stabilization gate
  const { canPromote } = require('./stabilization-gates.cjs');
  if (!canPromote(modelPath, 'SOFT_GATE', { root: ROOT })) {
    // Skip promotion -- stabilization period not met
    perModel[modelPath].stabilization_blocked = true;
    continue;
  }
  // existing promotion logic (validateCriteria, appendChangelog)...
}
```

**Evidence of need:** The current promotion-changelog.json shows the same models (e.g., `alloy/quorum-votes.als`, `tla/NFQuorum.tla`) being repeatedly promoted from ADVISORY to SOFT_GATE within minutes (timestamps: 21:26, 21:27, 21:28, all same day). This is exactly the flip-flop pattern stabilization gates prevent.

**Stabilization rules:**
1. **Cooldown after demotion:** After a model is demoted, block re-promotion for N solve runs (default: 3) or M minutes (default: 60)
2. **Flip-flop detection:** If promotion-changelog shows promote->demote->promote for the same model within K entries (default: 10), require human override
3. **Rate limit:** Maximum 3 promotions per model per 24-hour period

**Stabilization state file: `.planning/formal/stabilization-gates.json`**
```json
{
  "schema_version": "1",
  "models": {
    ".planning/formal/tla/NFQuorum.tla": {
      "last_promoted": "2026-03-09T21:28:00Z",
      "cooldown_until": "2026-03-09T22:28:00Z",
      "promotions_24h": 3,
      "flip_flop_blocked": false
    }
  }
}
```

#### Feature 5: Outer-Loop TLA+ Spec

**Decision: Separate spec (NFSolveConvergence.tla), NOT extending NFSolveOrchestrator.tla.**

**Rationale:**
- NFSolveOrchestrator.tla models the INNER loop: single-run state machine (IDLE -> DIAGNOSE -> CLASSIFY -> REMEDIATE -> REPORT -> DONE), 8 variables, 386 lines
- The outer loop models ACROSS runs: a sequence of complete solve invocations with cross-session state
- Different abstraction levels: inner loop tracks phase/iteration/residual within one run; outer loop tracks residual trends, oscillation counts, promotion stability across runs
- Combining them creates state space explosion: MaxRuns * MaxIterations * NumLayers * oscillation states
- The inner spec already uses MaxResidual in 0..100 and MaxIterations in 1..10 -- adding outer-loop dimensions would push TLC past tractability

**NFSolveConvergence.tla sketch:**
```tla+
---- MODULE NFSolveConvergence ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    MaxRuns,            \* Upper bound on solve runs
    NumLayers,          \* Number of tracked layers
    MaxOscillations,    \* Option C limit (1)
    StabilizationRuns   \* Cooldown period in runs

VARIABLES
    run,                     \* Current run number (1-based)
    residualHistory,         \* Sequence of per-layer residual vectors
    layerOscillationCount,   \* Per-layer: number of full oscillation cycles
    layerBlocked,            \* Set of layers blocked by Option C
    terminated               \* Outer loop terminated

\* Safety: Option C -- no layer oscillates more than MaxOscillations times
NoExcessiveOscillation ==
    \A layer \in 1..NumLayers:
        layerOscillationCount[layer] <= MaxOscillations

\* Safety: Blocked layers are never auto-remediated
EscalatedLayersStayBlocked ==
    \A layer \in layerBlocked:
        \* The layer remains in blocked set until human clears it
        \* or auto-recovery conditions met (3 consecutive improvements)

\* Liveness: Under Option C, outer loop eventually terminates
\* (either all residuals reach 0 or all non-zero layers are blocked)
EventualTermination == <>(terminated = TRUE)

\* Liveness: Automatable residual is monotonically non-increasing
\* (excluding blocked layers)
MonotonicProgress ==
    \* Total residual of unblocked layers trends downward
====
```

**Config: `.planning/formal/tla/MCsolve-convergence.cfg`** with small constants (MaxRuns=10, NumLayers=4) for tractable model checking.

#### Feature 6: Per-Model Gate Persistence Integration

**Current gap:** compute-per-model-gates.cjs has --write-per-model flag (line 41) but nf-solve.cjs autoClose does NOT invoke it. The solve pipeline runs inline per-model gate remediation (lines 2686-2770: fills source_layer, detects declarations) but never calls compute-per-model-gates with the persistence flags.

**Fix:** In nf-solve.cjs autoClose(), after existing per-model gate remediation block (line ~2770), add:

```javascript
// Persist per-model gate detail + aggregate scores
spawnTool('compute-per-model-gates.cjs', ['--write-per-model', '--aggregate']);
```

This ensures:
- per-model-gates.json updated every solve run (not just CLI invocation)
- Aggregate gate files (gate-a/b/c-*.json) updated every solve run
- promotion-changelog.json gets new entries when promotions occur
- Stabilization gates (Feature 4) can read fresh changelog data

## Patterns to Follow

### Pattern 1: Append-Only Time Series with FIFO Pruning
**What:** convergence-history.json stores session results as an append-only array, pruned to most recent 100 entries. Oldest entries trimmed from front.
**When:** Any cross-session state needing trend analysis.
**Why:** Matches existing patterns: promotion-changelog.json (200-cap), oscillation-signatures.json from v0.31 (50-cap, 30-day TTL). Proven in production. No database needed. Concurrent writes cannot race because solve runs are sequential (human-triggered).
**Example:**
```javascript
function append(historyFile, entry) {
  let data = loadJSON(historyFile) || { entries: [] };
  data.entries.push(entry);
  if (data.entries.length > MAX_ENTRIES) {
    data.entries = data.entries.slice(-MAX_ENTRIES);
  }
  writeJSON(historyFile, data);
}
```

### Pattern 2: Pre-Remediation Guard (fail-open)
**What:** Check a blocking condition BEFORE dispatching remediation for each layer. If the guard cannot evaluate (file missing, parse error), allow remediation to proceed (fail-open).
**When:** Layer oscillation breaker (Feature 2), stabilization gates (Feature 4).
**Why:** Prevents the solve loop from making things worse. Fail-open preserves existing behavior when new components are not yet wired or data files are absent.
**Example:**
```javascript
// In autoClose(), before each layer's remediation
try {
  if (verdicts[layerKey]?.blocked) {
    actions.push(layerKey + ' BLOCKED');
    continue;  // skip remediation for this layer
  }
} catch (_) {} // fail-open
// ... existing remediation ...
```

### Pattern 3: Schema Extension Without Breaking Consumers
**What:** Add new optional fields to existing JSON schemas (model-registry.json, per-model-gates.json). Never remove or rename existing fields.
**When:** predictive_power in model-registry (Feature 3), stabilization_blocked in per-model-gates (Feature 4).
**Why:** Downstream consumers (solve-diagnose, solve-report, compute-per-model-gates) parse these files. Adding optional fields is backward-compatible. Changing required fields breaks consumers.

### Pattern 4: Separate Spec for Separate Abstraction Level
**What:** New TLA+ specs for new abstraction levels rather than extending existing specs.
**When:** The outer loop (across runs) vs inner loop (within a run) are different abstraction levels with different state spaces.
**Why:** Avoids state space explosion. Each spec can be model-checked independently with small constants. The existing NFSolveOrchestrator.tla (386 lines, 8 variables) is already at a comfortable TLC size -- adding outer-loop dimensions would break tractability.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Embedding Time Series in solve-state.json
**What:** Putting the trend array inside solve-state.json.
**Why bad:** solve-state.json is a single-run snapshot consumed by solve-diagnose and solve-report (overwritten each run, line 3488). Adding a growing array changes its contract, bloats reads, and forces every consumer to update.
**Instead:** Use a separate convergence-history.json file. Add at most a one-line summary field to solve-state.json.

### Anti-Pattern 2: Layer Oscillation Detection After Remediation
**What:** Checking for oscillation after autoClose has already dispatched remediation.
**Why bad:** The damage is done -- the fix->break cycle continues. Detection after the fact only logs; it does not prevent.
**Instead:** Check before each layer's remediation in autoClose(). Skip the layer if oscillating.

### Anti-Pattern 3: Combining Inner and Outer Loop TLA+ Specs
**What:** Adding outer-loop variables (run counter, oscillation counts) to NFSolveOrchestrator.tla.
**Why bad:** MaxRuns * MaxIterations * NumLayers * oscillation states creates combinatorial explosion. TLC may not terminate in reasonable time with constants large enough to be meaningful.
**Instead:** Two specs: NFSolveOrchestrator.tla (inner, existing, unchanged) and NFSolveConvergence.tla (outer, new). The outer spec treats each inner run as an atomic action.

### Anti-Pattern 4: Modifying computeResidual() for Cross-Session Logic
**What:** Adding trend detection inside the residual computation loop.
**Why bad:** computeResidual() is a pure diagnostic function (~2800 lines, 19 layer sweeps). Mixing in cross-session state makes it non-idempotent and breaks --report-only semantics.
**Instead:** Keep all cross-session logic in the finalize block and in separate scripts. computeResidual() remains a single-run diagnostic.

### Anti-Pattern 5: Using promotion-changelog.json as Mutable Stabilization Store
**What:** Adding cooldown_until fields directly to promotion-changelog entries.
**Why bad:** promotion-changelog.json is append-only and read by multiple consumers. Adding mutable fields (cooldown_until that gets checked and cleared) breaks the append-only contract.
**Instead:** Separate stabilization-gates.json stores mutable cooldown state. Changelog remains a pure append-only event log.

## New vs Modified Files Summary

### New Files (8)

| File | Purpose | Feature |
|------|---------|---------|
| `bin/convergence-history.cjs` | Append time-series entries, query trend, compute sliding window stats (~150 LOC) | 1 |
| `.planning/formal/convergence-history.json` | Cross-session residual time series (append-only, max 100) | 1 |
| `bin/detect-oscillation.cjs` | Per-layer fix->break->fix detection; write verdicts (~200 LOC) | 2 |
| `.planning/formal/oscillation-verdicts.json` | Active oscillation state per layer | 2 |
| `bin/score-predictive-power.cjs` | Score models by bugs_predicted/total_bugs (~250 LOC) | 3 |
| `.planning/formal/predictive-power.json` | Per-model predictive power scores | 3 |
| `bin/stabilization-gates.cjs` | Cooldown + flip-flop guard for gate promotions (~180 LOC) | 4 |
| `.planning/formal/stabilization-gates.json` | Cooldown tracking per model | 4 |
| `.planning/formal/tla/NFSolveConvergence.tla` | Outer-loop convergence proof under Option C | 5 |
| `.planning/formal/tla/MCsolve-convergence.cfg` | TLC config for NFSolveConvergence | 5 |

### Modified Files (4)

| File | What Changes | Feature(s) |
|------|-------------|------------|
| `bin/nf-solve.cjs` | (1) Call convergence-history.append after solveState write; (2) Read oscillation-verdicts in autoClose before per-layer remediation; (3) Call compute-per-model-gates with --write-per-model --aggregate in autoClose | 1, 2, 6 |
| `bin/compute-per-model-gates.cjs` | Import and call stabilization-gates.canPromote() before auto-promotion; add stabilization_blocked field to per-model output | 4 |
| `commands/nf/solve-report.md` | Add trend, oscillation, and predictive power sections to report template | 1, 2, 3 |
| `.planning/formal/model-registry.json` | Schema: add optional `predictive_power` object per model (backward-compatible) | 3 |

### Unchanged Files (Explicitly NOT Modified)

| File | Why Unchanged |
|------|--------------|
| `solve-state.json` | Remains single-run snapshot. At most add one summary field. Time series goes to convergence-history.json |
| `hooks/nf-circuit-breaker.js` | Git-level oscillation detection is orthogonal to layer-level. Different abstraction, different mechanism |
| `promotion-changelog.json` | Already has the right schema. Stabilization gates READ it, never modify its format |
| `per-model-gates.json` | Schema unchanged. Just written more frequently (every solve run via Feature 6) |
| `NFSolveOrchestrator.tla` | Inner loop spec stays separate from outer loop. No modifications needed |
| `bin/promote-gate-maturity.cjs` | canPromote guard could be added here too, but primary integration is in compute-per-model-gates.cjs which calls appendChangelog |

## Suggested Build Order (Dependency-Driven)

```
Phase 1: Feature 1 (Trend Tracker) + Feature 6 (Gate Persistence)
         Foundation -- everything else reads from these
              |
              v
Phase 2: Feature 2 (Oscillation Breaker) + Feature 4 (Stabilization Gates)
         Guards -- both are pre-action guards, can be parallel
              |
              v
Phase 3: Feature 5 (TLA+ Spec)
         Formalization -- proves correctness of implemented algorithm
              |
              v
Phase 4: Feature 3 (Predictive Power)
         Feedback -- measurement feature, independent but benefits from stable loop
```

### Phase ordering rationale:

1. **Trend Tracker + Gate Persistence first** because oscillation detection (Feature 2) needs convergence-history.json to detect patterns, and stabilization gates (Feature 4) need fresh promotion-changelog data from consistent --write-per-model runs. Without these, Features 2 and 4 have no data to analyze.

2. **Oscillation Breaker + Stabilization Gates second** because these are the core safety features of v0.33 (Option C). They can be built in parallel since they guard different things: oscillation breaker guards layer remediation in autoClose(), stabilization gates guard model promotion in compute-per-model-gates.cjs. No dependency between them.

3. **TLA+ Spec third** because the spec should describe the actual implemented algorithm. Writing it after Features 1-2-4 lets the spec faithfully model the real system. The existing inner-loop spec (NFSolveOrchestrator.tla) was written to match the implementation -- the outer-loop spec should follow the same discipline.

4. **Predictive Power last** because it is a measurement/feedback feature, not a control feature. The convergence guarantees (Features 1-2-4-5) are the core v0.33 deliverable. Predictive power is valuable but supplementary. It also benefits from a stable model-registry schema -- if multiple features modify model-registry.json in different phases, merge conflicts arise. Building it last means it adds its optional field to a settled schema.

## Scalability Considerations

| Concern | At 100 models | At 500 models | At 2000 models |
|---------|---------------|---------------|----------------|
| convergence-history.json size | ~50KB (100 entries x 12 layers) | ~50KB (entries scale with runs, not models) | ~50KB |
| compute-per-model-gates runtime | <1s (current: 127 models in <500ms) | ~2s | ~8s -- consider caching gate evaluations |
| promotion-changelog.json | 200 entries cap (fixed) | 200 entries cap | 200 entries cap |
| TLA+ state space (outer loop) | MaxRuns=10, NumLayers=4 -- tractable | Same (layers are fixed, not model count) | Same |
| Predictive power scoring | O(models * check_results) -- fast | May need requirement->model index | Pre-compute index at startup |

## Sources

- `bin/nf-solve.cjs` -- verified integration points: autoClose (line 2565), finalize block (line 3464), main loop (line 3404)
- `bin/compute-per-model-gates.cjs` -- appendChangelog (line 58), auto-promotion (line 430), --write-per-model (line 41)
- `bin/promote-gate-maturity.cjs` -- LEVELS (line 30), validateCriteria (line 61), inferSourceLayer (line 46)
- `.planning/formal/solve-state.json` -- current schema: 7 top-level fields, overwritten each run
- `.planning/formal/promotion-changelog.json` -- append-only event log, flip-flop evidence visible in timestamps
- `.planning/formal/tla/NFSolveOrchestrator.tla` -- inner-loop spec: 386 lines, 8 variables, 4 convergence termination conditions
- `.planning/formal/gates/per-model-gates.json` -- per-model detail: 127 models, schema_version 2
- `.planning/formal/model-registry.json` -- model entry schema with gate_maturity, layer_maturity, requirements[]
- `hooks/nf-circuit-breaker.js` -- existing oscillation detection pattern (orthogonal, git-level)
