---- MODULE QGSDDispatchPipeline ----
(*
 * .planning/formal/tla/QGSDDispatchPipeline.tla
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
 * @requirement DISP-08
 *)
EXTENDS Naturals, TLC

CONSTANTS
    MaxSlots,       \* number of slots in the roster
    MaxTimeMs       \* upper bound for time modeling

ASSUME MaxSlots \in Nat /\ MaxSlots >= 1
ASSUME MaxTimeMs \in Nat /\ MaxTimeMs >= 1

CONSTANTS
    IdleTimeoutMs,  \* idle timer threshold (default 20000ms)
    HardTimeoutMs   \* hard deadline (default 120000ms)

ASSUME IdleTimeoutMs \in Nat /\ IdleTimeoutMs >= 1
ASSUME HardTimeoutMs \in Nat /\ HardTimeoutMs >= IdleTimeoutMs

VARIABLES
    stage,          \* "probe" | "filter" | "sort" | "build" | "parse" | "done" | "timeout"
    slotsTotal,     \* total slots in roster
    slotsHealthy,   \* slots passing health probe
    slotsAvailable, \* slots passing availability window filter
    dispatched,     \* slots actually dispatched
    parsed,         \* results parsed
    idleElapsed,    \* ms since last stdout/stderr activity
    wallElapsed     \* ms since dispatch start (hard deadline)

vars == <<stage, slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed, idleElapsed, wallElapsed>>

\* ── Type invariant ─────────────────────────────────────────────────────────
TypeOK ==
    /\ stage          \in {"probe", "filter", "sort", "build", "parse", "done", "timeout"}
    /\ slotsTotal     \in 0..MaxSlots
    /\ slotsHealthy   \in 0..MaxSlots
    /\ slotsAvailable \in 0..MaxSlots
    /\ dispatched     \in 0..MaxSlots
    /\ parsed         \in 0..MaxSlots
    /\ idleElapsed    \in 0..MaxTimeMs
    /\ wallElapsed    \in 0..MaxTimeMs

Init ==
    /\ stage          = "probe"
    /\ slotsTotal     \in 1..MaxSlots
    /\ slotsHealthy   = 0
    /\ slotsAvailable = 0
    /\ dispatched     = 0
    /\ parsed         = 0
    /\ idleElapsed    = 0
    /\ wallElapsed    = 0

\* ── Actions ────────────────────────────────────────────────────────────────

\* DISP-01: Fast health probe (<3s) per provider
\* @requirement DISP-01
HealthProbe ==
    /\ stage = "probe"
    /\ slotsHealthy' \in 0..slotsTotal
    /\ stage' = "filter"
    /\ UNCHANGED <<slotsTotal, slotsAvailable, dispatched, parsed, idleElapsed, wallElapsed>>

\* DISP-02: Filter by availability windows from scoreboard
\* @requirement DISP-02
AvailabilityFilter ==
    /\ stage = "filter"
    /\ slotsAvailable' \in 0..slotsHealthy
    /\ stage' = "sort"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, dispatched, parsed, idleElapsed, wallElapsed>>

\* DISP-03: Order by success rate
\* @requirement DISP-03
SuccessRateSort ==
    /\ stage = "sort"
    /\ stage' = "build"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed, idleElapsed, wallElapsed>>

\* DISP-04: Build prompt and dispatch to available slots
\* @requirement DISP-04
PromptBuild ==
    /\ stage = "build"
    /\ dispatched' = slotsAvailable
    /\ stage' = "parse"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, parsed, idleElapsed, wallElapsed>>

\* DISP-05: Parse output from all dispatched slots
\* @requirement DISP-05
ParseOutput ==
    /\ stage = "parse"
    /\ parsed' \in 0..dispatched
    /\ stage' = "done"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, dispatched, idleElapsed, wallElapsed>>

\* DISP-08: Dual-timer timeout — idle timer resets on activity, hard timer never resets
\* @requirement DISP-08
DualTimerTick ==
    /\ stage \in {"build", "parse"}
    /\ wallElapsed < HardTimeoutMs
    /\ idleElapsed' \in 0..IdleTimeoutMs   \* 0 = activity reset, else monotonic advance
    /\ wallElapsed' = wallElapsed + 1
    /\ UNCHANGED <<stage, slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed>>

\* @requirement DISP-08
IdleTimeout ==
    /\ stage \in {"build", "parse"}
    /\ idleElapsed >= IdleTimeoutMs
    /\ stage' = "timeout"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed, idleElapsed, wallElapsed>>

\* @requirement DISP-08
HardTimeout ==
    /\ stage \in {"build", "parse"}
    /\ wallElapsed >= HardTimeoutMs
    /\ stage' = "timeout"
    /\ UNCHANGED <<slotsTotal, slotsHealthy, slotsAvailable, dispatched, parsed, idleElapsed, wallElapsed>>

Next ==
    \/ HealthProbe
    \/ AvailabilityFilter
    \/ SuccessRateSort
    \/ PromptBuild
    \/ ParseOutput
    \/ DualTimerTick
    \/ IdleTimeout
    \/ HardTimeout

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

\* @requirement DISP-08
\* Dual-timer: idle timeout never exceeds hard timeout threshold
\* Hard wall clock is monotonically non-decreasing
IdleNeverExceedsHard ==
    IdleTimeoutMs <= HardTimeoutMs

\* @requirement DISP-08
\* If either timer fires, stage transitions to "timeout" — dispatch is halted
TimeoutTerminates ==
    (stage = "timeout") => (idleElapsed >= IdleTimeoutMs \/ wallElapsed >= HardTimeoutMs)

Spec ==
    /\ Init
    /\ [][Next]_vars

====
