# Liveness Fairness Declarations: deliberation

**Spec source:** `formal/tla/QGSDDeliberation.tla`
**Config:** `formal/tla/MCdeliberation.cfg`

## ProtocolTerminates

**Property:** `ProtocolTerminates == <>(round > MaxDeliberationRounds \/ voteState = "CONSENSUS" \/ voteState = "ESCALATED")`
**Config line:** `PROPERTY ProtocolTerminates` (MCdeliberation.cfg)
**Fairness assumption:** WF_vars on 3 actions: Escalate, ReceiveApprove, ImprovementAccepted
**Realism rationale:** The R3 deliberation protocol in QGSD's quorum orchestrator runs a bounded loop (up to 10 rounds per R3.3). Once the round counter exceeds MaxDeliberationRounds or a terminal vote is received, the Escalate or ReceiveApprove action becomes enabled. By weak fairness, this enabled action must eventually fire — models the fact that the round-dispatch loop will not indefinitely skip a terminal outcome. ImprovementAccepted covers the R3.6 iterative improvement path, which also terminates by round bound.

**Source:** `formal/tla/QGSDDeliberation.tla`, lines 114, 118–121
