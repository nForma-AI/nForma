---- MODULE QGSDPromptHook ----
(*
 * .formal/tla/QGSDPromptHook.tla
 * Handwritten — models the UserPromptSubmit hook pipeline.
 * Source: hooks/qgsd-prompt.js
 *
 * @requirement UPS-01
 * @requirement UPS-02
 * @requirement UPS-03
 * @requirement UPS-04
 * @requirement UPS-05
 *)
EXTENDS Naturals, TLC

CONSTANTS
    PlanningCommands,    \* set of planning command names (6 per UPS-02)
    NonPlanningCommands  \* set of non-planning commands (execute-phase, etc.)

ASSUME PlanningCommands \cap NonPlanningCommands = {}

VARIABLES
    inputCommand,    \* command detected in user prompt ("none" | element of commands)
    isPlanning,      \* BOOLEAN — detected as a planning command
    injected,        \* BOOLEAN — quorum instructions injected
    phase            \* "detecting" | "injecting" | "done"

vars == <<inputCommand, isPlanning, injected, phase>>

\* ── Type invariant ─────────────────────────────────────────────────────────
\* @requirement UPS-01
TypeOK ==
    /\ inputCommand \in PlanningCommands \cup NonPlanningCommands \cup {"none"}
    /\ isPlanning   \in BOOLEAN
    /\ injected     \in BOOLEAN
    /\ phase        \in {"detecting", "injecting", "done"}

Init ==
    /\ inputCommand = "none"
    /\ isPlanning   = FALSE
    /\ injected     = FALSE
    /\ phase        = "detecting"

\* ── Actions ────────────────────────────────────────────────────────────────

\* UPS-01: Detect planning command via allowlist regex
\* @requirement UPS-01
DetectPlanningCommand(cmd) ==
    /\ phase = "detecting"
    /\ cmd \in PlanningCommands
    /\ inputCommand' = cmd
    /\ isPlanning'   = TRUE
    /\ injected'     = FALSE
    /\ phase'        = "injecting"

\* UPS-05: Non-planning command detected — no injection
\* @requirement UPS-05
DetectNonPlanningCommand(cmd) ==
    /\ phase = "detecting"
    /\ cmd \in NonPlanningCommands
    /\ inputCommand' = cmd
    /\ isPlanning'   = FALSE
    /\ injected'     = FALSE
    /\ phase'        = "done"

\* No command detected
DetectNoCommand ==
    /\ phase = "detecting"
    /\ inputCommand' = "none"
    /\ isPlanning'   = FALSE
    /\ injected'     = FALSE
    /\ phase'        = "done"

\* UPS-03/UPS-04: Inject quorum instructions via additionalContext
\* @requirement UPS-03
\* @requirement UPS-04
InjectQuorum ==
    /\ phase = "injecting"
    /\ isPlanning = TRUE
    /\ injected'     = TRUE
    /\ phase'        = "done"
    /\ UNCHANGED <<inputCommand, isPlanning>>

Next ==
    \/ \E cmd \in PlanningCommands : DetectPlanningCommand(cmd)
    \/ \E cmd \in NonPlanningCommands : DetectNonPlanningCommand(cmd)
    \/ DetectNoCommand
    \/ InjectQuorum

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement UPS-03
\* Injection only happens for planning commands
InjectionRequiresPlanning ==
    injected = TRUE => isPlanning = TRUE

\* @requirement UPS-05
\* Non-planning commands never get injection
NonPlanningNeverInjected ==
    (inputCommand \in NonPlanningCommands) => injected = FALSE

\* @requirement UPS-02
\* Only commands from the allowlist are classified as planning
PlanningFromAllowlist ==
    isPlanning = TRUE => inputCommand \in PlanningCommands

Spec ==
    /\ Init
    /\ [][Next]_vars

====
