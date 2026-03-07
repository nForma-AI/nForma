---- MODULE NFConvergence ----
(*
 * formal/tla/QGSDConvergence.tla
 * Handwritten — not generated from XState.
 * Source: hooks/qgsd-circuit-breaker.js (PostToolUse Haiku convergence check)
 *
 * Models circuit breaker state persistence invariants (GAP-5):
 *   1. resolvedAt is write-once: logWritten transitions FALSE->TRUE only once
 *   2. State file deletion only occurs after the log entry is written
 *   3. Haiku unavailability leaves both logWritten and stateDeleted unchanged
 *
 * State vars:
 *   logWritten    -- BOOLEAN: oscillation log entry has resolvedAt set (write-once)
 *   stateDeleted  -- BOOLEAN: .claude/circuit-breaker-state.json has been removed
 *   haikuVerdict  -- One of "YES", "NO", "UNAVAILABLE": Haiku convergence check result
 *)
EXTENDS Naturals, TLC

VARIABLES logWritten, stateDeleted, haikuVerdict

vars == <<logWritten, stateDeleted, haikuVerdict>>

HaikuVerdicts == {"YES", "NO", "UNAVAILABLE"}

\* ── Type invariant ───────────────────────────────────────────────────────────
\* @requirement ORES-01
TypeOK ==
    /\ logWritten   \in BOOLEAN
    /\ stateDeleted \in BOOLEAN
    /\ haikuVerdict \in HaikuVerdicts

\* ── Initial state ────────────────────────────────────────────────────────────
\* Circuit breaker has fired but Haiku check has not yet run.
\* resolvedAt is null (logWritten=FALSE), state file still exists (stateDeleted=FALSE).
Init ==
    /\ logWritten   = FALSE
    /\ stateDeleted = FALSE
    /\ haikuVerdict = "NO"

\* ── Actions ──────────────────────────────────────────────────────────────────

\* HaikuReturnsYES: Haiku confirms oscillation is resolved.
\* Sets logWritten=TRUE (write resolvedAt timestamp), then stateDeleted=TRUE.
\* Precondition: logWritten=FALSE ensures resolvedAt is set exactly once.
HaikuReturnsYES ==
    /\ logWritten = FALSE
    /\ haikuVerdict' = "YES"
    /\ logWritten'   = TRUE
    /\ stateDeleted' = TRUE

\* HaikuReturnsNO: Haiku says oscillation is not yet resolved.
\* Neither logWritten nor stateDeleted changes.
HaikuReturnsNO ==
    /\ haikuVerdict' = "NO"
    /\ UNCHANGED <<logWritten, stateDeleted>>

\* HaikuUnavailable: Haiku API call failed (quota, timeout, error).
\* No state mutation — fail-open behavior mirrors R6 in CLAUDE.md.
HaikuUnavailable ==
    /\ haikuVerdict' = "UNAVAILABLE"
    /\ UNCHANGED <<logWritten, stateDeleted>>

Next ==
    \/ HaikuReturnsYES
    \/ HaikuReturnsNO
    \/ HaikuUnavailable

\* ── Invariants (GAP-5) ───────────────────────────────────────────────────────

\* ResolvedAtWriteOnce: once logWritten is TRUE it stays TRUE forever.
\* This is a temporal (action) property — expressed as [][...]_vars.
\* @requirement ORES-03
ResolvedAtWriteOnce ==
    [][logWritten = TRUE => logWritten' = TRUE]_vars

\* LogBeforeDelete: the state file is never deleted before the log entry is written.
\* @requirement ORES-02
LogBeforeDelete ==
    stateDeleted => logWritten

\* HaikuUnavailableNoCorruption: when the system transitions TO unavailable,
\* logWritten and stateDeleted are preserved. Checks the action (next-state),
\* not the current state — so recovery from UNAVAILABLE is not blocked.
\* @requirement ORES-04
HaikuUnavailableNoCorruption ==
    [][haikuVerdict' = "UNAVAILABLE" =>
        (logWritten' = logWritten /\ stateDeleted' = stateDeleted)]_vars

\* ── Liveness ─────────────────────────────────────────────────────────────────

\* ConvergenceEventuallyResolves: every behavior eventually reaches logWritten=TRUE.
\* WF_vars(HaikuReturnsYES) ensures the YES action fires if continuously enabled.
\* @requirement ORES-05
ConvergenceEventuallyResolves == <>(logWritten = TRUE)

\* ── Full specification ────────────────────────────────────────────────────────
Spec == Init /\ [][Next]_vars
        /\ WF_vars(HaikuReturnsYES)

====
