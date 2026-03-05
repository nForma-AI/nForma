---- MODULE QGSDDispatchPipeline ----
(*
 * .formal/tla/QGSDDispatchPipeline.tla
 * Handwritten — models the quorum dispatch pipeline in qgsd-prompt.js.
 * Source: hooks/qgsd-prompt.js (dispatch logic)
 *
 * Pipeline: HealthProbe → AvailabilityFilter → SuccessRateSort → PromptBuild → Parse
 *
 * @requirement DISP-01
 * @requirement DISP-02
 * @requirement DISP-03
 * @requirement DISP-04
 * @requirement DISP-05
 *)
EXTENDS Naturals, TLC

CONSTANTS
    MaxSlots  \* number of slots in the roster

ASSUME MaxSlots \in Nat /\ MaxSlots >= 1

VARIABLES
    stage,          \* "probe" | "filter" | "sort" | "build" | "parse" | "done"
    slotsTotal,     \* total slots in roster
    slotsHealthy,   \* slots passing health probe
    slotsAvailable, \* slots passing availability window filter
    dispatched,     \* slots actually dispatched
    parsed          \* results parsed

vars == <<stage, slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed>>

\* ── Type invariant ─────────────────────────────────────────────────────────
TypeOK ==
    /\ stage          \in {"probe", "filter", "sort", "build", "parse", "done"}
    /\ slotsTotal     \in 0..MaxSlots
    /\ slotsHealthy   \in 0..MaxSlots
    /\ slotsAvailable \in 0..MaxSlots
    /\ dispatched     \in 0..MaxSlots
    /\ parsed         \in 0..MaxSlots

Init ==
    /\ stage          = "probe"
    /\ slotsTotal     \in 1..MaxSlots
    /\ slotsHealthy   = 0
    /\ slotsAvailable = 0
    /\ dispatched     = 0
    /\ parsed         = 0

\* ── Actions ────────────────────────────────────────────────────────────────

\* DISP-01: Fast health probe (<3s) per provider
\* @requirement DISP-01
HealthProbe ==
    /\ stage = "probe"
    /\ slotsHealthy' \in 0..slotsTotal
    /\ stage' = "filter"
    /\ UNCHANGED <<slotsTotal, slotsAvailable, dispatched, parsed>>

\* DISP-02: Filter by availability windows from scoreboard
\* @requirement DISP-02
AvailabilityFilter ==
    /\ stage = "filter"
    /\ slotsAvailable' \in 0..slotsHealthy
    /\ stage' = "sort"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, dispatched, parsed>>

\* DISP-03: Order by success rate
\* @requirement DISP-03
SuccessRateSort ==
    /\ stage = "sort"
    /\ stage' = "build"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed>>

\* DISP-04: Build prompt and dispatch to available slots
\* @requirement DISP-04
PromptBuild ==
    /\ stage = "build"
    /\ dispatched' = slotsAvailable
    /\ stage' = "parse"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, parsed>>

\* DISP-05: Parse output from all dispatched slots
\* @requirement DISP-05
ParseOutput ==
    /\ stage = "parse"
    /\ parsed' \in 0..dispatched
    /\ stage' = "done"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, dispatched>>

Next ==
    \/ HealthProbe
    \/ AvailabilityFilter
    \/ SuccessRateSort
    \/ PromptBuild
    \/ ParseOutput

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement DISP-01
\* Healthy slots cannot exceed total
HealthyBounded ==
    slotsHealthy <= slotsTotal

\* @requirement DISP-02
\* Available slots cannot exceed healthy
AvailableBounded ==
    slotsAvailable <= slotsHealthy

\* Dispatched cannot exceed available
DispatchBounded ==
    dispatched <= slotsAvailable

\* Parsed cannot exceed dispatched
ParsedBounded ==
    parsed <= dispatched

\* Pipeline is monotonically narrowing
PipelineNarrowing ==
    /\ slotsHealthy   <= slotsTotal
    /\ slotsAvailable <= slotsHealthy
    /\ dispatched     <= slotsAvailable
    /\ parsed         <= dispatched

Spec ==
    /\ Init
    /\ [][Next]_vars

====
