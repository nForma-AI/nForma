# Liveness Fairness Declarations: solve-convergence

**Spec source:** `formal/tla/NFSolveConvergence.tla`
**Config:** `formal/tla/MCsolve-convergence.cfg`

## EventualConvergence

**Property:** `EventualConvergence == <>(converged = TRUE)`
**Config line:** `PROPERTY EventualConvergence` (MCsolve-convergence.cfg)
**Fairness assumption:** WF_vars on 2 actions: RunSession, CheckConvergence
**Realism rationale:** The outer nf:solve loop runs periodically (triggered by user or CI). RunSession models each invocation picking a non-blocked layer and computing a new residual. By weak fairness, if RunSession is enabled (non-blocked layers exist, session < MaxSessions), it must eventually fire -- models the fact that nf:solve invocations continue as long as there are unresolved layers. CheckConvergence fires when all layers have residual=0 or are blocked by Option C. By weak fairness, once CheckConvergence is enabled (all layers resolved or blocked), it must eventually fire -- models the immediate check that happens after each session completes. Together, these fairness assumptions ensure the solve loop makes progress: layers either converge to zero residual or get blocked by Option C oscillation detection, and the convergence check fires once all layers are in a terminal state.

**Source:** `formal/tla/NFSolveConvergence.tla`, Spec definition (last section)
