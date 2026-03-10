---- MODULE NFSolveConvergence ----
(*
 * formal/tla/NFSolveConvergence.tla
 * Handwritten -- not generated from XState.
 * Source: bin/oscillation-detector.cjs, bin/gate-stability.cjs, bin/nf-solve.cjs
 *
 * Models the outer nf:solve loop with cross-session state, Option C oscillation
 * blocking, gate maturity transitions, and cascade-aware grace periods.
 *
 * Key abstraction: 3 abstract layers {L1, L2, L3} with linear DAG (L1->L2->L3).
 * MaxSessions=5, MaxResidual=3 for tractable state space.
 *
 * @requirement FV-01  (formal model of outer solve loop)
 * @requirement FV-02  (safety: oscillation bounded)
 * @requirement FV-03  (liveness: eventual convergence)
 *)
EXTENDS Integers, FiniteSets

CONSTANTS
    Layers,        \* Abstract layer identifiers e.g. {L1, L2, L3}
    DownstreamOf,  \* Function: layer -> set of its UPSTREAM dependencies
                   \* e.g. (L1 :> {} @@ L2 :> {L1} @@ L3 :> {L2})
                   \* NOTE: DownstreamOf[m] gives the layers that m DEPENDS ON (upstream).
                   \* To find layers DOWNSTREAM of layer l, iterate all m where l \in DownstreamOf[m].
    MaxSessions,   \* Bound on session counter (5 for tractable checking)
    MaxResidual    \* Bound on residual values (3 for tractable checking)

ASSUME MaxSessions \in Nat /\ MaxSessions > 0
ASSUME MaxResidual \in Nat /\ MaxResidual > 0
ASSUME IsFiniteSet(Layers)

\* Gate maturity levels (ordered: ADVISORY < SOFT_GATE < HARD_GATE)
GateLevel == {"ADVISORY", "SOFT_GATE", "HARD_GATE"}

VARIABLES
    session,            \* Nat: current session counter
    residual,           \* [Layers -> 0..MaxResidual]: current residual per layer
    prevResidual,       \* [Layers -> -1..MaxResidual]: previous residual (-1 = no history)
    oscillation_count,  \* [Layers -> Nat]: oscillation detection count per layer
    blocked,            \* [Layers -> BOOLEAN]: Option C blocking state
    gate_maturity,      \* [Layers -> GateLevel]: gate maturity level
    converged,          \* BOOLEAN: all layers converged or blocked
    graceActive         \* [Layers -> BOOLEAN]: cascade grace period active

vars == <<session, residual, prevResidual, oscillation_count, blocked, gate_maturity, converged, graceActive>>

\* ---- Type invariant -------------------------------------------------------
TypeOK ==
    /\ session \in 0..MaxSessions
    /\ residual \in [Layers -> 0..MaxResidual]
    /\ prevResidual \in [Layers -> -1..MaxResidual]
    /\ oscillation_count \in [Layers -> 0..MaxSessions]
    /\ blocked \in [Layers -> BOOLEAN]
    /\ gate_maturity \in [Layers -> GateLevel]
    /\ converged \in BOOLEAN
    /\ graceActive \in [Layers -> BOOLEAN]

\* ---- Initial state ---------------------------------------------------------
Init ==
    /\ session = 0
    /\ residual = [l \in Layers |-> MaxResidual]
    /\ prevResidual = [l \in Layers |-> -1]
    /\ oscillation_count = [l \in Layers |-> 0]
    /\ blocked = [l \in Layers |-> FALSE]
    /\ gate_maturity = [l \in Layers |-> "ADVISORY"]
    /\ converged = FALSE
    /\ graceActive = [l \in Layers |-> FALSE]

\* ---- Helper: layers downstream of a given layer ---------------------------
\* To find layers DOWNSTREAM of improving layer l, we find all m where
\* l is in DownstreamOf[m] (i.e., m depends on l, so m is downstream of l).
\* This is the CORRECT direction -- do NOT use DownstreamOf[l] which gives
\* upstream dependencies of l.
DownstreamLayers(l) == {m \in Layers : l \in DownstreamOf[m]}

\* ---- Actions ---------------------------------------------------------------

\* RunSession: non-deterministically pick a non-blocked layer and assign new residual.
\* Detects oscillation (increase after decrease) when no grace period active.
\* DIVERGENCE FROM RESEARCH PATTERN 2: Uses >= 1 (not > 1) for blocking predicate.
\* Rationale: The safety invariant is oscillation_count[l] <= 1. Using > 1 would allow
\* the count to reach 2 before blocking, violating the invariant. By using >= 1, we
\* block immediately upon the FIRST oscillation detection, ensuring the count never
\* exceeds 1.
RunSession ==
    /\ session < MaxSessions
    /\ ~converged
    /\ \E l \in Layers :
        /\ ~blocked[l]
        /\ \E newRes \in 0..MaxResidual :
            LET hadPrev == prevResidual[l] >= 0
                wasDecrease == hadPrev /\ residual[l] < prevResidual[l]
                isIncrease == hadPrev /\ newRes > residual[l]
                oscillated == wasDecrease /\ isIncrease /\ ~graceActive[l]
                newOscCount == IF oscillated
                               THEN oscillation_count[l] + 1
                               ELSE oscillation_count[l]
            IN
            /\ session' = session + 1
            /\ prevResidual' = [prevResidual EXCEPT ![l] = residual[l]]
            /\ residual' = [residual EXCEPT ![l] = newRes]
            /\ oscillation_count' = [oscillation_count EXCEPT ![l] = newOscCount]
            \* Block when oscillation_count reaches 1 (>= 1, not > 1)
            /\ blocked' = [blocked EXCEPT ![l] = newOscCount >= 1]
            /\ UNCHANGED <<gate_maturity, converged, graceActive>>

\* ActivateGrace: when a layer's residual decreases (improvement), activate
\* grace period on all layers DOWNSTREAM of the improving layer.
\* See DownstreamLayers helper for direction clarification.
ActivateGrace ==
    /\ ~converged
    /\ \E l \in Layers :
        /\ prevResidual[l] >= 0
        /\ residual[l] < prevResidual[l]  \* l improved
        /\ LET downstream == DownstreamLayers(l)
           IN
           /\ downstream # {}
           /\ graceActive' = [m \in Layers |->
                IF m \in downstream THEN TRUE ELSE graceActive[m]]
           /\ UNCHANGED <<session, residual, prevResidual, oscillation_count, blocked, gate_maturity, converged>>

\* DeactivateGrace: non-deterministically deactivate grace period on any layer.
\* Models grace expiry after cascade effects settle.
DeactivateGrace ==
    /\ ~converged
    /\ \E l \in Layers :
        /\ graceActive[l]
        /\ graceActive' = [graceActive EXCEPT ![l] = FALSE]
        /\ UNCHANGED <<session, residual, prevResidual, oscillation_count, blocked, gate_maturity, converged>>

\* GateTransition: advance gate_maturity forward only (ADVISORY->SOFT_GATE->HARD_GATE).
GateTransition ==
    /\ ~converged
    /\ \E l \in Layers :
        \/ /\ gate_maturity[l] = "ADVISORY"
           /\ gate_maturity' = [gate_maturity EXCEPT ![l] = "SOFT_GATE"]
        \/ /\ gate_maturity[l] = "SOFT_GATE"
           /\ gate_maturity' = [gate_maturity EXCEPT ![l] = "HARD_GATE"]
    /\ UNCHANGED <<session, residual, prevResidual, oscillation_count, blocked, converged, graceActive>>

\* CheckConvergence: set converged=TRUE when all layers have residual=0 OR are blocked.
CheckConvergence ==
    /\ ~converged
    /\ \A l \in Layers : residual[l] = 0 \/ blocked[l]
    /\ converged' = TRUE
    /\ UNCHANGED <<session, residual, prevResidual, oscillation_count, blocked, gate_maturity, graceActive>>

\* ---- Next state relation ---------------------------------------------------
Next ==
    \/ RunSession
    \/ ActivateGrace
    \/ DeactivateGrace
    \/ GateTransition
    \/ CheckConvergence

\* ---- Safety invariant ------------------------------------------------------
\* No layer oscillates more than once -- Option C blocks at first detection.
\* @requirement FV-02
OscillationBounded == \A l \in Layers : oscillation_count[l] <= 1

\* ---- Liveness property -----------------------------------------------------
\* The solve loop eventually converges (all layers at residual=0 or blocked).
\* Requires weak fairness on RunSession (sessions keep happening) and
\* CheckConvergence (convergence check fires when enabled).
\* @requirement FV-03
EventualConvergence == <>(converged = TRUE)

\* ---- Full specification with fairness --------------------------------------
Spec == Init /\ [][Next]_vars
        /\ WF_vars(RunSession)
        /\ WF_vars(CheckConvergence)

====
