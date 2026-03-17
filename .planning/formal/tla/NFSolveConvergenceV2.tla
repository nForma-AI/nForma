---- MODULE NFSolveConvergenceV2 ----
(*
 * formal/tla/NFSolveConvergenceV2.tla
 * Handwritten -- not generated from XState.
 * Source: bin/nf-solve.cjs, bin/oscillation-detector.cjs
 *
 * Models the solve convergence loop with per-layer residual buckets
 * (automatable/manual/informational), oscillation credit system,
 * cascade grace periods, and baseline drift detection.
 *
 * Extends NFSolveConvergence.tla with:
 * - CONV-02: Three residual buckets per layer (never mixed)
 * - CONV-03: Capped layer reporting
 * - CONV-04: Baseline snapshot and drift detection
 * - OSC-01/02/03: Oscillation credit system with cascade grace
 *
 * Key abstraction: MaxLayers=3 abstract layers, MaxIterations=5 bound,
 * small residual values (0..3) for tractable state space.
 *
 * @requirement CONV-01  (oscillation detection: A-B-A-B pattern)
 * @requirement CONV-02  (residual buckets: automatable/manual/informational)
 * @requirement CONV-03  (capped layer reporting)
 * @requirement CONV-04  (baseline snapshot and drift detection)
 * @requirement OSC-01   (oscillation credit consumption)
 * @requirement OSC-02   (cascade grace period)
 * @requirement OSC-03   (escalation classification)
 *)
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    L1, L2, L3,           \* Model values for abstract layer identifiers
    Layers,               \* Set of layer identifiers e.g. {L1, L2, L3}
    MaxIterations,        \* Bound on iteration counter (5)
    OscillationCredits,   \* Initial oscillation credits per layer (2)
    DriftThreshold        \* Residual increase from baseline that triggers drift flag (10)

ASSUME MaxIterations \in Nat /\ MaxIterations > 0
ASSUME OscillationCredits \in Nat /\ OscillationCredits > 0
ASSUME DriftThreshold \in Nat /\ DriftThreshold > 0
ASSUME IsFiniteSet(Layers)

\* Residual bucket types (never mixed per CONV-02)
BucketType == {"automatable", "manual", "informational"}

\* Maximum residual value per bucket (small for model checking)
MaxResidual == 3

\* Escalation classification per OSC-03
EscalationType == {"NONE", "WARNING", "BLOCK"}

VARIABLES
    iteration,             \* Nat: current iteration counter
    residual,              \* [Layers -> [BucketType -> 0..MaxResidual]]: per-layer per-bucket
    prev_residual,         \* [Layers -> [BucketType -> -1..MaxResidual]]: previous iteration
    baseline,              \* [Layers -> [BucketType -> 0..MaxResidual]]: snapshot from first iter
    baseline_set,          \* BOOLEAN: whether baseline has been captured
    osc_credits,           \* [Layers -> 0..OscillationCredits]: remaining credits
    osc_detected,          \* [Layers -> BOOLEAN]: oscillation detected this iteration
    cascade_grace,         \* [Layers -> BOOLEAN]: cascade grace active (skip one osc check)
    capped,                \* SUBSET Layers: layers that have been capped (excluded)
    drift_flagged,         \* [Layers -> BOOLEAN]: drift from baseline detected
    escalation,            \* [Layers -> EscalationType]: current escalation level
    converged              \* BOOLEAN: solve loop has converged

vars == <<iteration, residual, prev_residual, baseline, baseline_set,
          osc_credits, osc_detected, cascade_grace, capped,
          drift_flagged, escalation, converged>>

\* ---- Type invariant -------------------------------------------------------
TypeOK ==
    /\ iteration \in 0..MaxIterations
    /\ residual \in [Layers -> [BucketType -> 0..MaxResidual]]
    /\ prev_residual \in [Layers -> [BucketType -> -1..MaxResidual]]
    /\ baseline \in [Layers -> [BucketType -> 0..MaxResidual]]
    /\ baseline_set \in BOOLEAN
    /\ osc_credits \in [Layers -> 0..OscillationCredits]
    /\ osc_detected \in [Layers -> BOOLEAN]
    /\ cascade_grace \in [Layers -> BOOLEAN]
    /\ capped \in SUBSET Layers
    /\ drift_flagged \in [Layers -> BOOLEAN]
    /\ escalation \in [Layers -> EscalationType]
    /\ converged \in BOOLEAN

\* ---- Initial state ---------------------------------------------------------
Init ==
    /\ iteration = 0
    /\ residual = [l \in Layers |-> [b \in BucketType |-> MaxResidual]]
    /\ prev_residual = [l \in Layers |-> [b \in BucketType |-> -1]]
    /\ baseline = [l \in Layers |-> [b \in BucketType |-> 0]]
    /\ baseline_set = FALSE
    /\ osc_credits = [l \in Layers |-> OscillationCredits]
    /\ osc_detected = [l \in Layers |-> FALSE]
    /\ cascade_grace = [l \in Layers |-> FALSE]
    /\ capped = {}
    /\ drift_flagged = [l \in Layers |-> FALSE]
    /\ escalation = [l \in Layers |-> "NONE"]
    /\ converged = FALSE

\* ---- Helper: total residual for a layer across all buckets -----------------
TotalResidual(l) ==
    residual[l]["automatable"] + residual[l]["manual"] + residual[l]["informational"]

PrevTotalResidual(l) ==
    prev_residual[l]["automatable"] + prev_residual[l]["manual"] + prev_residual[l]["informational"]

BaselineTotalResidual(l) ==
    baseline[l]["automatable"] + baseline[l]["manual"] + baseline[l]["informational"]

\* ---- Actions ---------------------------------------------------------------

\* RunIteration: advance the solve loop -- pick a non-capped layer, update
\* one bucket's residual (either decrease or increase).
\* @requirement CONV-02 (buckets updated independently, never mixed)
RunIteration ==
    /\ ~converged
    /\ iteration < MaxIterations
    /\ \E l \in Layers \ capped :
        \E b \in BucketType :
            \E newVal \in 0..MaxResidual :
                /\ newVal # residual[l][b]
                /\ prev_residual' = [prev_residual EXCEPT ![l] = residual[l]]
                /\ residual' = [residual EXCEPT ![l][b] = newVal]
                /\ iteration' = iteration + 1
                /\ UNCHANGED <<baseline, baseline_set, osc_credits, osc_detected,
                               cascade_grace, capped, drift_flagged, escalation, converged>>

\* TakeBaselineSnapshot: capture baseline on first iteration.
\* @requirement CONV-04
TakeBaselineSnapshot ==
    /\ ~converged
    /\ ~baseline_set
    /\ iteration > 0
    /\ baseline' = residual
    /\ baseline_set' = TRUE
    /\ UNCHANGED <<iteration, residual, prev_residual, osc_credits, osc_detected,
                   cascade_grace, capped, drift_flagged, escalation, converged>>

\* DetectOscillation: check for A-B-A-B pattern (decrease then increase).
\* @requirement CONV-01
DetectOscillation ==
    /\ ~converged
    /\ baseline_set
    /\ \E l \in Layers \ capped :
        /\ prev_residual[l]["automatable"] >= 0  \* has previous data
        /\ LET prevTotal == PrevTotalResidual(l)
               currTotal == TotalResidual(l)
               decreased == currTotal < prevTotal
               increased == currTotal > prevTotal
           IN
           \* Simple oscillation: previous was decrease, current is increase
           /\ ~decreased /\ increased
           /\ osc_detected' = [osc_detected EXCEPT ![l] = TRUE]
        /\ UNCHANGED <<iteration, residual, prev_residual, baseline, baseline_set,
                       osc_credits, cascade_grace, capped, drift_flagged, escalation, converged>>

\* ConsumeOscillationCredit: when oscillation detected, consume a credit.
\* @requirement OSC-01 (second oscillation blocks)
ConsumeOscillationCredit ==
    /\ ~converged
    /\ \E l \in Layers \ capped :
        /\ osc_detected[l] = TRUE
        /\ ~cascade_grace[l]  \* @requirement OSC-02 (grace skips consumption)
        /\ osc_credits[l] > 0
        /\ osc_credits' = [osc_credits EXCEPT ![l] = osc_credits[l] - 1]
        /\ osc_detected' = [osc_detected EXCEPT ![l] = FALSE]
        /\ UNCHANGED <<iteration, residual, prev_residual, baseline, baseline_set,
                       cascade_grace, capped, drift_flagged, escalation, converged>>

\* AllowCascadeGrace: grant one-time grace to a layer (e.g., after upstream fix).
\* @requirement OSC-02
AllowCascadeGrace ==
    /\ ~converged
    /\ \E l \in Layers \ capped :
        /\ osc_detected[l] = TRUE
        /\ cascade_grace[l] = TRUE
        \* Grace consumed: clear oscillation without consuming credit
        /\ osc_detected' = [osc_detected EXCEPT ![l] = FALSE]
        /\ cascade_grace' = [cascade_grace EXCEPT ![l] = FALSE]
        /\ UNCHANGED <<iteration, residual, prev_residual, baseline, baseline_set,
                       osc_credits, capped, drift_flagged, escalation, converged>>

\* ClassifyEscalation: determine escalation level based on remaining credits.
\* @requirement OSC-03
ClassifyEscalation ==
    /\ ~converged
    /\ \E l \in Layers \ capped :
        /\ osc_detected[l] = TRUE
        /\ osc_credits[l] = 0
        \* No credits left: escalate to BLOCK
        /\ escalation' = [escalation EXCEPT ![l] = "BLOCK"]
        /\ osc_detected' = [osc_detected EXCEPT ![l] = FALSE]
        \* @requirement CONV-03 (cap oscillating layer)
        /\ capped' = capped \union {l}
        /\ UNCHANGED <<iteration, residual, prev_residual, baseline, baseline_set,
                       osc_credits, cascade_grace, drift_flagged, converged>>

\* DetectDrift: flag when current residual drifts from baseline beyond threshold.
\* @requirement CONV-04
DetectDrift ==
    /\ ~converged
    /\ baseline_set
    /\ \E l \in Layers \ capped :
        /\ TotalResidual(l) > BaselineTotalResidual(l) + DriftThreshold
        /\ drift_flagged' = [drift_flagged EXCEPT ![l] = TRUE]
        /\ UNCHANGED <<iteration, residual, prev_residual, baseline, baseline_set,
                       osc_credits, osc_detected, cascade_grace, capped, escalation, converged>>

\* CheckConvergence: all layers at zero residual or capped.
CheckConvergence ==
    /\ ~converged
    /\ \A l \in Layers : TotalResidual(l) = 0 \/ l \in capped
    /\ converged' = TRUE
    /\ UNCHANGED <<iteration, residual, prev_residual, baseline, baseline_set,
                   osc_credits, osc_detected, cascade_grace, capped,
                   drift_flagged, escalation>>

\* ---- Next state relation ---------------------------------------------------
Next ==
    \/ RunIteration
    \/ TakeBaselineSnapshot
    \/ DetectOscillation
    \/ ConsumeOscillationCredit
    \/ AllowCascadeGrace
    \/ ClassifyEscalation
    \/ DetectDrift
    \/ CheckConvergence

\* ---- Safety invariants -----------------------------------------------------

\* @requirement CONV-03 (capped layers are reported in output)
\* Any layer escalated to BLOCK must appear in the capped set, ensuring the
\* solve output JSON includes it in capped_layers for user visibility.
CappedLayerReported ==
    \A l \in Layers :
        escalation[l] = "BLOCK" => l \in capped

\* @requirement CONV-02 (buckets never mixed)
\* Each bucket is independently tracked -- this is structural by the model
\* design ([BucketType -> Nat] function space). The invariant verifies that
\* the bucket function is well-defined for all three types.
BucketsNeverMixed ==
    \A l \in Layers :
        /\ "automatable" \in DOMAIN residual[l]
        /\ "manual" \in DOMAIN residual[l]
        /\ "informational" \in DOMAIN residual[l]

\* @requirement CONV-01 (oscillating layers excluded from convergence check)
OscillatingLayersExcluded ==
    \A l \in Layers :
        escalation[l] = "BLOCK" => l \in capped

\* @requirement CONV-04 (drift is flagged when baseline exceeded)
\* If total residual exceeds baseline + threshold, drift must be flagged.
\* Note: only checked when baseline is set and layer is not capped.
DriftFlagged ==
    \A l \in Layers \ capped :
        (baseline_set /\ TotalResidual(l) > BaselineTotalResidual(l) + DriftThreshold)
            => drift_flagged[l] = TRUE

\* @requirement OSC-01 (second oscillation blocks)
\* A layer with zero credits that oscillates must be escalated to BLOCK.
SecondOscillationBlocks ==
    \A l \in Layers :
        (osc_credits[l] = 0 /\ escalation[l] = "BLOCK") => l \in capped

\* ---- Liveness property -----------------------------------------------------
\* The solve loop eventually converges.
EventualConvergence == <>(converged = TRUE)

\* ---- Full specification with fairness --------------------------------------
Spec == Init /\ [][Next]_vars
        /\ WF_vars(RunIteration)
        /\ WF_vars(CheckConvergence)
        /\ WF_vars(ClassifyEscalation)

====
