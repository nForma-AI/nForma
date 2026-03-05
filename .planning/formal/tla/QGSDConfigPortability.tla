---- MODULE QGSDConfigPortability ----
(*
 * .formal/tla/QGSDConfigPortability.tla
 * Handwritten — models config export/import with backup and redaction.
 * Source: bin/qgsd.cjs (export/import wizard screens)
 *
 * @requirement PORT-01
 * @requirement PORT-02
 * @requirement PORT-03
 *)
EXTENDS Naturals, TLC

VARIABLES
    claudeJsonExists,   \* BOOLEAN — ~/.claude.json exists
    exportFileExists,   \* BOOLEAN — portable JSON export file exists
    exportRedacted,     \* BOOLEAN — export file has keys redacted
    backupExists,       \* BOOLEAN — timestamped backup of ~/.claude.json
    keysReentered,      \* BOOLEAN — user re-entered redacted keys during import
    importApplied,      \* BOOLEAN — import config applied to ~/.claude.json
    phase               \* "idle" | "exporting" | "exported" | "importing" | "validated" | "backed_up" | "applied"

vars == <<claudeJsonExists, exportFileExists, exportRedacted, backupExists, keysReentered, importApplied, phase>>

Phases == {"idle", "exporting", "exported", "importing", "validated", "backed_up", "applied"}

TypeOK ==
    /\ claudeJsonExists \in BOOLEAN
    /\ exportFileExists \in BOOLEAN
    /\ exportRedacted   \in BOOLEAN
    /\ backupExists     \in BOOLEAN
    /\ keysReentered    \in BOOLEAN
    /\ importApplied    \in BOOLEAN
    /\ phase            \in Phases

Init ==
    /\ claudeJsonExists = TRUE
    /\ exportFileExists = FALSE
    /\ exportRedacted   = FALSE
    /\ backupExists     = FALSE
    /\ keysReentered    = FALSE
    /\ importApplied    = FALSE
    /\ phase            = "idle"

\* ── Actions ────────────────────────────────────────────────────────────────

\* PORT-01: Export roster config with redacted keys
\* @requirement PORT-01
ExportConfig ==
    /\ phase = "idle"
    /\ claudeJsonExists = TRUE
    /\ exportFileExists' = TRUE
    /\ exportRedacted'   = TRUE
    /\ phase'            = "exported"
    /\ UNCHANGED <<claudeJsonExists, backupExists, keysReentered, importApplied>>

\* PORT-02: Begin import — validate schema
\* @requirement PORT-02
StartImport ==
    /\ phase = "idle"
    /\ exportFileExists = TRUE
    /\ phase' = "importing"
    /\ UNCHANGED <<claudeJsonExists, exportFileExists, exportRedacted, backupExists, keysReentered, importApplied>>

\* PORT-02: Validate schema during import
\* @requirement PORT-02
ValidateImport ==
    /\ phase = "importing"
    /\ phase' = "validated"
    /\ UNCHANGED <<claudeJsonExists, exportFileExists, exportRedacted, backupExists, keysReentered, importApplied>>

\* PORT-02: User re-enters redacted keys
\* @requirement PORT-02
ReenterKeys ==
    /\ phase = "validated"
    /\ exportRedacted = TRUE
    /\ keysReentered' = TRUE
    /\ UNCHANGED <<claudeJsonExists, exportFileExists, exportRedacted, backupExists, importApplied, phase>>

\* PORT-03: Create backup before applying
\* @requirement PORT-03
CreateBackup ==
    /\ phase = "validated"
    /\ keysReentered = TRUE
    /\ claudeJsonExists = TRUE
    /\ backupExists' = TRUE
    /\ phase'        = "backed_up"
    /\ UNCHANGED <<claudeJsonExists, exportFileExists, exportRedacted, keysReentered, importApplied>>

\* PORT-02: Apply import (requires backup first)
\* @requirement PORT-02
ApplyImport ==
    /\ phase = "backed_up"
    /\ backupExists = TRUE
    /\ importApplied'    = TRUE
    /\ phase'            = "applied"
    /\ UNCHANGED <<claudeJsonExists, exportFileExists, exportRedacted, backupExists, keysReentered>>

\* Return to idle
ReturnToIdle ==
    /\ phase \in {"exported", "applied"}
    /\ phase' = "idle"
    /\ UNCHANGED <<claudeJsonExists, exportFileExists, exportRedacted, backupExists, keysReentered, importApplied>>

Next ==
    \/ ExportConfig
    \/ StartImport
    \/ ValidateImport
    \/ ReenterKeys
    \/ CreateBackup
    \/ ApplyImport
    \/ ReturnToIdle

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement PORT-01
\* Export always has keys redacted
ExportAlwaysRedacted ==
    exportFileExists = TRUE => exportRedacted = TRUE

\* @requirement PORT-03
\* Import only applied after backup exists
ImportRequiresBackup ==
    importApplied = TRUE => backupExists = TRUE

\* @requirement PORT-02
\* Keys must be re-entered before import can be applied
ApplyRequiresKeys ==
    importApplied = TRUE => keysReentered = TRUE

Spec ==
    /\ Init
    /\ [][Next]_vars

====
