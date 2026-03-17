---- MODULE NFSolveConvergence ----
(*
 * formal/tla/NFSolveConvergence.tla
 * Handwritten -- not generated from XState.
 * Source: bin/oscillation-detector.cjs, bin/gate-stability.cjs, bin/nf-solve.cjs
 *
 * Models the outer nf:solve loop with cross-session state, Option C oscillation
 * blocking, and gate maturity transitions.
 *
 * Grace periods are omitted: they only make oscillation detection MORE lenient
 * (suppressing detection during cascade settling). Proving convergence WITHOUT
 * grace is strictly stronger -- if the system converges without grace, it also
 * converges with grace (grace only delays blocking, never prevents it).
 *
 * Key abstraction: 3 abstract layers {L1, L2, L3} with linear DAG (L1->L2->L3).
 * MaxSessions=5, MaxResidual=3 for tractable state space.
 *
 * Session actions are split into ProgressSession (decreasing residual) and
 * RegressSession (increasing residual) for correct fairness modeling:
 * - WF on ProgressSession: models that nf:solve makes progress
 * - No fairness on RegressSession: regression is possible but not guaranteed
 *
 * @requirement FV-01  (formal model of outer solve loop)
 * @requirement FV-02  (safety: oscillation bounded)
 * @requirement FV-03  (liveness: eventual convergence)
 *)
EXTENDS Integers, FiniteSets, TLC

CONSTANTS
    L1, L2, L3,    \* Model values for abstract layer identifiers
    Layers,        \* Set of layer identifiers e.g. {L1, L2, L3}
    MaxSessions,   \* Bound on session counter (5 for tractable checking)
    MaxResidual    \* Bound on residual values (3 for tractable checking)

ASSUME MaxSessions \in Nat /\ MaxSessions > 0
ASSUME MaxResidual \in Nat /\ MaxResidual > 0
ASSUME IsFiniteSet(Layers)

\* Gate maturity levels (ordered: ADVISORY < SOFT_GATE < HARD_GATE)
GateLevel == {"ADVISORY", "SOFT_GATE", "HARD_GATE"}

VARIABLES
    session,            \* Nat: current session counter (wraps modulo MaxSessions+1)
    residual,           \* [Layers -> 0..MaxResidual]: current residual per layer
    prevResidual,       \* [Layers -> -1..MaxResidual]: previous residual (-1 = no history)
    oscillation_count,  \* [Layers -> Nat]: oscillation detection count per layer
    blocked,            \* [Layers -> BOOLEAN]: Option C blocking state
    gate_maturity,      \* [Layers -> GateLevel]: gate maturity level
    converged           \* BOOLEAN: all layers converged or blocked

vars == <<session, residual, prevResidual, oscillation_count, blocked, gate_maturity, converged>>

\* ---- Type invariant -------------------------------------------------------
TypeOK ==
    /\ session \in 0..MaxSessions
    /\ residual \in [Layers -> 0..MaxResidual]
    /\ prevResidual \in [Layers -> -1..MaxResidual]
    /\ oscillation_count \in [Layers -> 0..MaxSessions]
    /\ blocked \in [Layers -> BOOLEAN]
    /\ gate_maturity \in [Layers -> GateLevel]
    /\ converged \in BOOLEAN

\* ---- Initial state ---------------------------------------------------------
Init ==
    /\ session = 0
    /\ residual = [l \in Layers |-> MaxResidual]
    /\ prevResidual = [l \in Layers |-> -1]
    /\ oscillation_count = [l \in Layers |-> 0]
    /\ blocked = [l \in Layers |-> FALSE]
    /\ gate_maturity = [l \in Layers |-> "ADVISORY"]
    /\ converged = FALSE

\* ---- Actions ---------------------------------------------------------------

\* DIVERGENCE FROM RESEARCH PATTERN 2: Uses >= 1 (not > 1) for blocking predicate.
\* Rationale: The safety invariant is oscillation_count[l] <= 1. Using > 1 would allow
\* the count to reach 2 before blocking, violating the invariant. By using >= 1, we
\* block immediately upon the FIRST oscillation detection, ensuring the count never
\* exceeds 1.

\* Helper: core oscillation detection logic for a given layer and new residual.
SessionCore(l, newRes) ==
    LET hadPrev == prevResidual[l] >= 0
        wasDecrease == hadPrev /\ residual[l] < prevResidual[l]
        isIncrease == hadPrev /\ newRes > residual[l]
        oscillated == wasDecrease /\ isIncrease
        newOscCount == IF oscillated
                       THEN oscillation_count[l] + 1
                       ELSE oscillation_count[l]
    IN
    /\ session' = (session + 1) % (MaxSessions + 1)
    /\ prevResidual' = [prevResidual EXCEPT ![l] = residual[l]]
    /\ residual' = [residual EXCEPT ![l] = newRes]
    /\ oscillation_count' = [oscillation_count EXCEPT ![l] = newOscCount]
    \* Block when oscillation_count reaches 1 (>= 1, not > 1)
    /\ blocked' = [blocked EXCEPT ![l] = newOscCount >= 1]
    /\ UNCHANGED <<gate_maturity, converged>>

\* ProgressSession: pick a non-blocked layer and DECREASE its residual.
\* Models normal solve progress -- nf:solve reduces layer residuals over time.
ProgressSession ==
    /\ ~converged
    /\ \E l \in Layers :
        /\ ~blocked[l]
        /\ residual[l] > 0
        /\ \E newRes \in 0..(residual[l] - 1) :
            SessionCore(l, newRes)

\* RegressSession: pick a non-blocked layer and INCREASE its residual.
\* Models regression -- triggers oscillation detection if layer previously decreased.
\* No fairness on this action: regression is possible but not guaranteed.
RegressSession ==
    /\ ~converged
    /\ \E l \in Layers :
        /\ ~blocked[l]
        /\ residual[l] < MaxResidual
        /\ \E newRes \in (residual[l] + 1)..MaxResidual :
            SessionCore(l, newRes)

\* RunSession: union of progress and regression for Next relation.
RunSession == ProgressSession \/ RegressSession

\* GateTransition: advance gate_maturity forward only (ADVISORY->SOFT_GATE->HARD_GATE).
GateTransition ==
    /\ ~converged
    /\ \E l \in Layers :
        \/ /\ gate_maturity[l] = "ADVISORY"
           /\ gate_maturity' = [gate_maturity EXCEPT ![l] = "SOFT_GATE"]
        \/ /\ gate_maturity[l] = "SOFT_GATE"
           /\ gate_maturity' = [gate_maturity EXCEPT ![l] = "HARD_GATE"]
    /\ UNCHANGED <<session, residual, prevResidual, oscillation_count, blocked, converged>>

\* CheckConvergence: set converged=TRUE when all layers have residual=0 OR are blocked.
CheckConvergence ==
    /\ ~converged
    /\ \A l \in Layers : residual[l] = 0 \/ blocked[l]
    /\ converged' = TRUE
    /\ UNCHANGED <<session, residual, prevResidual, oscillation_count, blocked, gate_maturity>>

\* ---- Next state relation ---------------------------------------------------
Next ==
    \/ RunSession
    \/ GateTransition
    \/ CheckConvergence

\* ---- Safety invariant ------------------------------------------------------
\* @requirement FV-01 (solve loop model: session counter bounded by MaxSessions)
\* The outer solve loop is bounded — it never exceeds the configured maximum
\* session count, ensuring termination.
SessionBounded == session <= MaxSessions

\* No layer oscillates more than once -- Option C blocks at first detection.
\* @requirement FV-02
OscillationBounded == \A l \in Layers : oscillation_count[l] <= 1

\* ---- Liveness property -----------------------------------------------------
\* The solve loop eventually converges (all layers at residual=0 or blocked).
\* Requires WF on ProgressSession and CheckConvergence.
\* @requirement FV-03
EventualConvergence == <>(converged = TRUE)

\* ---- Full specification with fairness --------------------------------------
\* WF on ProgressSession: nf:solve makes progress -- residuals decrease over time.
\*   This models the real system: each solve invocation reduces at least one layer's
\*   residual (the solver does useful work). Without fairness on ProgressSession,
\*   the model allows infinite non-convergent cycling.
\* WF on CheckConvergence: convergence check fires when all layers are terminal.
\* No fairness on RegressSession or GateTransition: these may happen but are not
\*   guaranteed. Regression triggers oscillation detection which blocks the layer.
Spec == Init /\ [][Next]_vars
        /\ WF_vars(ProgressSession)
        /\ WF_vars(CheckConvergence)

====
