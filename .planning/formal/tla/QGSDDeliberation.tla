---- MODULE QGSDDeliberation ----
(*
 * formal/tla/QGSDDeliberation.tla
 * Handwritten — not generated from XState.
 * Source: CLAUDE.md R3 (deliberation loop) and R3.6 (improvement iteration loop)
 *
 * Models the R3 quorum deliberation protocol:
 *   - R3.3: BLOCK triggers deliberation; up to 10 rounds
 *   - R3.6: APPROVE+improvement triggers iteration; up to 10 iterations
 *   - Combined bound: deliberationRound + improvementIteration <= 20
 *   - Regression: APPROVE->BLOCK during R3.6 resumes deliberation without counter reset
 *   - Escalation: deliberationRound >= MaxDeliberationRounds => ESCALATED
 *
 * State vars:
 *   deliberationRound    -- Nat: R3.3 deliberation rounds (0..10)
 *   improvementIteration -- Nat: R3.6 improvement iterations (0..10)
 *   voteState            -- Protocol phase
 *)
EXTENDS Naturals, TLC

CONSTANTS
    MaxDeliberationRounds,    \* Maximum R3.3 deliberation rounds (= 10)
    MaxImprovementIterations  \* Maximum R3.6 improvement iterations (= 10)

ASSUME MaxDeliberationRounds \in Nat /\ MaxDeliberationRounds > 0
ASSUME MaxImprovementIterations \in Nat /\ MaxImprovementIterations > 0

VoteStates == {"COLLECTING", "BLOCKING", "IMPROVING", "CONSENSUS", "ESCALATED"}

VARIABLES deliberationRound, improvementIteration, voteState

vars == <<deliberationRound, improvementIteration, voteState>>

\* @requirement PLAN-01
TypeOK ==
    /\ deliberationRound    \in 0..MaxDeliberationRounds
    /\ improvementIteration \in 0..MaxImprovementIterations
    /\ voteState            \in VoteStates

Init ==
    /\ deliberationRound    = 0
    /\ improvementIteration = 0
    /\ voteState            = "COLLECTING"

(* ── Actions ────────────────────────────────────────────────────────────────── *)

(* ReceiveApprove: all available models APPROVE with no improvements -> CONSENSUS *)
ReceiveApprove ==
    /\ voteState \in {"COLLECTING", "BLOCKING"}
    /\ voteState' = "CONSENSUS"
    /\ UNCHANGED <<deliberationRound, improvementIteration>>

(* ReceiveBlock: any model BLOCKs -> BLOCKING; advance deliberation round *)
ReceiveBlock ==
    /\ voteState \in {"COLLECTING", "BLOCKING"}
    /\ deliberationRound < MaxDeliberationRounds
    /\ deliberationRound' = deliberationRound + 1
    /\ voteState'         = "BLOCKING"
    /\ UNCHANGED improvementIteration

(* ReceiveApproveWithImprovement: all APPROVE but some propose improvements -> IMPROVING *)
ReceiveApproveWithImprovement ==
    /\ voteState \in {"COLLECTING", "BLOCKING"}
    /\ improvementIteration < MaxImprovementIterations
    /\ improvementIteration' = improvementIteration + 1
    /\ voteState'            = "IMPROVING"
    /\ UNCHANGED deliberationRound

(* ImprovementAccepted: next round after improvement -- no new blocks or improvements *)
ImprovementAccepted ==
    /\ voteState = "IMPROVING"
    /\ voteState' = "CONSENSUS"
    /\ UNCHANGED <<deliberationRound, improvementIteration>>

(* ImprovementRegression: APPROVE->BLOCK during R3.6 -- resume deliberation without reset *)
ImprovementRegression ==
    /\ voteState = "IMPROVING"
    /\ deliberationRound < MaxDeliberationRounds
    /\ deliberationRound' = deliberationRound + 1
    /\ voteState'         = "BLOCKING"
    /\ UNCHANGED improvementIteration

(* Escalate: deliberation round cap exhausted -> ESCALATED *)
Escalate ==
    /\ voteState = "BLOCKING"
    /\ deliberationRound >= MaxDeliberationRounds
    /\ voteState' = "ESCALATED"
    /\ UNCHANGED <<deliberationRound, improvementIteration>>

Next ==
    \/ ReceiveApprove
    \/ ReceiveBlock
    \/ ReceiveApproveWithImprovement
    \/ ImprovementAccepted
    \/ ImprovementRegression
    \/ Escalate

(* ── Invariants (GAP-2) ──────────────────────────────────────────────────────── *)

(* Combined round bound: deliberationRound + improvementIteration <= 20 *)
\* @requirement LOOP-02
TotalRoundsBounded ==
    deliberationRound + improvementIteration <= MaxDeliberationRounds + MaxImprovementIterations

(* Deliberation counter is monotonically non-decreasing *)
\* @requirement SAFE-03
DeliberationMonotone ==
    [][deliberationRound' >= deliberationRound]_vars

(* Improvement counter is monotonically non-decreasing *)
\* @requirement IMPR-01
ImprovementMonotone ==
    [][improvementIteration' >= improvementIteration]_vars

(* ── Liveness (GAP-2) ────────────────────────────────────────────────────────── *)

(* Every behavior eventually reaches CONSENSUS or ESCALATED *)
\* @requirement PLAN-02
ProtocolTerminates ==
    <>(voteState = "CONSENSUS" \/ voteState = "ESCALATED")

(* ── Full specification ──────────────────────────────────────────────────────── *)
Spec == Init /\ [][Next]_vars
        /\ WF_vars(Escalate)
        /\ WF_vars(ReceiveApprove)
        /\ WF_vars(ImprovementAccepted)

====
