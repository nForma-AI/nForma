---- MODULE TUINavigation ----
(*
 * formal/tla/TUINavigation.tla
 *
 * Abstract model of the qgsd-manage.cjs TUI navigation stack.
 * Verifies four key properties of the fixed navigation flows:
 *
 *   TypeOK            — depth always in bounds; can only exit from root
 *   NoDeadlock        — from any active state, ESC is always available
 *   DepthBounded      — navigation depth stays within MaxDepth
 *   EscapeProgress    — ESC strictly reduces depth (non-root) or exits (root)
 *   EventuallyExits   — under fair ESC actions, app eventually exits
 *   MainMenuReachable — from any active non-root state, root is reachable
 *
 * Navigation hierarchy (from qgsd-manage.cjs flow audit):
 *   Depth 0: MainMenu            — ESC exits app
 *   Depth 1: top-level pickers   — ESC → return  (to main menu)
 *   Depth 2: field/key pickers   — ESC → break   (back to depth-1 loop)
 *   Depth 3: value inputs        — ESC → continue (re-show depth-2 picker)
 *
 * "Re-show" semantics (ESC at depth-3 continuing the depth-2 loop) is modelled
 * as EscapeUp (depth 3 → depth 2): the value-input screen is dismissed and
 * the field/key picker is shown again — exactly one level up.
 *
 * Fixed flows and their escape semantics verified:
 *   editAgentFlow     — slot(1) → field(2) → value(3)  [3-level, all fixed]
 *   providerKeysFlow  — action(1) → key(2) → value(3)  [3-level, all fixed]
 *   updateAgentsFlow  — choice(1) → checkbox(2)         [2-level, fixed]
 *   authFlow          — account(1) → login(2)           [2-level, pre-existing]
 *   loginAgentFlow    — slot(1)                         [1-level, pre-existing]
 *   batchRotateFlow   — slot(1) → keyInput(2)           [2-level, fixed]
 *   tuneTimeoutsFlow  — perSlotInput(1)                 [1-level, fixed]
 *   importFlow        — perKeyInput(1)                  [1-level, fixed]
 *
 * Run: node bin/run-tlc.cjs MCTUINavigation
 *)
EXTENDS Naturals, TLC

CONSTANTS MaxDepth  \* maximum navigation depth (3 for this TUI)

ASSUME MaxDepth \in Nat /\ MaxDepth >= 1

\* ─── State ─────────────────────────────────────────────────────────────────────
VARIABLES
    depth,   \* current navigation depth (0 = MainMenu root)
    exited   \* TRUE once the user pressed ESC at depth 0 (app closed)

vars == <<depth, exited>>

\* ─── Type invariant ────────────────────────────────────────────────────────────
\* @requirement TUI-01
TypeOK ==
    /\ depth  \in 0..MaxDepth
    /\ exited \in BOOLEAN
    /\ exited => depth = 0   \* exit is only reachable from root; depth stays 0

\* ─── Initial state ─────────────────────────────────────────────────────────────
Init ==
    /\ depth  = 0
    /\ exited = FALSE

\* ─── Actions ───────────────────────────────────────────────────────────────────

\* User selects an item: navigate forward (push a new screen onto the stack).
Select ==
    /\ ~exited
    /\ depth < MaxDepth
    /\ depth'  = depth + 1
    /\ exited' = FALSE

\* User presses ESC at a non-root screen: pop screen (go up one level).
\* Models both "break to outer loop" (depth-2 → depth-1) and
\* "continue inner loop" (depth-3 → depth-2, re-show picker).
EscapeUp ==
    /\ ~exited
    /\ depth > 0
    /\ depth'  = depth - 1
    /\ exited' = FALSE

\* User presses ESC at root (depth 0 = MainMenu): application exits.
EscapeExit ==
    /\ ~exited
    /\ depth = 0
    /\ depth'  = 0
    /\ exited' = TRUE

\* ─── Next-state relation ───────────────────────────────────────────────────────
Next == Select \/ EscapeUp \/ EscapeExit

\* ─── Specification ─────────────────────────────────────────────────────────────
\* No fairness assumptions on EscapeUp or EscapeExit are included here.
\* Liveness properties (EventuallyExits, MainMenuReachable) are DEFINITIONS only —
\* they require a cooperative user model (user eventually stops selecting and presses ESC).
\* The code guarantees access to ESC at every depth; it cannot force the user to take it.
\* The checked properties (TypeOK, NoDeadlock, DepthBounded, EscapeProgress) are pure
\* safety guarantees that hold without any fairness assumption.
Spec ==
    /\ Init
    /\ [][Next]_vars

\* ─── Safety invariants ─────────────────────────────────────────────────────────

\* No dead end: from any non-exited state, at least one ESC action is enabled.
\* EscapeUp v EscapeExit covers all depth values when ~exited.
\* @requirement TUI-02
NoDeadlock ==
    ~exited => (ENABLED EscapeUp \/ ENABLED EscapeExit)

\* Navigation depth is always within the declared bounds.
\* @requirement TUI-03
DepthBounded == depth \in 0..MaxDepth

\* ─── Temporal safety properties ────────────────────────────────────────────────

\* ESC at a non-root screen strictly decreases depth.
\* @requirement TUI-04
EscapeProgress == [][EscapeUp => depth' < depth]_vars

\* ─── Liveness properties ───────────────────────────────────────────────────────

\* Under fair ESC actions, the application eventually exits.
\* @requirement TUI-05
EventuallyExits == <>(exited = TRUE)

\* From any active non-root state, depth 0 (MainMenu) is eventually reached.
\* @requirement TUI-06
MainMenuReachable == (~exited /\ depth > 0) ~> (depth = 0 \/ exited)

====
