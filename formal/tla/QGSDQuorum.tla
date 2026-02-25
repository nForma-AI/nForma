---- MODULE QGSDQuorum ----
(* TLA+ formal specification of QGSD quorum workflow.
   State names mirror the XState machine in src/machines/qgsd-workflow.machine.ts.
   Authors: QGSD v0.12-02
*)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    Agents,          \* Set of quorum model slots (e.g., {"a1","a2","a3","a4","a5"})
    MaxDeliberation  \* Maximum deliberation rounds before forced DECIDED (e.g., 4)

ASSUME MaxDeliberation \in Nat /\ MaxDeliberation > 0

\* N = total number of agents; used for majority calculation
N == Cardinality(Agents)

\* AgentSymmetry: referenced by MCsafety.cfg as SYMMETRY AgentSymmetry.
\* SYMMETRY requires a named operator defined here — not an inline expression in the cfg.
AgentSymmetry == Permutations(Agents)

\* Model-value constants for use in cfg CONSTANTS overrides
AgentsSet5 == {"a1", "a2", "a3", "a4", "a5"}
AgentsSet3 == {"a1", "a2", "a3"}

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

\* StartQuorum: user submits a planning command — workflow leaves IDLE
StartQuorum ==
    /\ phase = "IDLE"
    /\ phase' = "COLLECTING_VOTES"
    /\ UNCHANGED <<successCount, deliberationRounds>>

\* CollectVotes(n): n APPROVE votes received from available agents
\* If majority reached → DECIDED; otherwise → DELIBERATING (round increments)
CollectVotes(n) ==
    /\ phase = "COLLECTING_VOTES"
    /\ successCount' = n
    /\ IF n * 2 >= N
       THEN /\ phase' = "DECIDED"
            /\ UNCHANGED deliberationRounds
       ELSE /\ phase' = "DELIBERATING"
            /\ deliberationRounds' = deliberationRounds + 1

\* Deliberate(n): n APPROVE votes after a deliberation round
\* Majority or exhaustion → DECIDED; otherwise → another deliberation round
Deliberate(n) ==
    /\ phase = "DELIBERATING"
    /\ successCount' = n
    /\ IF n * 2 >= N \/ deliberationRounds >= MaxDeliberation
       THEN /\ phase' = "DECIDED"
            /\ UNCHANGED deliberationRounds
       ELSE /\ phase' = "DELIBERATING"
            /\ deliberationRounds' = deliberationRounds + 1

\* Decide: forced termination when deliberation limit is exhausted
\* Enables WF_vars(Decide) liveness guarantee in Spec
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

\* ── Safety invariants (TLA-01, TLA-02) ──────────────────────────────────────

\* MinQuorumMet: if DECIDED via approval, a majority of agents approved.
\* Escalation path (deliberation exhausted) is also valid — consensus by exhaustion.
MinQuorumMet ==
    phase = "DECIDED" =>
        (successCount * 2 >= N \/ deliberationRounds >= MaxDeliberation)

\* NoInvalidTransition: IDLE can only advance to COLLECTING_VOTES — never skip states.
\* Expressed as an action property (temporal formula with primed variables).
\* Checked as PROPERTY in MCsafety.cfg (NOT INVARIANT — primed vars not valid in INVARIANT).
NoInvalidTransition ==
    [][phase = "IDLE" => phase' \in {"IDLE", "COLLECTING_VOTES"}]_vars

\* ── Liveness (TLA-03) ────────────────────────────────────────────────────────

\* EventualConsensus: every behavior eventually reaches DECIDED.
\* Checked as PROPERTY in MCliveness.cfg with WF_vars(Decide) in Spec.
EventualConsensus == <>(phase = "DECIDED")

\* ── Composite actions for fairness ──────────────────────────────────────────
\* Required for liveness: individual Deliberate(n) and CollectVotes(n) actions are not
\* directly fairness targets — we quantify over all n to get "any vote collection fires".
AnyCollectVotes == \E n \in 0..N : CollectVotes(n)
AnyDeliberate   == \E n \in 0..N : Deliberate(n)

\* ── Full specification with fairness ─────────────────────────────────────────
\* WF_vars(Decide): fires when deliberationRounds >= MaxDeliberation.
\* WF_vars(StartQuorum): ensures workflow eventually leaves IDLE.
\* WF_vars(AnyCollectVotes): ensures votes are eventually tallied from COLLECTING_VOTES.
\* WF_vars(AnyDeliberate): ensures deliberation rounds progress until MaxDeliberation,
\*   at which point WF_vars(Decide) takes over. Without this, the model stutters at
\*   deliberationRounds < MaxDeliberation and EventualConsensus cannot be proven.
Spec == Init /\ [][Next]_vars
        /\ WF_vars(Decide)
        /\ WF_vars(StartQuorum)
        /\ WF_vars(AnyCollectVotes)
        /\ WF_vars(AnyDeliberate)

====
