# Liveness Fairness Declarations: convergence

**Spec source:** `formal/tla/QGSDConvergence.tla`
**Config:** `formal/tla/MCconvergence.cfg`

## ConvergenceEventuallyResolves

**Property:** `ConvergenceEventuallyResolves == <>(logWritten = TRUE)`
**Config line:** `PROPERTY ConvergenceEventuallyResolves` (MCconvergence.cfg)
**Fairness assumption:** WF_vars on 1 action: HaikuReturnsYES
**Realism rationale:** The convergence check in QGSD's oscillation-resolution mode uses the Haiku reviewer (claude-haiku-4-5-20251001) to classify GENUINE vs REFINEMENT. HaikuReturnsYES fires when the Haiku classifier returns a YES verdict. By weak fairness, if the Haiku call is enabled (circuit breaker active, Haiku available), it must eventually complete and fire the action — models the fact that the HTTP call to the Haiku endpoint, once initiated, will not be permanently stuck. In QGSD's deployment, Haiku is a reliable low-latency endpoint with a 10s timeout ensuring completion.

**Source:** `formal/tla/QGSDConvergence.tla`, lines 84–85, 88–89
