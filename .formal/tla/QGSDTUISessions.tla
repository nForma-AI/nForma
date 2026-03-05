---- MODULE QGSDTUISessions ----
(*
 * .formal/tla/QGSDTUISessions.tla
 * Handwritten — models the TUI Sessions module lifecycle.
 * Sessions can be created, connected, and terminated with full focus management.
 * Source: .planning/quick/156-add-sessions-module-to-nforma-with-bless/156-PLAN.md
 *
 * @requirement NAV-02
 *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    MaxSessions     \* max concurrent sessions (small bound for TLC)

VARIABLES
    sessions,       \* set of session IDs that exist (subset of 1..MaxSessions)
    connected,      \* set of session IDs currently connected
    focused,        \* currently focused session (0 = none)
    moduleActive    \* BOOLEAN — whether Sessions module has focus in TUI

vars == <<sessions, connected, focused, moduleActive>>

\* @requirement NAV-02
TypeOK ==
    /\ sessions   \in SUBSET (1..MaxSessions)
    /\ connected  \in SUBSET sessions
    /\ focused    \in 0..MaxSessions
    /\ (focused # 0 => focused \in connected)
    /\ moduleActive \in BOOLEAN

Init ==
    /\ sessions   = {}
    /\ connected  = {}
    /\ focused    = 0
    /\ moduleActive = FALSE

\* ── Actions ────────────────────────────────────────────────────────────────

\* NAV-02: Create a new session
\* @requirement NAV-02
CreateSession(s) ==
    /\ s \notin sessions
    /\ Cardinality(sessions) < MaxSessions
    /\ sessions' = sessions \cup {s}
    /\ UNCHANGED <<connected, focused, moduleActive>>

\* NAV-02: Connect to an existing session (PTY-backed)
\* @requirement NAV-02
ConnectSession(s) ==
    /\ s \in sessions
    /\ s \notin connected
    /\ connected' = connected \cup {s}
    /\ focused' = s
    /\ moduleActive' = TRUE
    /\ UNCHANGED <<sessions>>

\* NAV-02: Disconnect from a session (without terminating)
DisconnectSession(s) ==
    /\ s \in connected
    /\ connected' = connected \ {s}
    /\ focused' = IF focused = s THEN 0 ELSE focused
    /\ UNCHANGED <<sessions, moduleActive>>

\* NAV-02: Terminate a session (removes it entirely)
\* @requirement NAV-02
TerminateSession(s) ==
    /\ s \in sessions
    /\ sessions' = sessions \ {s}
    /\ connected' = connected \ {s}
    /\ focused' = IF focused = s THEN 0 ELSE focused
    /\ UNCHANGED <<moduleActive>>

\* NAV-02: Switch focus to another connected session
SwitchFocus(s) ==
    /\ s \in connected
    /\ s # focused
    /\ focused' = s
    /\ UNCHANGED <<sessions, connected, moduleActive>>

\* Module switching: activate/deactivate Sessions module
ActivateModule ==
    /\ moduleActive = FALSE
    /\ moduleActive' = TRUE
    /\ UNCHANGED <<sessions, connected, focused>>

DeactivateModule ==
    /\ moduleActive = TRUE
    /\ moduleActive' = FALSE
    /\ UNCHANGED <<sessions, connected, focused>>

\* ── Spec ──────────────────────────────────────────────────────────────────

Next ==
    \/ \E s \in 1..MaxSessions :
        \/ CreateSession(s)
        \/ ConnectSession(s)
        \/ DisconnectSession(s)
        \/ TerminateSession(s)
        \/ SwitchFocus(s)
    \/ ActivateModule
    \/ DeactivateModule

Spec == Init /\ [][Next]_vars

\* ── Safety Invariants ────────────────────────────────────────────────────

\* Connected sessions must exist
ConnectedImpliesExists ==
    connected \subseteq sessions

\* Focused session must be connected (or none)
FocusedImpliesConnected ==
    focused # 0 => focused \in connected

\* Cannot exceed max sessions
BoundedSessions ==
    Cardinality(sessions) =< MaxSessions

====
