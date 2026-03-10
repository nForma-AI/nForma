# Liveness Fairness Declarations: deliberation

**Spec source:** `formal/tla/QGSDDeliberation.tla`
**Config:** `formal/tla/MCdeliberation.cfg`

## ProtocolTerminates

**Property:** `ProtocolTerminates == <>(round > MaxDeliberationRounds \/ voteState = "CONSENSUS" \/ voteState = "ESCALATED")`
**Config line:** `PROPERTY ProtocolTerminates` (MCdeliberation.cfg)
**Fairness assumption:** WF_vars on 3 actions: Escalate, ReceiveApprove, ImprovementAccepted
**Realism rationale:** The R3 deliberation protocol in QGSD's quorum orchestrator runs a bounded loop (up to 10 rounds per R3.3). Once the round counter exceeds MaxDeliberationRounds or a terminal vote is received, the Escalate or ReceiveApprove action becomes enabled. By weak fairness, this enabled action must eventually fire — models the fact that the round-dispatch loop will not indefinitely skip a terminal outcome. ImprovementAccepted covers the R3.6 iterative improvement path, which also terminates by round bound.

**Source:** `formal/tla/QGSDDeliberation.tla`, lines 114, 118–121

## DeliberationMonotone

**Property:** `DeliberationMonotone == [][deliberationRound' >= deliberationRound]_vars`
**Config line:** `PROPERTY DeliberationMonotone` (MCdeliberation.cfg)
**Fairness assumption:** None required — this is a safety/action property ([][...]_vars), not a liveness property. It asserts that the deliberation round counter never decreases between any two consecutive states. No fairness needed because it constrains all transitions unconditionally.
**Realism rationale:** The R3 deliberation protocol dispatches rounds sequentially (R3.3). Each round increments the counter; no action resets or decrements it. This models the monotonic progress guarantee in the quorum orchestrator's round-dispatch loop.

**Source:** `formal/tla/NFDeliberation.tla`, lines 107–108

## ImprovementMonotone

**Property:** `ImprovementMonotone == [][improvementIteration' >= improvementIteration]_vars`
**Config line:** `PROPERTY ImprovementMonotone` (MCdeliberation.cfg)
**Fairness assumption:** None required — this is a safety/action property ([][...]_vars), not a liveness property. It asserts that the improvement iteration counter never decreases between any two consecutive states. No fairness needed because it constrains all transitions unconditionally.
**Realism rationale:** The R3.6 iterative improvement path accepts plan revisions sequentially. Each accepted improvement increments the counter; no action resets it. This models the monotonic progress guarantee in the improvement acceptance loop.

**Source:** `formal/tla/NFDeliberation.tla`, lines 112–113
