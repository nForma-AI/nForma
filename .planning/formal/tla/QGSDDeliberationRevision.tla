---- MODULE QGSDDeliberationRevision ----
(*
 * .formal/tla/QGSDDeliberationRevision.tla
 * Handwritten — not generated from XState.
 * Source: commands/qgsd/quorum.md, src/machines/qgsd-workflow.machine.ts
 *
 * Models the deliberation position revision requirement: every quorum
 * member (including Claude) MUST review prior-round positions and
 * revise their own position before each deliberation round. No voter's
 * position may be frozen across rounds.
 *
 * @requirement QUORUM-05
 *)
EXTENDS Naturals, FiniteSets

CONSTANTS
    Voters,          \* Set of quorum participants (e.g., {"claude", "codex", "gemini"})
    MaxRounds        \* Maximum deliberation rounds

ASSUME MaxRounds \in Nat /\ MaxRounds > 0

VARIABLES
    round,           \* Current deliberation round number (0 = not started)
    positions,       \* Function: Voter -> current position ("APPROVE" | "BLOCK" | "NONE")
    lastRevised,     \* Function: Voter -> round number when position was last revised
    reviewedPeers,   \* Function: Voter -> set of voters whose positions were reviewed this round
    decided          \* Boolean: has deliberation concluded

vars == <<round, positions, lastRevised, reviewedPeers, decided>>

Positions == {"APPROVE", "BLOCK", "NONE"}

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ round \in 0..MaxRounds
    /\ positions \in [Voters -> Positions]
    /\ lastRevised \in [Voters -> 0..MaxRounds]
    /\ reviewedPeers \in [Voters -> SUBSET Voters]
    /\ decided \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ round = 0
    /\ positions = [v \in Voters |-> "NONE"]
    /\ lastRevised = [v \in Voters |-> 0]
    /\ reviewedPeers = [v \in Voters |-> {}]
    /\ decided = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* ReviewPeerPosition: voter v reviews voter p's position from prior round
ReviewPeer(v, p) ==
    /\ ~decided
    /\ round > 0
    /\ v /= p
    /\ p \notin reviewedPeers[v]
    /\ reviewedPeers' = [reviewedPeers EXCEPT ![v] = @ \cup {p}]
    /\ UNCHANGED <<round, positions, lastRevised, decided>>

\* RevisePosition: voter v revises their position after reviewing all peers.
\* Can only revise if they have reviewed all other voters' prior positions.
\* @requirement QUORUM-05
RevisePosition(v) ==
    /\ ~decided
    /\ round > 0
    /\ reviewedPeers[v] = Voters \ {v}  \* Must have reviewed all peers
    /\ \E newPos \in {"APPROVE", "BLOCK"} :
        /\ positions' = [positions EXCEPT ![v] = newPos]
        /\ lastRevised' = [lastRevised EXCEPT ![v] = round]
    /\ reviewedPeers' = [reviewedPeers EXCEPT ![v] = {}]  \* Reset for next round
    /\ UNCHANGED <<round, decided>>

\* AdvanceRound: move to next deliberation round.
\* Only allowed when ALL voters have revised in the current round.
AdvanceRound ==
    /\ ~decided
    /\ round < MaxRounds
    /\ \A v \in Voters : lastRevised[v] = round  \* All revised this round
    /\ round' = round + 1
    /\ reviewedPeers' = [v \in Voters |-> {}]  \* Reset peer reviews
    /\ UNCHANGED <<positions, lastRevised, decided>>

\* StartDeliberation: initial round where voters submit first positions
StartDeliberation ==
    /\ round = 0
    /\ ~decided
    /\ round' = 1
    /\ reviewedPeers' = [v \in Voters |-> {}]
    /\ UNCHANGED <<positions, lastRevised, decided>>

\* SubmitInitialPosition: voter submits position in round 1 (no peer review needed)
SubmitInitial(v) ==
    /\ round = 1
    /\ ~decided
    /\ positions[v] = "NONE"
    /\ \E pos \in {"APPROVE", "BLOCK"} :
        /\ positions' = [positions EXCEPT ![v] = pos]
        /\ lastRevised' = [lastRevised EXCEPT ![v] = 1]
    /\ UNCHANGED <<round, reviewedPeers, decided>>

\* Decide: conclude deliberation
DecideOutcome ==
    /\ ~decided
    /\ round > 0
    /\ \A v \in Voters : positions[v] /= "NONE"  \* All have voted
    /\ ((\A v \in Voters : positions[v] = "APPROVE")  \* Unanimity
        \/ round >= MaxRounds)                         \* Or exhausted
    /\ decided' = TRUE
    /\ UNCHANGED <<round, positions, lastRevised, reviewedPeers>>

Next ==
    \/ StartDeliberation
    \/ \E v \in Voters : SubmitInitial(v)
    \/ \E v \in Voters, p \in Voters : ReviewPeer(v, p)
    \/ \E v \in Voters : RevisePosition(v)
    \/ AdvanceRound
    \/ DecideOutcome

\* ── Safety invariants ────────────────────────────────────────────────────────

\* NoFrozenPositions: in any round > 1, no voter can have a position
\* that was last revised more than 1 round ago (i.e., frozen).
\* @requirement QUORUM-05
NoFrozenPositions ==
    round > 1 =>
        \A v \in Voters :
            (positions[v] /= "NONE") => lastRevised[v] >= round - 1

\* AllVotersRevise: before advancing a round, every voter must have
\* revised their position in the current round.
\* @requirement QUORUM-05
AllVotersReviseBeforeAdvance ==
    [][round' > round => \A v \in Voters : lastRevised[v] = round]_vars

\* PeerReviewRequired: a voter can only revise after reviewing all peers.
\* This is enforced structurally by the RevisePosition guard.
\* @requirement QUORUM-05
PeerReviewBeforeRevision ==
    [][\A v \in Voters :
        (lastRevised'[v] > lastRevised[v] /\ round > 1) =>
            reviewedPeers[v] = Voters \ {v}
    ]_vars

\* ── Specification ────────────────────────────────────────────────────────────
Spec == Init /\ [][Next]_vars

====
