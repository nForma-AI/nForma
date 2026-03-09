# Stack Research: v0.33 Outer-Loop Convergence Guarantees

**Domain:** CLI plugin formal verification convergence -- time-series persistence, statistical trend detection, TLA+ convergence proofs, test-to-model linking
**Researched:** 2026-03-09
**Confidence:** HIGH

## Design Constraint: Zero New npm Dependencies

All six features build on Node.js built-ins (v25.8.0) and existing project infrastructure. This is achievable because the features need simple statistics (linear regression, variance), append-only JSON storage (NDJSON), and TLA+ patterns (already established). Nothing here requires heavy math libraries.

## Recommended Stack

### Core Technologies (all existing -- no additions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js built-in `fs` | v25.8.0 | NDJSON append for time-series, JSON read/write for state | Already used by solve-state.json, promotion-changelog.json, check-results.ndjson -- proven patterns |
| Node.js built-in `child_process` | v25.8.0 | TLC model checking via `spawnSync` | Already used by nf-solve.cjs `spawnTool()` for all formal verification child processes |
| TLA+ / TLC | 2.18+ | NFSolveConvergence spec, convergence proof | 22+ TLA+ models already in `.planning/formal/tla/`, TLC runner in `run-formal-verify.cjs` |
| NDJSON (newline-delimited JSON) | N/A | Time-series storage format for residual trends | Already used by `check-results.ndjson` -- proven append-only pattern, grep-friendly, no parse-whole-file overhead |

### Supporting Libraries (all hand-rolled -- no npm)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `trend-tracker.cjs` (new) | N/A | NDJSON append + simple linear regression for per-layer trend | Feature 1: Cross-session residual trend tracker |
| `oscillation-breaker.cjs` (new) | N/A | Per-layer oscillation detection with Option C enforcement | Feature 2: Layer oscillation breaker |
| `predictive-scorer.cjs` (new) | N/A | Test failure to formal property linking + bugs_predicted scoring | Feature 3: Predictive power feedback loop |
| `stabilization-gate.cjs` (new) | N/A | Flip-flop detection on promotion-changelog.json + cooldown enforcement | Feature 4: Gate maturity stabilization gates |

### Development Tools (existing)

| Tool | Purpose | Notes |
|------|---------|-------|
| TLC model checker | Verify NFSolveConvergence spec | Existing `run-formal-verify.cjs` already orchestrates TLC runs |
| `nf-solve.cjs --json` | Machine-readable solve output | Integration point for all 6 features -- JSON output feeds trend tracker |
| `compute-per-model-gates.cjs` | Gate computation with `--write-per-model` | Feature 6 wires this into the solve pipeline |

## Feature-by-Feature Stack Decisions

### Feature 1: Cross-Session Residual Trend Tracker

**Storage format:** NDJSON at `.planning/formal/solve-trend.ndjson`

Why NDJSON over SQLite or plain JSON array:
- NDJSON supports atomic append (`fs.appendFileSync`) -- no read-modify-write race conditions
- Already proven by `check-results.ndjson` (30 consumers in `bin/`)
- Each line is self-contained: `{ "timestamp": "ISO", "iteration": N, "layers": { "r_to_f": 90, ... }, "total": 114 }`
- Trivial to read last N entries: read file, split lines, take tail
- No file-locking needed -- single-writer (nf-solve.cjs)

**Trend detection algorithm:** Ordinary Least Squares (OLS) linear regression, hand-rolled in ~20 lines of JS.

```javascript
// Linear regression: y = mx + b
// m > 0 = diverging (bad), m < 0 = converging (good), m ~ 0 = stalled
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const { x, y } of points) {
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const ssTot = sumY2 - (sumY * sumY) / n;
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}
```

Why not a statistics npm package:
- We need exactly one function: slope of a line through N points
- OLS is 15 lines -- adding `simple-statistics` (78KB) or `mathjs` (2MB) for one function is unjustifiable
- R-squared gives confidence in the trend -- if R2 < 0.5, flag as "noisy, insufficient data"

**Integration point:** End of `nf-solve.cjs` main(), after `solve-state.json` write (line ~3490), append to NDJSON and compute per-layer slopes.

### Feature 2: Layer Oscillation Breaker (Option C)

**Detection mechanism:** Compare current layer residual direction against previous entries in `solve-trend.ndjson`.

Per-layer state machine (4 states, 5 transitions):
- `STABLE` -> residual decreased or unchanged -> `STABLE`
- `STABLE` -> residual increased -> `REGRESSED` (first oscillation allowed)
- `REGRESSED` -> residual decreased -> `RECOVERING`
- `RECOVERING` -> residual increased -> `BLOCKED` (second oscillation = Option C violation)
- `BLOCKED` -> human escalation required

**Storage:** Per-layer oscillation state stored in `solve-state.json` as new `oscillation_state` field. This is a single-run snapshot file that already persists `known_issues` -- adding oscillation state is a natural extension.

```json
{
  "oscillation_state": {
    "r_to_f": { "state": "STABLE", "prev_residual": 90, "direction_changes": 0 },
    "f_to_c": { "state": "REGRESSED", "prev_residual": 1, "direction_changes": 1 }
  }
}
```

Why not use the existing circuit breaker (`hooks/nf-circuit-breaker.js`):
- Circuit breaker detects git commit oscillation (file-level repetition patterns)
- Layer oscillation is a different signal: residual count direction across solve runs
- Separate concern, separate detector -- but same escalation pattern (block + human gate)

Why not XState for the 4-state machine:
- XState is a dev dependency used for the TUI workflow machine
- 4 states with 5 transitions is a plain lookup table, not a statechart
- The existing circuit breaker uses the same approach: plain JS state transitions

### Feature 3: Predictive Power Feedback Loop

**Test-to-model linking mechanism:** Extend `per-model-gates.json` entries with `predictive_score` and use the existing requirement-mediated architecture.

Current `check-results.ndjson` entries already contain:
- `requirement_ids[]` -- which requirements a check covers
- `tool` -- which model checker ran
- `result` -- pass/fail/inconclusive
- `check_id` -- unique identifier

Linking approach (requirement-mediated, matches v0.25 traceability architecture):
1. When a test fails, match its `requirement_ids` against model-registry entries that cover the same requirements
2. If a formal model's property predicted the failure mode (via failure-mode-catalog.json), score it as `bugs_predicted++`
3. Store per-model predictive scores in `per-model-gates.json` (already has per-model structure via `--write-per-model`)

**Scoring formula:**
```
predictive_power = bugs_predicted / total_bugs_in_scope
```

Where `total_bugs_in_scope` = test failures whose `requirement_ids` overlap with the model's `requirements[]`.

**Storage:** New `predictive_score` section in `per-model-gates.json`:
```json
{
  "models": {
    ".planning/formal/tla/QGSDQuorum.tla": {
      "gate_a": { "pass": true, "reason": "..." },
      "predictive_score": { "bugs_predicted": 3, "total_in_scope": 5, "power": 0.6 }
    }
  }
}
```

Why this works: The existing traceability matrix (`traceability-matrix.json`) already maps requirements to properties to models. The linking is requirement-mediated, not direct test-to-model -- which matches the existing architecture's bidirectional traceability design from v0.25 (63.8% coverage).

### Feature 4: Gate Maturity Stabilization Gates

**Flip-flop detection:** Read `promotion-changelog.json` (already exists, 200-entry retention cap, already shows repeated promotions of same model). Detect when a model has been promoted and demoted more than once in a configurable window.

Current `promotion-changelog.json` entry schema already has everything needed:
```json
{
  "model": ".planning/formal/alloy/quorum-votes.als",
  "from_level": "ADVISORY",
  "to_level": "SOFT_GATE",
  "timestamp": "2026-03-09T21:26:25.257Z",
  "evidence_readiness": { "score": 2, "total": 5 },
  "trigger": "auto_promotion"
}
```

Detection algorithm:
1. Filter changelog for entries matching a model
2. Count direction changes (promotion then demotion = 1 flip)
3. If flips >= 2 within `STABILIZATION_WINDOW` (default: 3 solve sessions, not wall-clock -- session-based windows are more meaningful for a developer tool where sessions may be hours or days apart)
4. Cooldown = block re-promotion until model holds stable for `COOLDOWN_SESSIONS` (default: 3 consecutive sessions without regression)

**Integration point:** `compute-per-model-gates.cjs` line ~432 (auto-promotion block). Before promoting, call stabilization gate check:

```javascript
const { isInCooldown } = require('./stabilization-gate.cjs');
if (isInCooldown(modelPath, changelog)) {
  // Skip promotion, log reason
  continue;
}
```

**Hysteresis stacking:** The existing code already has threshold hysteresis (promote at score >= 1, demote at score < 0.8 -- lines 476-477 of compute-per-model-gates.cjs). Stabilization gates add temporal hysteresis on top. Both are needed: threshold hysteresis prevents noise, temporal stabilization prevents oscillating external conditions.

### Feature 5: NFSolveConvergence TLA+ Spec

**TLA+ patterns for convergence proof under Option C:**

The spec models the outer loop: `Solve -> Test -> Solve -> ... -> Converged`

Key TLA+ constructs (all standard TLA+, no extensions):
- `VARIABLES residual, iteration, layer_states` -- state of each layer across iterations
- `Nat` sequences for tracking residual history per layer
- Fairness: `WF_vars(SolveStep)` -- weak fairness ensures solve keeps running
- Convergence property: `<>(residual = 0)` (eventually converges)
- Option C invariant: `\A layer \in Layers: direction_changes[layer] <= 1`

**Existing TLA+ pattern to follow:** `QGSDBreakerState.tla` -- it models a state machine with BOOLEAN + Nat variables, safety invariants, and actions. The convergence spec follows the same structure but adds a liveness property.

**Model bounding (critical for TLC tractability):**
- Bound `Layers` to 4-5 representative layers (not all 19 -- TLC state space explodes combinatorially)
- Bound `residual` values to 0..3 (abstract residual magnitude, not exact counts)
- Bound `iterations` to 0..5
- This keeps state space under ~10K states -- verifiable in seconds by TLC

**Why not PRISM:** PRISM is for probabilistic model checking. Convergence under Option C is deterministic (if residuals can only oscillate once per layer, the sequence must terminate because each layer's residual is bounded and monotonically decreasing after at most one increase). TLA+ with TLC is the right tool for deterministic safety + liveness properties.

### Feature 6: Per-Model Gate Persistence in Solve Pipeline

**Integration:** Wire `compute-per-model-gates.cjs --write-per-model --aggregate` as a post-sweep step in `nf-solve.cjs`.

Current flow (lines 3450-3510 of nf-solve.cjs):
```
nf-solve.cjs main()
  -> sweep layers
  -> auto-close gaps
  -> write solve-state.json
  -> persist session summary
  -> exit
```

New flow:
```
nf-solve.cjs main()
  -> sweep layers
  -> auto-close gaps
  -> write solve-state.json
  -> spawnTool('compute-per-model-gates.cjs', ['--write-per-model', '--aggregate'])  // NEW
  -> append to solve-trend.ndjson  // Feature 1
  -> check oscillation breaker    // Feature 2
  -> persist session summary
  -> exit
```

The `spawnTool` helper (line 82 of nf-solve.cjs) already exists and handles error isolation, timeout, and stderr piping. Adding one more child process call is a single line change.

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `simple-statistics` npm | 78KB (45KB min) for one function (linear regression). Violates zero-dep pattern of bin/ scripts. | Hand-rolled OLS in ~20 lines |
| `mathjs` npm | 2MB+, massive dependency tree for elementary arithmetic | Inline formulas |
| `d3-array` / `d3-regression` | Pulls D3 ecosystem; no visualization needed in CLI | Inline slope computation |
| SQLite / `better-sqlite3` | Adds native compilation dependency (node-gyp). Overkill for scanning 200-entry JSON files. | NDJSON flat file (proven by check-results.ndjson) |
| LevelDB / RocksDB | Embedded database overkill; we need append + tail-read only | NDJSON + `fs.appendFileSync` |
| InfluxDB / TimescaleDB | External service dependency for a CLI plugin is absurd | NDJSON flat file |
| PRISM for convergence proof | Convergence under Option C is deterministic, not probabilistic | TLA+ with TLC |
| `ajv` / `zod` for new data formats | Existing pattern: manual validation in loader functions (fail-open) | `loadJSON()` with inline checks |
| XState for oscillation state machine | 4 states, 5 transitions -- XState is overkill for a lookup table | Plain JS object/switch |
| `chart.js` / plotting libraries | CLI tool, not a browser app. Solve TUI renders ASCII tables. | ASCII trend indicators (arrows, sparklines) |

## File Layout for New Artifacts

```
.planning/formal/
  solve-state.json          # EXTENDED: + oscillation_state field
  solve-trend.ndjson        # NEW: append-only time series of per-layer residuals
  promotion-changelog.json  # EXISTING: read by stabilization gate (no schema change)
  gates/
    per-model-gates.json    # EXTENDED: + predictive_score field per model
  tla/
    NFSolveConvergence.tla  # NEW: convergence proof spec
    NFSolveConvergence.cfg  # NEW: TLC config for convergence spec

bin/
  trend-tracker.cjs         # NEW: NDJSON append + linear regression
  trend-tracker.test.cjs    # NEW: unit tests
  oscillation-breaker.cjs   # NEW: Option C enforcement
  oscillation-breaker.test.cjs
  predictive-scorer.cjs     # NEW: test-to-model linking + scoring
  predictive-scorer.test.cjs
  stabilization-gate.cjs    # NEW: flip-flop detection + cooldown
  stabilization-gate.test.cjs
```

## New Data Contracts

| File | Format | Schema | Readers |
|------|--------|--------|---------|
| `solve-trend.ndjson` | NDJSON | `{ timestamp: ISO, session_id: string, iteration: number, layers: { [name]: number }, total: number }` | trend-tracker.cjs, oscillation-breaker.cjs, solve TUI |
| `solve-state.json` + `oscillation_state` | JSON (extension) | `{ oscillation_state: { [layer]: { state: "STABLE"\|"REGRESSED"\|"RECOVERING"\|"BLOCKED", prev_residual: number, direction_changes: number } } }` | oscillation-breaker.cjs, nf-solve.cjs |
| `per-model-gates.json` + `predictive_score` | JSON (extension) | `{ models: { [path]: { ..., predictive_score: { bugs_predicted: number, total_in_scope: number, power: number } } } }` | predictive-scorer.cjs, solve report |

## Existing Data Contracts (do not change schema)

| File | Contract | Why Stable |
|------|----------|------------|
| `solve-state.json` base fields | `{ known_issues, converged, iteration_count, final_residual_total }` | Read by solve TUI, solve-report template. Adding `oscillation_state` is additive (readers ignore unknown fields). |
| `promotion-changelog.json` | `[{ model, from_level, to_level, timestamp, evidence_readiness, trigger }]` | Read by compute-per-model-gates.cjs. Append-only with 200-entry cap. Stabilization gate reads, does not write. |
| `check-results.ndjson` | One JSON per line: `{ check_id, result, tool, requirement_ids, ... }` | Read by 30 consumers. Predictive scorer reads, does not write. |
| `model-registry.json` | `{ models: { [path]: { requirements, gate_maturity, layer_maturity, ... } } }` | Central registry. Read/written by compute-per-model-gates.cjs. Predictive scorer reads requirements only. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| NDJSON flat file for trends | JSON array file | If random access by index needed -- but we only need append + tail |
| Hand-rolled linear regression | `simple-statistics` npm | If scope expands to >3 statistical functions (median, percentile, distribution) |
| solve-state.json extension for oscillation | Separate oscillation-state.json | If oscillation state grows beyond ~1KB per layer (unlikely with 19 layers) |
| Requirement-mediated test linking | Direct test-to-model mapping | If requirement coverage < 30% -- but traceability matrix is at 63.8% |
| Session-count stabilization windows | Wall-clock time windows | If solve runs become automated/continuous rather than developer-driven |
| TLA+ for convergence | Alloy | If relational reasoning about model interactions needed -- but convergence is sequential |

## Stack Patterns by Feature Interaction

**If a layer has < 3 solve sessions of history:**
- Skip trend detection for that layer (insufficient data for regression)
- Return `"insufficient_data"` instead of `"converging"` / `"diverging"`
- Because: Linear regression on 1-2 points is meaningless

**If oscillation detector fires on a layer:**
- Block further nf:solve iterations for that layer only, not globally
- Other layers continue converging
- Because: Option C requires per-layer granularity

**If predictive power score is 0 for all models:**
- Expected initially -- no test failures have been linked yet
- Display "no predictions yet", do not treat as error
- Because: Linking builds up over time as tests reference formal properties

**If stabilization gate and oscillation breaker both fire:**
- Stabilization gate prevents re-promotion (gate maturity level)
- Oscillation breaker prevents re-iteration (solve loop control)
- These are independent mechanisms operating at different granularities
- Both can fire simultaneously without conflict

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| Node.js v25.8.0 | All new code (pure CJS) | No ESM needed -- project uses `.cjs` throughout. `fs.appendFileSync` for NDJSON is stable since Node 0.6. |
| TLC 2.18+ | NFSolveConvergence.tla | Requires `WF_vars()` for liveness -- available since TLC 2.15 |
| solve-state.json schema | nf-solve.cjs, solve-tui.cjs | Adding `oscillation_state` is backward-compatible (readers ignore unknown fields) |
| per-model-gates.json schema v2 | compute-per-model-gates.cjs | Adding `predictive_score` is backward-compatible (`schema_version` stays "2") |
| solve-trend.ndjson | New file, no backward compat concern | Consumers opt-in by reading the file |
| promotion-changelog.json | stabilization-gate.cjs | Read-only access; no schema change |

## Installation

```bash
# No new npm packages required.
# New files are pure Node.js CJS scripts added to bin/.
# They integrate with existing nf:solve pipeline via CLI composition (spawnTool).
```

## Sources

- `bin/nf-solve.cjs` lines 3464-3510 -- solve-state.json write, session persistence, spawnTool helper -- HIGH confidence
- `bin/compute-per-model-gates.cjs` lines 430-490 -- auto-promotion with hysteresis, appendChangelog, per-model gate persistence -- HIGH confidence
- `.planning/formal/solve-state.json` -- current schema (12 layers, residual values 0-6245) -- HIGH confidence
- `.planning/formal/promotion-changelog.json` -- 200-entry capped, shows repeated promotions of same model (flip-flop observable in existing data) -- HIGH confidence
- `.planning/formal/tla/QGSDBreakerState.tla` -- TLA+ pattern reference for state machine specs with safety invariants -- HIGH confidence
- `.planning/formal/solve-sessions/` -- 5 session files from single day, confirms session volume is small -- HIGH confidence
- `package.json` -- 5 runtime deps (all TUI: blessed, node-pty, xterm, inquirer), 6 dev deps -- zero formal pipeline deps confirmed -- HIGH confidence
- Node.js v25.8.0 `fs.appendFileSync` -- atomic append for NDJSON, stable API -- HIGH confidence

---
*Stack research for: nForma v0.33 Outer-Loop Convergence Guarantees*
*Researched: 2026-03-09*
