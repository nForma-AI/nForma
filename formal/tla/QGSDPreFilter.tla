---- MODULE QGSDPreFilter ----
(*
 * formal/tla/QGSDPreFilter.tla
 * Handwritten — not generated from XState.
 * Source: CLAUDE.md R4 (pre-filter protocol)
 *
 * Models the R4 pre-filter protocol:
 *   - Each candidate question is evaluated by available models
 *   - If all models return CONSENSUS-READY + same answer -> auto-resolved
 *   - Otherwise -> up to 3 deliberation rounds (R4 table: "3 deliberation rounds")
 *   - After 3 rounds without consensus -> USER_NEEDED (presented to user)
 *
 * Key design: EvaluateAndResolve is atomic (SetAgreement + AutoResolve combined)
 * to prevent transient violation of AutoResolutionSound (autoResolved <=> modelAgreement).
 *
 * State vars:
 *   filterRound    -- Nat: current deliberation round (0..3)
 *   modelAgreement -- BOOLEAN: all models CONSENSUS-READY + same answer
 *   autoResolved   -- BOOLEAN: question auto-resolved (not presented to user)
 *   filterPhase    -- Protocol phase
 *)
EXTENDS Naturals, TLC

CONSTANTS
    MaxFilterRounds  \* Maximum R4 deliberation rounds (= 3)

ASSUME MaxFilterRounds \in Nat /\ MaxFilterRounds > 0

FilterPhases == {"EVALUATING", "AUTO_RESOLVED", "USER_NEEDED"}

VARIABLES filterRound, modelAgreement, autoResolved, filterPhase

vars == <<filterRound, modelAgreement, autoResolved, filterPhase>>

TypeOK ==
    /\ filterRound    \in 0..MaxFilterRounds
    /\ modelAgreement \in BOOLEAN
    /\ autoResolved   \in BOOLEAN
    /\ filterPhase    \in FilterPhases

Init ==
    /\ filterRound    = 0
    /\ modelAgreement = FALSE
    /\ autoResolved   = FALSE
    /\ filterPhase    = "EVALUATING"

(* ── Actions ────────────────────────────────────────────────────────────────── *)

(* EvaluateAndResolve(agree): atomic action combining SetAgreement + AutoResolve.
 * If agree=TRUE: auto-resolved (all models CONSENSUS-READY + same answer).
 * If agree=FALSE: no agreement — deliberation continues.
 * Atomic to preserve AutoResolutionSound across all intermediate states.
 *)
EvaluateAndResolve(agree) ==
    /\ filterPhase    = "EVALUATING"
    /\ modelAgreement' = agree
    /\ IF agree
       THEN /\ autoResolved' = TRUE
            /\ filterPhase'  = "AUTO_RESOLVED"
            /\ UNCHANGED filterRound
       ELSE /\ UNCHANGED <<autoResolved, filterPhase, filterRound>>

(* Disagree: models diverge -> run a deliberation round (requires filterPhase still EVALUATING) *)
Disagree ==
    /\ filterPhase    = "EVALUATING"
    /\ modelAgreement = FALSE
    /\ filterRound < MaxFilterRounds
    /\ filterRound'   = filterRound + 1
    /\ UNCHANGED <<modelAgreement, autoResolved, filterPhase>>

(* EscalateToUser: max rounds reached without agreement -> USER_NEEDED *)
EscalateToUser ==
    /\ filterPhase  = "EVALUATING"
    /\ filterRound >= MaxFilterRounds
    /\ modelAgreement = FALSE
    /\ filterPhase' = "USER_NEEDED"
    /\ UNCHANGED <<filterRound, modelAgreement, autoResolved>>

Next ==
    \/ \E agree \in BOOLEAN : EvaluateAndResolve(agree)
    \/ Disagree
    \/ EscalateToUser

(* ── Invariants (GAP-6) ──────────────────────────────────────────────────────── *)

(* Auto-resolution soundness: auto-resolved IFF all models agree + same answer *)
AutoResolutionSound ==
    autoResolved <=> modelAgreement

(* Pre-filter never runs more than MaxFilterRounds deliberation rounds *)
FilterRoundsBounded ==
    filterRound <= MaxFilterRounds

(* AUTO_RESOLVED implies autoResolved=TRUE and modelAgreement=TRUE *)
AutoResolvedPhaseConsistent ==
    filterPhase = "AUTO_RESOLVED" => (autoResolved = TRUE /\ modelAgreement = TRUE)

(* ── Liveness (GAP-6) ────────────────────────────────────────────────────────── *)

(* Every behavior eventually exits EVALUATING phase *)
PreFilterTerminates ==
    <>(filterPhase = "AUTO_RESOLVED" \/ filterPhase = "USER_NEEDED")

(* ── Full specification ──────────────────────────────────────────────────────── *)
Spec == Init /\ [][Next]_vars
        /\ WF_vars(\E agree \in BOOLEAN : EvaluateAndResolve(agree))
        /\ WF_vars(EscalateToUser)

====
