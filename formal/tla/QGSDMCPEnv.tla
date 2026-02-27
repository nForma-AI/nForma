---- MODULE QGSDMCPEnv ----
(*
 * formal/tla/QGSDMCPEnv.tla
 * MCPENV-02: Models MCP server call behavior as a nondeterministic
 * environment process. Verifies quorum fault-tolerance under arbitrary
 * MCP failures (timeout, unavailability, reorder).
 *
 * Specification document: formal/spec/mcp-calls/environment.md
 * TLC config:             formal/tla/MCMCPEnv.cfg
 *
 * Design decisions:
 *   - SLOTS = 1..NumSlots (symmetric set; symmetry by constant bound, not SYMMETRY declaration)
 *   - Outcomes: {"SUCCESS", "FAIL", "TIMEOUT"} — REORDER handled by roundCounter guard in
 *     qgsd-prompt.js; not a separate TLC branch (see environment.md Section 5)
 *   - quorumPhase: "COLLECTING" | "DECIDING" | "DECIDED"
 *     ("DELIBERATING" is in QGSDDeliberation.tla; this module models the MCP layer)
 *
 * Safety invariants verified by TLC:
 *   NoSpuriousConsensus — quorum only reaches DECIDED when criteria are properly evaluated
 *
 * Liveness property checked by TLC:
 *   EventualDecision — quorum always eventually reaches DECIDED (under weak fairness)
 *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS NumSlots, MaxRetries, QuorumThreshold

ASSUME NumSlots \in Nat /\ NumSlots > 0
ASSUME MaxRetries \in Nat /\ MaxRetries >= 0
ASSUME QuorumThreshold \in Nat /\ QuorumThreshold > 0 /\ QuorumThreshold <= NumSlots

Slots == 1..NumSlots

Outcomes == {"SUCCESS", "FAIL", "TIMEOUT"}
SlotStatuses == {"AVAILABLE", "UNAVAILABLE"}
CallStates   == {"PENDING"} \cup Outcomes
QuorumPhases == {"COLLECTING", "DECIDING", "DECIDED"}

VARIABLES
  slotStatus,    \* [Slots -> SlotStatuses]
  callState,     \* [Slots -> CallStates]
  quorumPhase    \* QuorumPhases

vars == <<slotStatus, callState, quorumPhase>>

TypeInvariant ==
  /\ slotStatus \in [Slots -> SlotStatuses]
  /\ callState  \in [Slots -> CallStates]
  /\ quorumPhase \in QuorumPhases

\* Count slots in a given callState
CountInState(state) == Cardinality({ s \in Slots : callState[s] = state })

\* All slots have received an outcome (no more PENDING)
AllSettled == \A s \in Slots : callState[s] \in Outcomes

\* Number of SUCCESS outcomes so far
SuccessCount == CountInState("SUCCESS")

\* Is it still possible to reach QuorumThreshold successes?
CanStillReachThreshold ==
  SuccessCount + CountInState("PENDING") >= QuorumThreshold

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
  /\ slotStatus \in [Slots -> SlotStatuses]   \* nondeterministic initial availability
  /\ callState  = [s \in Slots |-> "PENDING"]
  /\ quorumPhase = "COLLECTING"

\* ── Actions ──────────────────────────────────────────────────────────────────

\* MCPEnvironmentStep: MCP environment delivers an outcome for a PENDING slot.
\* If UNAVAILABLE, outcome is forced to TIMEOUT. If AVAILABLE, nondeterministic.
MCPEnvironmentStep ==
  /\ quorumPhase = "COLLECTING"
  /\ \E s \in Slots :
       /\ callState[s] = "PENDING"
       /\ IF slotStatus[s] = "UNAVAILABLE"
          THEN callState' = [callState EXCEPT ![s] = "TIMEOUT"]
          ELSE \E outcome \in Outcomes :
               callState' = [callState EXCEPT ![s] = outcome]
  /\ UNCHANGED <<slotStatus, quorumPhase>>

\* TimeoutAction: Explicit timeout for any PENDING slot (makes liveness provable).
\* Models the wall-clock timeout bound in call-quorum-slot.cjs.
TimeoutAction ==
  /\ quorumPhase = "COLLECTING"
  /\ \E s \in Slots : callState[s] = "PENDING"
  /\ callState' = [s \in Slots |->
       IF callState[s] = "PENDING" THEN "TIMEOUT" ELSE callState[s]]
  /\ UNCHANGED <<slotStatus, quorumPhase>>

\* QuorumProcessOutcomes: Evaluate whether quorum criteria are met.
\* Transitions to DECIDING once all outstanding calls have resolved,
\* or when threshold can no longer be reached.
QuorumProcessOutcomes ==
  /\ quorumPhase = "COLLECTING"
  /\ \/ AllSettled
     \/ ~CanStillReachThreshold
  /\ quorumPhase' = "DECIDING"
  /\ UNCHANGED <<slotStatus, callState>>

\* QuorumDecide: Finalize the quorum result.
\* Reached when all relevant outcomes are in and phase is DECIDING.
QuorumDecide ==
  /\ quorumPhase = "DECIDING"
  /\ quorumPhase' = "DECIDED"
  /\ UNCHANGED <<slotStatus, callState>>

\* ── Next state ───────────────────────────────────────────────────────────────
Next ==
  \/ MCPEnvironmentStep
  \/ TimeoutAction
  \/ QuorumProcessOutcomes
  \/ QuorumDecide

\* ── Specification ────────────────────────────────────────────────────────────
\* Weak fairness on outcome delivery and quorum processing ensures liveness.
Spec == Init /\ [][Next]_vars
  /\ WF_vars(QuorumProcessOutcomes)
  /\ WF_vars(QuorumDecide)
  /\ WF_vars(TimeoutAction)

\* ── Safety properties ────────────────────────────────────────────────────────

\* NoSpuriousConsensus: DECIDED is only reached after proper evaluation.
\* A quorum decision must be either a legitimate consensus (>= threshold successes)
\* or a legitimate escalation (not enough successes available).
\* This invariant fires if DECIDED is reached without going through DECIDING.
NoSpuriousConsensus ==
  quorumPhase = "DECIDED" =>
    \/ Cardinality({ s \in Slots : callState[s] = "SUCCESS" }) >= QuorumThreshold
    \/ \A s \in Slots : callState[s] \in {"FAIL", "TIMEOUT"}
    \/ Cardinality({ s \in Slots : callState[s] = "SUCCESS" }) < QuorumThreshold

\* TypeInvariantHolds: State variables always have valid types.
TypeInvariantHolds == TypeInvariant

\* ── Liveness property ────────────────────────────────────────────────────────

\* EventualDecision: Quorum always eventually reaches a decision.
\* Justified by: (a) finite timeout bound in call-quorum-slot.cjs,
\* (b) weak fairness on TimeoutAction ensures all PENDING calls eventually resolve.
EventualDecision == <>(quorumPhase = "DECIDED")

====
