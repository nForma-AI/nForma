---- MODULE QGSDTUIModules ----
(*
 * .formal/tla/QGSDTUIModules.tla
 * Models the TUI activity bar module navigation.
 * Source: src/tui/ components
 *
 * @requirement NAV-01
 *)
EXTENDS Naturals, FiniteSets, TLC

VARIABLES
    activeModule,    \* {"Agents", "Requirements", "Config"}
    menuItems,       \* set of items currently displayed
    lastInput        \* {"F1", "F2", "F3", "Tab", "ShiftTab", "none"}

vars == <<activeModule, menuItems, lastInput>>

Modules == {"Agents", "Requirements", "Config"}

\* Each module has its own set of menu items (modeled as abstract IDs)
AgentItems == {"agent_1", "agent_2", "agent_3"}
RequirementsItems == {"req_1", "req_2", "req_3"}
ConfigItems == {"config_1", "config_2", "config_3"}

ItemsForModule(m) ==
    CASE m = "Agents" -> AgentItems
      [] m = "Requirements" -> RequirementsItems
      [] m = "Config" -> ConfigItems

\* @requirement NAV-01
TypeOK ==
    /\ activeModule \in Modules
    /\ menuItems \subseteq (AgentItems \cup RequirementsItems \cup ConfigItems)
    /\ lastInput \in {"F1", "F2", "F3", "Tab", "ShiftTab", "none"}

Init ==
    /\ activeModule = "Agents"
    /\ menuItems = AgentItems
    /\ lastInput = "none"

\* ── Actions ────────────────────────────────────────────────────────────────

\* @requirement NAV-01
\* Direct hotkey switch: F1→Agents, F2→Requirements, F3→Config
HotkeySwitch(key, target) ==
    /\ activeModule' = target
    /\ menuItems' = ItemsForModule(target)
    /\ lastInput' = key

\* @requirement NAV-01
\* Tab cycling: Agents → Requirements → Config → Agents
TabForward ==
    /\ lastInput' = "Tab"
    /\ CASE activeModule = "Agents" ->
              /\ activeModule' = "Requirements"
              /\ menuItems' = RequirementsItems
         [] activeModule = "Requirements" ->
              /\ activeModule' = "Config"
              /\ menuItems' = ConfigItems
         [] activeModule = "Config" ->
              /\ activeModule' = "Agents"
              /\ menuItems' = AgentItems

\* @requirement NAV-01
\* Shift+Tab: reverse cycle
TabBackward ==
    /\ lastInput' = "ShiftTab"
    /\ CASE activeModule = "Agents" ->
              /\ activeModule' = "Config"
              /\ menuItems' = ConfigItems
         [] activeModule = "Requirements" ->
              /\ activeModule' = "Agents"
              /\ menuItems' = AgentItems
         [] activeModule = "Config" ->
              /\ activeModule' = "Requirements"
              /\ menuItems' = RequirementsItems

Next ==
    \/ HotkeySwitch("F1", "Agents")
    \/ HotkeySwitch("F2", "Requirements")
    \/ HotkeySwitch("F3", "Config")
    \/ TabForward
    \/ TabBackward

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement NAV-01
\* Only module-relevant items are displayed
OnlyRelevantItems ==
    menuItems = ItemsForModule(activeModule)

\* @requirement NAV-01
\* Exactly 3 modules exist
ExactlyThreeModules ==
    Cardinality(Modules) = 3

Spec ==
    /\ Init
    /\ [][Next]_vars

====
