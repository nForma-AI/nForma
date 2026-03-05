---- MODULE QGSDInstallerIdempotency ----
(*
 * .formal/tla/QGSDInstallerIdempotency.tla
 * Handwritten — models installer idempotency and config preservation.
 * Source: bin/install.js
 *
 * @requirement INST-06
 * @requirement INST-07
 * @requirement INST-08
 * @requirement INST-09
 * @requirement INST-10
 *)
EXTENDS Naturals, TLC

VARIABLES
    hooksInstalled,     \* BOOLEAN — hooks synced to ~/.claude/hooks/
    breakerRegistered,  \* BOOLEAN — PreToolUse hook registered in settings.json
    defaultConfig,      \* BOOLEAN — default circuit_breaker config block exists
    projectOverrides,   \* BOOLEAN — per-project .claude/qgsd.json has custom values
    installCount        \* number of times installer has run

vars == <<hooksInstalled, breakerRegistered, defaultConfig, projectOverrides, installCount>>

TypeOK ==
    /\ hooksInstalled    \in BOOLEAN
    /\ breakerRegistered \in BOOLEAN
    /\ defaultConfig     \in BOOLEAN
    /\ projectOverrides  \in BOOLEAN
    /\ installCount      \in Nat

Init ==
    /\ hooksInstalled    = FALSE
    /\ breakerRegistered = FALSE
    /\ defaultConfig     = FALSE
    /\ projectOverrides  \in BOOLEAN  \* may or may not exist before install
    /\ installCount      = 0

\* ── Actions ────────────────────────────────────────────────────────────────

\* INST-06: Idempotent install — updates hooks and config without breaking
\* @requirement INST-06
Install ==
    /\ hooksInstalled'    = TRUE
    /\ breakerRegistered' = TRUE
    /\ defaultConfig'     = TRUE
    /\ projectOverrides'  = projectOverrides  \* INST-07: preserved
    /\ installCount'      = installCount + 1

\* User creates project overrides between installs
CreateProjectOverrides ==
    /\ projectOverrides = FALSE
    /\ projectOverrides' = TRUE
    /\ UNCHANGED <<hooksInstalled, breakerRegistered, defaultConfig, installCount>>

Next ==
    \/ Install
    \/ CreateProjectOverrides

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement INST-06
\* After first install, hooks always installed
IdempotentHooks ==
    installCount > 0 => hooksInstalled = TRUE

\* @requirement INST-08
\* After first install, breaker hook always registered
BreakerAlwaysRegistered ==
    installCount > 0 => breakerRegistered = TRUE

\* @requirement INST-09
\* After first install, default config always present
DefaultConfigPresent ==
    installCount > 0 => defaultConfig = TRUE

\* @requirement INST-07
\* @requirement INST-10
\* Project overrides are never destroyed by install
OverridesPreserved ==
    [][projectOverrides = TRUE => projectOverrides' = TRUE]_vars

Spec ==
    /\ Init
    /\ [][Next]_vars

====
