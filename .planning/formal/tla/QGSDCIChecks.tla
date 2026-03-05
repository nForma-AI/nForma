---- MODULE QGSDCIChecks ----
(*
 * .formal/tla/QGSDCIChecks.tla
 * Handwritten — models the CI verification checks pipeline.
 * Source: bin/run-formal-verify.cjs, bin/check-trace-schema-drift.cjs,
 *         bin/check-trace-redaction.cjs
 *
 * Models the ordered execution of CI check steps:
 *   schema-drift → redaction → liveness-fairness-lint
 * Each step emits a result to check-results.ndjson.
 *
 * @requirement DRIFT-01
 * @requirement DRIFT-02
 * @requirement REDACT-01
 * @requirement REDACT-02
 * @requirement REDACT-03
 * @requirement LIVE-01
 * @requirement LIVE-02
 *)
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    Checks      \* set of check names: {"drift", "redaction", "liveness"}

ASSUME Checks = {"drift", "redaction", "liveness"}

VARIABLES
    pipeline,       \* sequence of checks remaining to run
    results,        \* function: check name -> result ("pending" | "pass" | "fail" | "inconclusive")
    currentCheck,   \* current check being executed ("none" | element of Checks)
    ndjsonCount     \* number of results emitted to check-results.ndjson

vars == <<pipeline, results, currentCheck, ndjsonCount>>

\* ── Type invariant ─────────────────────────────────────────────────────────
TypeOK ==
    /\ currentCheck \in Checks \cup {"none"}
    /\ ndjsonCount  \in 0..3
    /\ \A c \in Checks : results[c] \in {"pending", "pass", "fail", "inconclusive"}

\* ── Initial state ──────────────────────────────────────────────────────────
Init ==
    /\ pipeline     = <<"drift", "redaction", "liveness">>
    /\ results      = [c \in Checks |-> "pending"]
    /\ currentCheck = "none"
    /\ ndjsonCount  = 0

\* ── Actions ────────────────────────────────────────────────────────────────

\* Start next check from pipeline
StartCheck ==
    /\ currentCheck = "none"
    /\ Len(pipeline) > 0
    /\ currentCheck' = Head(pipeline)
    /\ pipeline'     = Tail(pipeline)
    /\ UNCHANGED <<results, ndjsonCount>>

\* DRIFT-01: Schema drift check emits result
\* @requirement DRIFT-01
\* @requirement DRIFT-02
CompleteDrift ==
    /\ currentCheck = "drift"
    /\ \E r \in {"pass", "fail"} :
        /\ results'     = [results EXCEPT !["drift"] = r]
        /\ ndjsonCount' = ndjsonCount + 1
        /\ currentCheck' = "none"
    /\ UNCHANGED pipeline

\* REDACT-01/02/03: Redaction check — violations are always "fail"
\* @requirement REDACT-01
\* @requirement REDACT-02
\* @requirement REDACT-03
CompleteRedaction ==
    /\ currentCheck = "redaction"
    /\ \E r \in {"pass", "fail"} :
        /\ results'     = [results EXCEPT !["redaction"] = r]
        /\ ndjsonCount' = ndjsonCount + 1
        /\ currentCheck' = "none"
    /\ UNCHANGED pipeline

\* LIVE-01/02: Liveness fairness lint — missing fairness → inconclusive
\* @requirement LIVE-01
\* @requirement LIVE-02
CompleteLiveness ==
    /\ currentCheck = "liveness"
    /\ \E r \in {"pass", "inconclusive"} :
        /\ results'     = [results EXCEPT !["liveness"] = r]
        /\ ndjsonCount' = ndjsonCount + 1
        /\ currentCheck' = "none"
    /\ UNCHANGED pipeline

\* ── Next-state relation ────────────────────────────────────────────────────
Next ==
    \/ StartCheck
    \/ CompleteDrift
    \/ CompleteRedaction
    \/ CompleteLiveness

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement REDACT-03
\* Redaction never emits "inconclusive" — it's pass or fail only
RedactionNeverInconclusive ==
    results["redaction"] /= "inconclusive"

\* @requirement LIVE-01
\* Liveness lint never emits "fail" — only pass or inconclusive
LivenessNeverFail ==
    results["liveness"] /= "fail"

\* All emitted results match ndjson count
ResultsMatchCount ==
    ndjsonCount = Cardinality({c \in Checks : results[c] /= "pending"})

\* @requirement DRIFT-02
\* @requirement REDACT-02
\* @requirement LIVE-02
\* All checks run as steps in run-formal-verify pipeline
AllChecksEventuallyRun ==
    (Len(pipeline) = 0 /\ currentCheck = "none") =>
        \A c \in Checks : results[c] /= "pending"

\* ── Specification ──────────────────────────────────────────────────────────
Spec ==
    /\ Init
    /\ [][Next]_vars

====
