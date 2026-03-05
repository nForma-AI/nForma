# Liveness Fairness Declarations: agent-loop

**Spec source:** `formal/tla/QGSDAgentLoop.tla`
**Config:** `formal/tla/MCAgentLoop.cfg`

## EventuallyTerminates

**Property:** `EventuallyTerminates == <>(status \in {"success", "cap_exhausted", "unrecoverable"})`
**Config line:** `PROPERTY EventuallyTerminates` (MCAgentLoop.cfg)
**Fairness assumption:** WF_vars on 1 action: DoIteration
**Realism rationale:** The QGSD agent loop executes iterations until a terminal condition is reached (success, turn cap exhausted, or unrecoverable error). DoIteration fires each time the agent processes one turn. By weak fairness, if the iteration action is enabled (agent has not terminated), it must eventually fire — models the fact that the Claude Code event loop processes pending API responses and does not permanently stall. The turn cap (`max_turns`) provides an absolute bound ensuring termination even without successful completion.

**Source:** `formal/tla/QGSDAgentLoop.tla`, lines 88–89, 91–94
