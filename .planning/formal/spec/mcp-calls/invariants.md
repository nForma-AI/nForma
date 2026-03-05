# Liveness Fairness Declarations: mcp-calls

**Spec source:** `formal/tla/QGSDMCPEnv.tla`
**Config:** `formal/tla/MCMCPEnv.cfg`

## EventualDecision

**Property:** `EventualDecision == <>(quorumPhase = "DECIDED")`
**Config line:** `PROPERTY EventualDecision` (MCMCPEnv.cfg)
**Fairness assumption:** WF_vars(QuorumProcessOutcomes), WF_vars(QuorumDecide), WF_vars(TimeoutAction)

Each WF_vars operator is required to prevent TLC from exploring infinite stuttering traces that never advance:
- `WF_vars(QuorumProcessOutcomes)`: Guarantees that once an MCP slot subprocess terminates (timeout expires or response received), its outcome is eventually recorded in the quorum outcome set. Without this, TLC could stutter on an enabled QuorumProcessOutcomes action indefinitely, producing inconclusive results.
- `WF_vars(QuorumDecide)`: Guarantees that once the quorum threshold of non-UNAVAIL outcomes is reached, QuorumDecide fires and transitions quorumPhase to "DECIDED". Without this, TLC could stutter after threshold is reached, never reaching the DECIDED state.
- `WF_vars(TimeoutAction)`: Guarantees that if all pending calls expire without reaching threshold, TimeoutAction fires and terminates the round. Without this, TLC could stutter after all timeouts expire, never closing the round.

**Realism rationale:** The TLA+ spec models MCP servers as nondeterministic environment processes. Quorum collects responses from multiple MCP slots in parallel via call-quorum-slot.cjs subprocesses. Each subprocess has a finite timeout (120s default, configurable via CLAUDE_MCP_TIMEOUT_MS). Once a timeout expires or a response is received, the subprocess terminates and the response is queued. The qgsd-prompt.js event loop processes the response queue and enables either QuorumDecide (if threshold reached) or TimeoutAction (if all pending calls expired). By weak fairness, enabled actions must eventually fire — the event loop does not permanently skip an enabled action. Therefore, quorum must eventually reach DECIDED.

**Source:** `formal/tla/QGSDMCPEnv.tla`, lines 110–113 (Spec with fairness), lines 141–144 (EventualDecision property)
