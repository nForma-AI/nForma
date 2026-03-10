# Liveness Fairness Declarations: convergence

**Spec source:** `formal/tla/QGSDConvergence.tla`
**Config:** `formal/tla/MCconvergence.cfg`

## ConvergenceEventuallyResolves

**Property:** `ConvergenceEventuallyResolves == <>(logWritten = TRUE)`
**Config line:** `PROPERTY ConvergenceEventuallyResolves` (MCconvergence.cfg)
**Fairness assumption:** WF_vars on 1 action: HaikuReturnsYES
**Realism rationale:** The convergence check in QGSD's oscillation-resolution mode uses the Haiku reviewer (claude-haiku-4-5-20251001) to classify GENUINE vs REFINEMENT. HaikuReturnsYES fires when the Haiku classifier returns a YES verdict. By weak fairness, if the Haiku call is enabled (circuit breaker active, Haiku available), it must eventually complete and fire the action — models the fact that the HTTP call to the Haiku endpoint, once initiated, will not be permanently stuck. In QGSD's deployment, Haiku is a reliable low-latency endpoint with a 10s timeout ensuring completion.

**Source:** `formal/tla/QGSDConvergence.tla`, lines 84–85, 88–89

## ResolvedAtWriteOnce

**Property:** `ResolvedAtWriteOnce == [][logWritten = TRUE => logWritten' = TRUE]_vars`
**Config line:** `PROPERTY ResolvedAtWriteOnce` (MCconvergence.cfg)
**Fairness assumption:** None required — this is a safety/action property ([][...]_vars), not a liveness property. It asserts that once logWritten becomes TRUE it can never revert to FALSE. No fairness needed because the property constrains all transitions unconditionally.
**Realism rationale:** Write-once semantics on the resolution log entry: once the oscillation-resolution outcome is persisted to the NDJSON log, no subsequent action may erase or overwrite it. This models the append-only nature of `.planning/memory/errors.jsonl`.

**Source:** `formal/tla/NFConvergence.tla`, lines 73–74

## HaikuUnavailableNoCorruption

**Property:** `HaikuUnavailableNoCorruption == [][haikuVerdict' = "UNAVAILABLE" => (logWritten' = logWritten /\ stateDeleted' = stateDeleted)]_vars`
**Config line:** `PROPERTY HaikuUnavailableNoCorruption` (MCconvergence.cfg)
**Fairness assumption:** None required — this is a safety/action property ([][...]_vars), not a liveness property. It asserts that transitioning to UNAVAILABLE preserves logWritten and stateDeleted values. No fairness needed because it constrains the specific transition to UNAVAILABLE, not eventual reachability.
**Realism rationale:** When the Haiku classifier endpoint becomes unavailable (timeout, quota, network error), the circuit breaker's fail-open design must not corrupt the log or prematurely delete state. This models the error-handling guarantee in `hooks/nf-circuit-breaker.js`.

**Source:** `formal/tla/NFConvergence.tla`, lines 85–87
