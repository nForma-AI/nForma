---- MODULE QGSDDashboard ----
(*
 * .formal/tla/QGSDDashboard.tla
 * Handwritten — models the live health dashboard state machine.
 * Source: bin/mcp-setup-tui.cjs (dashboard screen)
 *
 * Models the dashboard lifecycle:
 *   CLOSED  = dashboard not visible
 *   OPEN    = dashboard displayed, showing slot health
 *   REFRESH = data refresh triggered by keypress
 *
 * @requirement DASH-01
 * @requirement DASH-02
 * @requirement DASH-03
 *)
EXTENDS Naturals, TLC

CONSTANTS
    MaxRefreshes    \* maximum refresh cycles to explore

ASSUME MaxRefreshes \in Nat /\ MaxRefreshes >= 1

VARIABLES
    screen,         \* "menu" | "dashboard"
    refreshCount,   \* number of refresh actions taken
    stdinClean,     \* BOOLEAN — whether stdin is in clean state (no raw mode leaks)
    lastUpdated     \* BOOLEAN — whether a timestamp is displayed

vars == <<screen, refreshCount, stdinClean, lastUpdated>>

\* ── Type invariant ─────────────────────────────────────────────────────────
TypeOK ==
    /\ screen       \in {"menu", "dashboard"}
    /\ refreshCount \in 0..MaxRefreshes
    /\ stdinClean   \in BOOLEAN
    /\ lastUpdated  \in BOOLEAN

\* ── Initial state ──────────────────────────────────────────────────────────
Init ==
    /\ screen       = "menu"
    /\ refreshCount = 0
    /\ stdinClean   = TRUE
    /\ lastUpdated  = FALSE

\* ── Actions ────────────────────────────────────────────────────────────────

\* DASH-01: Open dashboard from main menu
\* @requirement DASH-01
OpenDashboard ==
    /\ screen = "menu"
    /\ screen'       = "dashboard"
    /\ refreshCount' = 0
    /\ stdinClean'   = FALSE   \* stdin enters raw mode
    /\ lastUpdated'  = TRUE    \* initial render shows timestamp

\* DASH-02: Refresh on keypress (space/r)
\* @requirement DASH-02
RefreshDashboard ==
    /\ screen = "dashboard"
    /\ refreshCount < MaxRefreshes
    /\ screen'       = "dashboard"
    /\ refreshCount' = refreshCount + 1
    /\ stdinClean'   = FALSE
    /\ lastUpdated'  = TRUE    \* timestamp updated on each refresh

\* DASH-03: Clean exit on Q/Escape
\* @requirement DASH-03
ExitDashboard ==
    /\ screen = "dashboard"
    /\ screen'       = "menu"
    /\ refreshCount' = 0
    /\ stdinClean'   = TRUE    \* stdin fully restored
    /\ lastUpdated'  = FALSE

\* ── Next-state relation ────────────────────────────────────────────────────
Next ==
    \/ OpenDashboard
    \/ RefreshDashboard
    \/ ExitDashboard

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement DASH-02
\* Dashboard always shows timestamp when visible
TimestampWhenVisible ==
    screen = "dashboard" => lastUpdated = TRUE

\* @requirement DASH-03
\* When back at menu, stdin is always clean
StdinCleanAtMenu ==
    screen = "menu" => stdinClean = TRUE

\* @requirement DASH-01
\* Dashboard can only be reached from menu
DashboardReachable ==
    screen = "dashboard" => stdinClean = FALSE

\* ── Specification ──────────────────────────────────────────────────────────
Spec ==
    /\ Init
    /\ [][Next]_vars

====
