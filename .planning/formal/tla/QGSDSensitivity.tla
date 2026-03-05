---- MODULE QGSDSensitivity ----
(*
 * .formal/tla/QGSDSensitivity.tla
 * Handwritten — models the sensitivity sweep pipeline.
 * Source: bin/run-sensitivity-sweep.cjs, bin/sensitivity-report.cjs,
 *         qgsd-core/workflows/plan-phase.md (step 8.3)
 *
 * Models the three-phase sensitivity analysis pipeline:
 *   SWEEP   = vary parameters, run checks, record deltas
 *   INJECT  = inject SENSITIVITY_CONTEXT into quorum review
 *   REPORT  = generate human-readable ranked report
 *
 * @requirement SENS-01
 * @requirement SENS-02
 * @requirement SENS-03
 *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    Params,         \* set of parameters to sweep (e.g., {"N", "T"})
    ValuesPerParam, \* minimum number of values per parameter (>= 3)
    MaxConfigs      \* maximum total configurations to explore

ASSUME ValuesPerParam >= 3
ASSUME MaxConfigs >= 1

VARIABLES
    phase,          \* "idle" | "sweeping" | "injecting" | "reporting" | "done"
    configsTested,  \* number of configurations tested so far
    deltasRecorded, \* number of outcome deltas (pass→fail transitions) recorded
    contextInjected,\* BOOLEAN — whether SENSITIVITY_CONTEXT was injected
    reportGenerated \* BOOLEAN — whether sensitivity-report.md was generated

vars == <<phase, configsTested, deltasRecorded, contextInjected, reportGenerated>>

\* ── Type invariant ─────────────────────────────────────────────────────────
TypeOK ==
    /\ phase            \in {"idle", "sweeping", "injecting", "reporting", "done"}
    /\ configsTested    \in 0..MaxConfigs
    /\ deltasRecorded   \in 0..MaxConfigs
    /\ contextInjected  \in BOOLEAN
    /\ reportGenerated  \in BOOLEAN

\* ── Initial state ──────────────────────────────────────────────────────────
Init ==
    /\ phase            = "idle"
    /\ configsTested    = 0
    /\ deltasRecorded   = 0
    /\ contextInjected  = FALSE
    /\ reportGenerated  = FALSE

\* ── Actions ────────────────────────────────────────────────────────────────

\* SENS-01: Start sweep — vary parameters across >= 3 values each
\* @requirement SENS-01
StartSweep ==
    /\ phase = "idle"
    /\ phase'            = "sweeping"
    /\ UNCHANGED <<configsTested, deltasRecorded, contextInjected, reportGenerated>>

\* SENS-01: Test a configuration and record any delta
\* @requirement SENS-01
TestConfig ==
    /\ phase = "sweeping"
    /\ configsTested < MaxConfigs
    /\ configsTested'    = configsTested + 1
    /\ \E hasDelta \in BOOLEAN :
        deltasRecorded' = IF hasDelta THEN deltasRecorded + 1 ELSE deltasRecorded
    /\ UNCHANGED <<phase, contextInjected, reportGenerated>>

\* SENS-01: Complete sweep — minimum configs tested
\* @requirement SENS-01
CompleteSweep ==
    /\ phase = "sweeping"
    /\ configsTested >= Cardinality(Params) * ValuesPerParam
    /\ phase' = "injecting"
    /\ UNCHANGED <<configsTested, deltasRecorded, contextInjected, reportGenerated>>

\* SENS-02: Inject SENSITIVITY_CONTEXT into quorum review
\* @requirement SENS-02
InjectContext ==
    /\ phase = "injecting"
    /\ contextInjected'  = TRUE
    /\ phase'            = "reporting"
    /\ UNCHANGED <<configsTested, deltasRecorded, reportGenerated>>

\* SENS-03: Generate sensitivity-report.md
\* @requirement SENS-03
GenerateReport ==
    /\ phase = "reporting"
    /\ reportGenerated'  = TRUE
    /\ phase'            = "done"
    /\ UNCHANGED <<configsTested, deltasRecorded, contextInjected>>

\* ── Next-state relation ────────────────────────────────────────────────────
Next ==
    \/ StartSweep
    \/ TestConfig
    \/ CompleteSweep
    \/ InjectContext
    \/ GenerateReport

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement SENS-01
\* Deltas never exceed configs tested
DeltasBoundedByConfigs ==
    deltasRecorded =< configsTested

\* @requirement SENS-02
\* Context injection only after sweep completes
ContextAfterSweep ==
    contextInjected = TRUE => configsTested >= Cardinality(Params) * ValuesPerParam

\* @requirement SENS-03
\* Report generation only after context injection
ReportAfterContext ==
    reportGenerated = TRUE => contextInjected = TRUE

\* Pipeline ordering: phases progress forward only
PhaseOrdering ==
    /\ (phase = "injecting" => configsTested >= 1)
    /\ (phase = "reporting" => contextInjected = TRUE)
    /\ (phase = "done" => reportGenerated = TRUE)

\* ── Specification ──────────────────────────────────────────────────────────
Spec ==
    /\ Init
    /\ [][Next]_vars

====
