---- MODULE QGSDAgentLoop ----
(*
 * .formal/tla/QGSDAgentLoop.tla
 * Models the autonomous looping behavior required of QGSD subagents.
 * Source: qgsd-core/ skill agents
 *
 * @requirement AGT-01
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxIterations  \* iteration cap (default 5)

VARIABLES
    iteration,     \* Nat — current iteration count
    status,        \* {"running", "success", "cap_exhausted", "unrecoverable"}
    goalMet,       \* BOOLEAN — whether the goal is verifiably met
    pathsAvail     \* BOOLEAN — whether viable paths remain

vars == <<iteration, status, goalMet, pathsAvail>>

\* @requirement AGT-01
TypeOK ==
    /\ iteration \in 0..MaxIterations
    /\ status \in {"running", "success", "cap_exhausted", "unrecoverable"}
    /\ goalMet \in BOOLEAN
    /\ pathsAvail \in BOOLEAN

Init ==
    /\ iteration = 0
    /\ status = "running"
    /\ goalMet = FALSE
    /\ pathsAvail = TRUE

\* ── Actions ────────────────────────────────────────────────────────────────

\* Agent performs one iteration of work
\* @requirement AGT-01
DoIteration ==
    /\ status = "running"
    /\ iteration < MaxIterations
    /\ iteration' = iteration + 1
    /\ \E g \in BOOLEAN, p \in BOOLEAN :
        /\ goalMet' = g
        /\ pathsAvail' = p
        /\ IF g = TRUE THEN status' = "success"
           ELSE IF p = FALSE THEN status' = "unrecoverable"
           ELSE IF iteration + 1 = MaxIterations THEN status' = "cap_exhausted"
           ELSE status' = "running"

\* Terminal — agent has stopped
Terminal ==
    /\ status \in {"success", "cap_exhausted", "unrecoverable"}
    /\ UNCHANGED vars

Next ==
    \/ DoIteration
    \/ Terminal

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement AGT-01
\* Agent never exceeds iteration cap
NeverExceedsCap ==
    iteration <= MaxIterations

\* @requirement AGT-01
\* If goal is met, status must be success
GoalImpliesSuccess ==
    goalMet = TRUE => status = "success"

\* @requirement AGT-01
\* If no paths available and goal not met, status must be unrecoverable
NoPathsImpliesUnrecoverable ==
    (pathsAvail = FALSE /\ goalMet = FALSE /\ status # "running") =>
        status = "unrecoverable"

\* @requirement AGT-01
\* Agent never returns "run again" — modeled as: terminal states are final
\* (once terminal, stays terminal)
TerminalIsFinal ==
    status \in {"success", "cap_exhausted", "unrecoverable"} =>
        status' \in {"success", "cap_exhausted", "unrecoverable"}

\* ── Liveness ───────────────────────────────────────────────────────────────

\* @requirement AGT-01
\* Agent eventually reaches a terminal state
EventuallyTerminates ==
    <>(status \in {"success", "cap_exhausted", "unrecoverable"})

Spec ==
    /\ Init
    /\ [][Next]_vars
    /\ WF_vars(DoIteration)

====
