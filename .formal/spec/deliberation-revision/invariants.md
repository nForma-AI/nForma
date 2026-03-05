# Liveness Fairness Declarations: deliberation-revision

**Spec source:** `formal/tla/QGSDDeliberationRevision.tla`
**Config:** `formal/tla/MCDeliberationRevision.cfg`

## AllVotersReviseBeforeAdvance

**Property:** `AllVotersReviseBeforeAdvance == [][round' > round => \A v \in Voters : lastRevised[v] = round]_vars`
**Config line:** `PROPERTY AllVotersReviseBeforeAdvance` (MCDeliberationRevision.cfg)
**Fairness assumption:** None required (temporal safety property — box formula).

AllVotersReviseBeforeAdvance asserts that the round counter only advances when all voters have revised in the current round. This is a `[][...]_vars` formula constraining the round-advance transition — a pure safety property. The Spec definition contains no fairness clauses (`Spec == Init /\ [][Next]_vars`).

**Source:** `formal/tla/QGSDDeliberationRevision.tla`, lines 132–133

## PeerReviewBeforeRevision

**Property:** `PeerReviewBeforeRevision == [][\A v \in Voters : (lastRevised'[v] > lastRevised[v] /\ round > 1) => reviewedPeers[v] = Voters \ {v}]_vars`
**Config line:** `PROPERTY PeerReviewBeforeRevision` (MCDeliberationRevision.cfg)
**Fairness assumption:** None required (temporal safety property — box formula).

PeerReviewBeforeRevision asserts that a voter can only revise their position (after round 1) if they have reviewed all peers. This is a `[][...]_vars` formula — a pure safety property enforcing the peer-review guard structurally. No fairness needed.

**Source:** `formal/tla/QGSDDeliberationRevision.tla`, lines 138–142
