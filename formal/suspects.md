# Formal Verification Suspects

**Generated:** 2026-02-28T23:54:32.727Z
**Total Suspects:** 22

## Critical Failures (result=fail)

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 8823 divergence(s) in 12771 traces (90ms)
- **Runtime:** 90ms
- **Tags:** trace-divergence

### alloy:quorum-votes
- **Property:** Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants
- **Summary:** fail: alloy:quorum-votes (Java not found)
- **Runtime:** 0ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 2ms
- **Runtime:** 2ms
- **Tags:** none

### alloy:quorum-votes
- **Property:** Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants
- **Summary:** fail: alloy:quorum-votes (Java not found)
- **Runtime:** 0ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### alloy:quorum-votes
- **Property:** Vote counting correctness — no vote loss, no double counting, unanimous agreement invariants
- **Summary:** fail: alloy:quorum-votes (Java not found)
- **Runtime:** 0ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 2ms
- **Runtime:** 2ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:mcp-availability
- **Property:** MCP server availability under nondeterministic failure modes
- **Summary:** fail: prism:mcp-availability in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:mcp-availability
- **Property:** MCP server availability under nondeterministic failure modes
- **Summary:** fail: prism:mcp-availability in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:mcp-availability
- **Property:** MCP server availability under nondeterministic failure modes
- **Summary:** fail: prism:mcp-availability in 1ms
- **Runtime:** 1ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: quorum in 365ms
- **Runtime:** 365ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum (binary not found)
- **Runtime:** 0ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: prism:quorum in 1ms
- **Runtime:** 1ms
- **Tags:** none

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCTUINavigation: EscapeProgress; MCsafety: AllTransitionsValid, DeliberationMonotone
- **Runtime:** 0ms
- **Tags:** needs-fairness

## SPEC-02 Oscillation Audit (2026-03-01)

### Comparison: QGSDOscillation.tla vs qgsd-circuit-breaker.js (detectOscillation + hasReversionInHashes)

#### 1. Run-collapse algorithm

- **JS (`detectOscillation`)**: Iterates fileSets, computes `key = files.slice().sort().join('\0')`. Consecutive entries with same key are merged into one run-group (runs array). A new run is pushed when key differs.
- **TLA+ (`CollapseRuns`)**: Uses recursive `collapse(seq, acc)` function. Appends to acc when either acc is empty OR `Head(seq) # Head(Tail(acc \o <<Head(seq)>>))` (i.e., last element of acc differs from current). Consecutive identical labels are merged.
- **Finding**: CONFIRMED CORRECT — TLA+ CollapseRuns correctly models JS run-group counting. Abstract labels (A, B, C) represent the sorted-join keys. The consecutive-duplicate-merging logic is equivalent.

#### 2. Depth threshold

- **JS**: `if (keyRunList.length >= depth)` where depth = `config.circuit_breaker.oscillation_depth` (default 3).
- **TLA+**: `Depth` constant, `MCoscillation.cfg` sets `Depth = 3`.
- **Finding**: CONFIRMED CORRECT — `Depth=3` in the model matches the JS default. The `>=` comparison is identical in both (`keyRunList.length >= depth` vs `flagCount[l] >= Depth`).

#### 3. Second-pass net-diff logic (hasReversionInHashes) — CRITICAL

- **JS (`hasReversionInHashes`)**: Iterates consecutive pairs oldest→newest, accumulates `totalNetChange += (additions - deletions)`. Returns `totalNetChange <= 0`.
- **TLA+ (`SetNetChange`)**: Nondeterministically sets `netChange' = n` for any `n \in -(CommitWindow)..(CommitWindow)`. This range includes both positive (TDD progression) and non-positive (genuine reversion) values.
- **Finding**: CONFIRMED CORRECT — The nondeterministic abstraction over-approximates correctly. TLC explores states where netChange > 0 (not oscillation) and netChange <= 0 (oscillation). EvaluateFlag only fires when the algorithm decides, and `netChange <= 0` matches `totalNetChange <= 0` in JS.

#### 4. Flag condition (EvaluateFlag vs JS final decision)

- **TLA+**: `flagged' = (\E l \in Labels : flagCount[l] >= Depth /\ netChange <= 0)` — conjunction of run-count threshold AND non-positive net diff.
- **JS**: `if (keyRunList.length >= depth)` → calls `hasReversionInHashes(...)` → if `isRealOscillation` (i.e., `totalNetChange <= 0`) then `return { detected: true }`.
- **`OscillationFlaggedCorrectly`**: `flagged <=> (\E l \in Labels : flagCount[l] >= Depth /\ netChange <= 0)` — exactly encodes the JS conjunction.
- **Finding**: CONFIRMED CORRECT — The conjunction precisely encodes the JS `&&` logic. No false divergence.

### Result: CONFIRMED CORRECT

No divergences found between QGSDOscillation.tla and qgsd-circuit-breaker.js. The nondeterministic abstraction of hasReversionInHashes correctly over-approximates the JS algorithm. Spec unchanged.
