---- MODULE QGSDKeyManagement ----
(*
 * .formal/tla/QGSDKeyManagement.tla
 * Handwritten — models the API key management lifecycle through the wizard.
 * Source: bin/qgsd.cjs (wizard screens), bin/secrets.cjs (keytar)
 *
 * @requirement KEY-01
 * @requirement KEY-02
 * @requirement KEY-03
 * @requirement KEY-04
 *)
EXTENDS Naturals, TLC

VARIABLES
    keytarHasKey,   \* BOOLEAN — keytar secure store has a key for the slot
    envBlockKey,    \* BOOLEAN — ~/.claude.json env block has the key written
    agentRunning,   \* BOOLEAN — MCP agent process is running
    wizardPhase     \* "idle" | "input" | "stored" | "written" | "restarted"

vars == <<keytarHasKey, envBlockKey, agentRunning, wizardPhase>>

Phases == {"idle", "input", "stored", "written", "restarted"}

TypeOK ==
    /\ keytarHasKey  \in BOOLEAN
    /\ envBlockKey   \in BOOLEAN
    /\ agentRunning  \in BOOLEAN
    /\ wizardPhase   \in Phases

Init ==
    /\ keytarHasKey  \in BOOLEAN   \* may have a key from prior install
    /\ envBlockKey   \in BOOLEAN
    /\ agentRunning  \in BOOLEAN
    /\ wizardPhase   = "idle"
    \* Invariant must hold in init: envBlockKey => keytarHasKey
    /\ (envBlockKey = TRUE => keytarHasKey = TRUE)

\* ── Actions ────────────────────────────────────────────────────────────────

\* KEY-01: User sets or updates the API key via wizard
\* @requirement KEY-01
InputKey ==
    /\ wizardPhase = "idle"
    /\ wizardPhase' = "input"
    /\ UNCHANGED <<keytarHasKey, envBlockKey, agentRunning>>

\* KEY-02: Key stored securely via keytar
\* @requirement KEY-02
StoreInKeytar ==
    /\ wizardPhase = "input"
    /\ keytarHasKey' = TRUE
    /\ wizardPhase'  = "stored"
    /\ UNCHANGED <<envBlockKey, agentRunning>>

\* KEY-03: Wizard writes key from keytar to ~/.claude.json env block
\* @requirement KEY-03
WriteToEnvBlock ==
    /\ wizardPhase = "stored"
    /\ keytarHasKey = TRUE
    /\ envBlockKey' = TRUE
    /\ wizardPhase' = "written"
    /\ UNCHANGED <<keytarHasKey, agentRunning>>

\* KEY-04: Wizard restarts the agent after key changes
\* @requirement KEY-04
RestartAgent ==
    /\ wizardPhase = "written"
    /\ envBlockKey = TRUE
    /\ agentRunning' = TRUE
    /\ wizardPhase'  = "restarted"
    /\ UNCHANGED <<keytarHasKey, envBlockKey>>

\* Return to idle after full cycle
ReturnToIdle ==
    /\ wizardPhase = "restarted"
    /\ wizardPhase' = "idle"
    /\ UNCHANGED <<keytarHasKey, envBlockKey, agentRunning>>

Next ==
    \/ InputKey
    \/ StoreInKeytar
    \/ WriteToEnvBlock
    \/ RestartAgent
    \/ ReturnToIdle

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement KEY-02
\* Key must be in keytar before it can be in env block
KeytarBeforeEnv ==
    envBlockKey = TRUE => keytarHasKey = TRUE

\* @requirement KEY-03
\* Env block write only happens after keytar store
EnvWriteRequiresKeytar ==
    wizardPhase = "written" => keytarHasKey = TRUE

\* @requirement KEY-04
\* Agent restart only after env block is written
RestartRequiresEnvWrite ==
    wizardPhase = "restarted" => envBlockKey = TRUE

\* Sequential flow — phases progress in order
\* @requirement KEY-01
PhaseOrder ==
    /\ (wizardPhase = "stored")    => keytarHasKey = TRUE
    /\ (wizardPhase = "written")   => envBlockKey = TRUE
    /\ (wizardPhase = "restarted") => agentRunning = TRUE

Spec ==
    /\ Init
    /\ [][Next]_vars

====
