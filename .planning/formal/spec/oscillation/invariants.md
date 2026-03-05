# Liveness Fairness Declarations: oscillation

**Spec source:** `formal/tla/QGSDOscillation.tla`
**Config:** `formal/tla/MCoscillation.cfg`

## AlgorithmTerminates

**Property:** `AlgorithmTerminates == <>(algorithmDone = TRUE)`
**Config line:** `PROPERTY AlgorithmTerminates` (MCoscillation.cfg)
**Fairness assumption:** WF_vars on 2 actions: EvaluateFlag, CollapseRuns
**Realism rationale:** The run-collapse algorithm in `hooks/qgsd-circuit-breaker.js` processes commit groups from a bounded history window (CommitWindow). CollapseRuns fires to group consecutive commits on the same file set; EvaluateFlag fires to evaluate the final oscillation flag once all runs are collapsed. Both actions become enabled as commits are processed and the window advances. By weak fairness, once a commit-processing action is enabled (new commit in window), it must eventually fire — models the sequential PreToolUse hook execution where each invocation processes at least one more commit entry before completing.

**Source:** `formal/tla/QGSDOscillation.tla`, lines 136–137, 140–142
