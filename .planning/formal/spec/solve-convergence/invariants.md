# Liveness Fairness Declarations: solve-convergence

**Spec source:** `formal/tla/NFSolveConvergence.tla`
**Config:** `formal/tla/MCsolve-convergence.cfg`

## EventualConvergence

**Property:** `EventualConvergence == <>(converged = TRUE)`
**Config line:** `PROPERTY EventualConvergence` (MCsolve-convergence.cfg)
**Fairness assumption:** WF_vars on 2 actions: ProgressSession, CheckConvergence
**Realism rationale:** The outer nf:solve loop runs periodically (triggered by user or CI). Session actions are split into ProgressSession (decreasing residual) and RegressSession (increasing residual). ProgressSession models each invocation reducing a non-blocked layer's residual -- by weak fairness, if enabled (non-blocked layers with residual > 0 exist), it must eventually fire. This models nf:solve making progress rather than regressing indefinitely. RegressSession has NO fairness -- regression is possible but not guaranteed, modeling the non-deterministic nature of regressions that trigger oscillation detection. CheckConvergence fires when all layers have residual=0 or are blocked by Option C. Together: layers either converge to zero via ProgressSession, or get blocked by Option C when RegressSession triggers oscillation detection (decrease-then-increase pattern), and CheckConvergence fires once all layers are terminal.

**Source:** `formal/tla/NFSolveConvergence.tla`, Spec definition (last section)
