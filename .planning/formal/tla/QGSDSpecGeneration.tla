---- MODULE QGSDSpecGeneration ----
(*
 * .formal/tla/QGSDSpecGeneration.tla
 * Handwritten — models formal spec generation from plans and debug sessions.
 * Source: bin/generate-phase-spec.cjs, bin/propose-debug-invariants.cjs
 *
 * Models two spec generation pipelines:
 *   PHASE_SPEC = translate PLAN.md must_haves:truths to TLA+ PROPERTY stubs
 *   DEBUG_INV  = mine invariant candidates from debug session transcripts
 *
 * @requirement SPEC-04
 * @requirement LOOP-04
 *)
EXTENDS Naturals, TLC

CONSTANTS
    MaxTruths,      \* maximum truths in a PLAN.md
    MaxSessions     \* maximum debug sessions to mine

ASSUME MaxTruths >= 1
ASSUME MaxSessions >= 1

VARIABLES
    phaseSpecState,     \* "idle" | "reading" | "translating" | "done"
    truthsRead,         \* number of truths read from PLAN.md
    stubsGenerated,     \* number of TLA+ PROPERTY stubs generated
    debugMineState,     \* "idle" | "scanning" | "proposing" | "done"
    sessionsScanned,    \* number of debug sessions scanned
    invariantsProposed  \* number of invariant candidates proposed

vars == <<phaseSpecState, truthsRead, stubsGenerated, debugMineState, sessionsScanned, invariantsProposed>>

\* ── Type invariant ─────────────────────────────────────────────────────────
TypeOK ==
    /\ phaseSpecState    \in {"idle", "reading", "translating", "done"}
    /\ truthsRead        \in 0..MaxTruths
    /\ stubsGenerated    \in 0..MaxTruths
    /\ debugMineState    \in {"idle", "scanning", "proposing", "done"}
    /\ sessionsScanned   \in 0..MaxSessions
    /\ invariantsProposed \in 0..MaxSessions

\* ── Initial state ──────────────────────────────────────────────────────────
Init ==
    /\ phaseSpecState    = "idle"
    /\ truthsRead        = 0
    /\ stubsGenerated    = 0
    /\ debugMineState    = "idle"
    /\ sessionsScanned   = 0
    /\ invariantsProposed = 0

\* ── Phase spec generation ──────────────────────────────────────────────────

\* SPEC-04: Read truths from PLAN.md
\* @requirement SPEC-04
StartPhaseSpec ==
    /\ phaseSpecState = "idle"
    /\ phaseSpecState' = "reading"
    /\ UNCHANGED <<truthsRead, stubsGenerated, debugMineState, sessionsScanned, invariantsProposed>>

ReadTruth ==
    /\ phaseSpecState = "reading"
    /\ truthsRead < MaxTruths
    /\ truthsRead' = truthsRead + 1
    /\ UNCHANGED <<phaseSpecState, stubsGenerated, debugMineState, sessionsScanned, invariantsProposed>>

BeginTranslation ==
    /\ phaseSpecState = "reading"
    /\ truthsRead >= 1
    /\ phaseSpecState' = "translating"
    /\ UNCHANGED <<truthsRead, stubsGenerated, debugMineState, sessionsScanned, invariantsProposed>>

\* @requirement SPEC-04
GenerateStub ==
    /\ phaseSpecState = "translating"
    /\ stubsGenerated < truthsRead
    /\ stubsGenerated' = stubsGenerated + 1
    /\ UNCHANGED <<phaseSpecState, truthsRead, debugMineState, sessionsScanned, invariantsProposed>>

CompletePhaseSpec ==
    /\ phaseSpecState = "translating"
    /\ stubsGenerated = truthsRead
    /\ phaseSpecState' = "done"
    /\ UNCHANGED <<truthsRead, stubsGenerated, debugMineState, sessionsScanned, invariantsProposed>>

\* ── Debug invariant mining ─────────────────────────────────────────────────

\* LOOP-04: Scan debug sessions for invariant candidates
\* @requirement LOOP-04
StartDebugMine ==
    /\ debugMineState = "idle"
    /\ debugMineState' = "scanning"
    /\ UNCHANGED <<phaseSpecState, truthsRead, stubsGenerated, sessionsScanned, invariantsProposed>>

ScanSession ==
    /\ debugMineState = "scanning"
    /\ sessionsScanned < MaxSessions
    /\ sessionsScanned' = sessionsScanned + 1
    /\ UNCHANGED <<phaseSpecState, truthsRead, stubsGenerated, debugMineState, invariantsProposed>>

BeginProposing ==
    /\ debugMineState = "scanning"
    /\ sessionsScanned >= 1
    /\ debugMineState' = "proposing"
    /\ UNCHANGED <<phaseSpecState, truthsRead, stubsGenerated, sessionsScanned, invariantsProposed>>

\* @requirement LOOP-04
ProposeInvariant ==
    /\ debugMineState = "proposing"
    /\ invariantsProposed < sessionsScanned
    /\ invariantsProposed' = invariantsProposed + 1
    /\ UNCHANGED <<phaseSpecState, truthsRead, stubsGenerated, debugMineState, sessionsScanned>>

CompleteDebugMine ==
    /\ debugMineState = "proposing"
    /\ debugMineState' = "done"
    /\ UNCHANGED <<phaseSpecState, truthsRead, stubsGenerated, sessionsScanned, invariantsProposed>>

\* ── Next-state relation ────────────────────────────────────────────────────
Next ==
    \/ StartPhaseSpec
    \/ ReadTruth
    \/ BeginTranslation
    \/ GenerateStub
    \/ CompletePhaseSpec
    \/ StartDebugMine
    \/ ScanSession
    \/ BeginProposing
    \/ ProposeInvariant
    \/ CompleteDebugMine

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement SPEC-04
\* Stubs never exceed truths read
StubsBoundedByTruths ==
    stubsGenerated =< truthsRead

\* @requirement SPEC-04
\* All truths generate stubs when phase spec is done
AllTruthsCoveredWhenDone ==
    phaseSpecState = "done" => stubsGenerated = truthsRead

\* @requirement LOOP-04
\* Proposed invariants never exceed sessions scanned
InvariantsBoundedBySessions ==
    invariantsProposed =< sessionsScanned

\* ── Specification ──────────────────────────────────────────────────────────
Spec ==
    /\ Init
    /\ [][Next]_vars

====
