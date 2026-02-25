---- MODULE QGSDQuorum ----
(*
 * formal/tla/QGSDQuorum.tla
 * GENERATED — do not edit by hand.
 * Source of truth: src/machines/qgsd-workflow.machine.ts
 * Regenerate:      node bin/generate-formal-specs.cjs
 * Generated:       2026-02-25

 * Models the quorum workflow defined in src/machines/qgsd-workflow.machine.ts.
 * Guard translations:
 *   minQuorumMet (line ~24):           successCount >= Math.ceil(N/2)  →  n * 2 >= N
 *   noInfiniteDeliberation (line ~27):  deliberationRounds < maxDelib  →  deliberationRounds < MaxDeliberation
*)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    Agents,          \* Set of quorum model slots (e.g., {"a1","a2","a3","a4","a5"})
    MaxDeliberation  \* Maximum deliberation rounds before forced DECIDED (default: 4)

ASSUME MaxDeliberation \in Nat /\ MaxDeliberation > 0

\* N = total number of agents; used for majority calculation
N == Cardinality(Agents)

\* AgentSymmetry: referenced by MCsafety.cfg as SYMMETRY AgentSymmetry.
AgentSymmetry == Permutations(Agents)

VARIABLES
    phase,              \* One of: "IDLE", "COLLECTING_VOTES", "DELIBERATING", "DECIDED"
    successCount,       \* Number of APPROVE votes collected in current round
    deliberationRounds  \* Number of deliberation rounds completed

vars == <<phase, successCount, deliberationRounds>>

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ phase \in {"IDLE", "COLLECTING_VOTES", "DELIBERATING", "DECIDED"}
    /\ successCount \in 0..N
    /\ deliberationRounds \in 0..MaxDeliberation

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ phase              = "IDLE"
    /\ successCount       = 0
    /\ deliberationRounds = 0

\* ── Actions ──────────────────────────────────────────────────────────────────

\* StartQuorum: workflow leaves IDLE → COLLECTING_VOTES
StartQuorum ==
    /\ phase = "IDLE"
    /\ phase' = "COLLECTING_VOTES"
    /\ UNCHANGED <<successCount, deliberationRounds>>

\* CollectVotes(n): n APPROVE votes received from available agents.
\* minQuorumMet (n * 2 >= N) → DECIDED; otherwise → DELIBERATING.
CollectVotes(n) ==
    /\ phase = "COLLECTING_VOTES"
    /\ successCount' = n
    /\ IF n * 2 >= N
       THEN /\ phase' = "DECIDED"
            /\ UNCHANGED deliberationRounds
       ELSE /\ phase' = "DELIBERATING"
            /\ deliberationRounds' = deliberationRounds + 1

\* Deliberate(n): n APPROVE votes after a deliberation round.
\* Majority or exhaustion (deliberationRounds >= MaxDeliberation) → DECIDED.
Deliberate(n) ==
    /\ phase = "DELIBERATING"
    /\ successCount' = n
    /\ IF n * 2 >= N \/ deliberationRounds >= MaxDeliberation
       THEN /\ phase' = "DECIDED"
            /\ UNCHANGED deliberationRounds
       ELSE /\ phase' = "DELIBERATING"
            /\ deliberationRounds' = deliberationRounds + 1

\* Decide: forced termination when deliberation limit is exhausted.
Decide ==
    /\ phase = "DELIBERATING"
    /\ deliberationRounds >= MaxDeliberation
    /\ phase' = "DECIDED"
    /\ UNCHANGED <<successCount, deliberationRounds>>

Next ==
    \/ StartQuorum
    \/ \E n \in 0..N : CollectVotes(n)
    \/ \E n \in 0..N : Deliberate(n)
    \/ Decide

\* ── Safety invariants ────────────────────────────────────────────────────────

\* MinQuorumMet: if DECIDED via approval, a majority of agents approved.
MinQuorumMet ==
    phase = "DECIDED" =>
        (successCount * 2 >= N \/ deliberationRounds >= MaxDeliberation)

\* NoInvalidTransition: IDLE can only advance to COLLECTING_VOTES.
NoInvalidTransition ==
    [][phase = "IDLE" => phase' \in {"IDLE", "COLLECTING_VOTES"}]_vars

\* ── Liveness ─────────────────────────────────────────────────────────────────

\* EventualConsensus: every behavior eventually reaches DECIDED.
EventualConsensus == <>(phase = "DECIDED")

\* ── Composite actions for fairness ──────────────────────────────────────────
AnyCollectVotes == \E n \in 0..N : CollectVotes(n)
AnyDeliberate   == \E n \in 0..N : Deliberate(n)

\* ── Full specification with fairness ────────────────────────────────────────
Spec == Init /\ [][Next]_vars
        /\ WF_vars(Decide)
        /\ WF_vars(StartQuorum)
        /\ WF_vars(AnyCollectVotes)
        /\ WF_vars(AnyDeliberate)

====
