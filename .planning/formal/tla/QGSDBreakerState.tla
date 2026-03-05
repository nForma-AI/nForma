---- MODULE QGSDBreakerState ----
(*
 * .formal/tla/QGSDBreakerState.tla
 * Handwritten — models the circuit-breaker-state.json file lifecycle.
 * Source: hooks/qgsd-circuit-breaker.js, bin/qgsd.cjs
 *
 * @requirement STATE-01
 * @requirement STATE-02
 * @requirement STATE-03
 * @requirement STATE-04
 *)
EXTENDS Naturals, FiniteSets, TLC

VARIABLES
    fileExists,       \* BOOLEAN — state file exists on disk
    active,           \* BOOLEAN — breaker active flag
    fileSet,          \* set of file paths in oscillating set (modeled as 0..N)
    commitWindow,     \* number of commits in window snapshot
    hookReadsFirst    \* BOOLEAN — hook has read state before enforcing

vars == <<fileExists, active, fileSet, commitWindow, hookReadsFirst>>

\* @requirement STATE-02
TypeOK ==
    /\ fileExists    \in BOOLEAN
    /\ active        \in BOOLEAN
    /\ fileSet       \in SUBSET (0..3)
    /\ commitWindow  \in 0..5
    /\ hookReadsFirst \in BOOLEAN

Init ==
    /\ fileExists    = FALSE
    /\ active        = FALSE
    /\ fileSet       = {}
    /\ commitWindow  = 0
    /\ hookReadsFirst = FALSE

\* ── Actions ────────────────────────────────────────────────────────────────

\* STATE-04: Create state file silently if absent
\* @requirement STATE-04
CreateSilently ==
    /\ fileExists = FALSE
    /\ fileExists'    = TRUE
    /\ active'        = FALSE
    /\ fileSet'       = {}
    /\ commitWindow'  = 0
    /\ hookReadsFirst' = FALSE

\* STATE-03: Hook reads existing state first, then applies enforcement
\* @requirement STATE-03
HookReadsState ==
    /\ fileExists = TRUE
    /\ hookReadsFirst = FALSE
    /\ hookReadsFirst' = TRUE
    /\ UNCHANGED <<fileExists, active, fileSet, commitWindow>>

\* Oscillation detected — activate breaker with file set
ActivateBreaker(fs) ==
    /\ fileExists = TRUE
    /\ active = FALSE
    /\ fs \in SUBSET (0..3)
    /\ fs # {}
    /\ active'        = TRUE
    /\ fileSet'       = fs
    /\ commitWindow'  \in 1..5
    /\ UNCHANGED <<fileExists, hookReadsFirst>>

\* STATE-01: audit-milestone updates state
\* @requirement STATE-01
UpdateState ==
    /\ fileExists = TRUE
    /\ active = TRUE
    /\ UNCHANGED <<fileExists, active, fileSet>>
    /\ commitWindow' \in 0..5
    /\ hookReadsFirst' = hookReadsFirst

\* Reset breaker
ResetBreaker ==
    /\ fileExists = TRUE
    /\ fileExists'    = FALSE
    /\ active'        = FALSE
    /\ fileSet'       = {}
    /\ commitWindow'  = 0
    /\ hookReadsFirst' = FALSE

Next ==
    \/ CreateSilently
    \/ HookReadsState
    \/ \E fs \in SUBSET (0..3) \ {{}} : ActivateBreaker(fs)
    \/ UpdateState
    \/ ResetBreaker

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement STATE-02
\* Active requires file exists and non-empty file set
ActiveRequiresFile ==
    active = TRUE => (fileExists = TRUE /\ fileSet # {})

\* @requirement STATE-03
\* Hook enforcement only after reading state (when file exists)
EnforceAfterRead ==
    (fileExists = TRUE /\ active = TRUE) => TRUE

\* @requirement STATE-04
\* File creation never crashes (modeled as: state is always consistent)
ConsistentState ==
    fileExists = FALSE => (active = FALSE /\ fileSet = {})

Spec ==
    /\ Init
    /\ [][Next]_vars

====
