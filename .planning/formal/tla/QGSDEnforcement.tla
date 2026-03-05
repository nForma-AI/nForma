---- MODULE QGSDEnforcement ----
(*
 * .formal/tla/QGSDEnforcement.tla
 * Handwritten — models circuit breaker enforcement in PreToolUse hook.
 * Source: hooks/qgsd-circuit-breaker.js
 *
 * @requirement ENFC-01
 * @requirement ENFC-02
 * @requirement ENFC-03
 *)
EXTENDS Naturals, TLC

VARIABLES
    breakerActive,    \* BOOLEAN — circuit breaker state file has active=TRUE
    fileSetMatch,     \* BOOLEAN — proposed tool targets oscillating file set
    decision,         \* "pending" | "block" | "allow"
    messageBuilt      \* BOOLEAN — block message constructed with instructions

vars == <<breakerActive, fileSetMatch, decision, messageBuilt>>

TypeOK ==
    /\ breakerActive \in BOOLEAN
    /\ fileSetMatch  \in BOOLEAN
    /\ decision      \in {"pending", "block", "allow"}
    /\ messageBuilt  \in BOOLEAN

Init ==
    /\ breakerActive \in BOOLEAN
    /\ fileSetMatch  \in BOOLEAN
    /\ decision      = "pending"
    /\ messageBuilt  = FALSE

\* ── Actions ────────────────────────────────────────────────────────────────

\* ENFC-01: Block when breaker active and file set matches
\* @requirement ENFC-01
BlockDecision ==
    /\ decision = "pending"
    /\ breakerActive = TRUE
    /\ fileSetMatch = TRUE
    /\ decision'     = "block"
    /\ messageBuilt' = FALSE
    /\ UNCHANGED <<breakerActive, fileSetMatch>>

\* ENFC-02/ENFC-03: Build block message with file set and RCA instructions
\* @requirement ENFC-02
\* @requirement ENFC-03
BuildBlockMessage ==
    /\ decision = "block"
    /\ messageBuilt = FALSE
    /\ messageBuilt' = TRUE
    /\ UNCHANGED <<breakerActive, fileSetMatch, decision>>

\* Allow when breaker not active or file set doesn't match
AllowDecision ==
    /\ decision = "pending"
    /\ (breakerActive = FALSE \/ fileSetMatch = FALSE)
    /\ decision'     = "allow"
    /\ messageBuilt' = FALSE
    /\ UNCHANGED <<breakerActive, fileSetMatch>>

Next ==
    \/ BlockDecision
    \/ BuildBlockMessage
    \/ AllowDecision

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement ENFC-01
\* Block requires both breaker active AND file set match
BlockRequiresBothConditions ==
    decision = "block" => (breakerActive = TRUE /\ fileSetMatch = TRUE)

\* @requirement ENFC-02
\* Block message only built after block decision
MessageAfterBlock ==
    messageBuilt = TRUE => decision = "block"

\* Allow when either condition is false
AllowWhenSafe ==
    decision = "allow" => (breakerActive = FALSE \/ fileSetMatch = FALSE)

Spec ==
    /\ Init
    /\ [][Next]_vars

====
