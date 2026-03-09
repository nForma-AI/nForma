# Liveness Fairness Declarations: sessionpersistence

**Spec source:** `formal/tla/QGSDSessionPersistence.tla`
**Config:** `formal/tla/MCSessionPersistence.cfg`

## RestoreComplete_Prop

**Property:** `RestoreComplete_Prop == (state = "restarting") ~> (state = "running")`
**Config line:** `PROPERTY RestoreComplete_Prop` (MCSessionPersistence.cfg)
**Fairness assumption:** WF_vars on RestoreFromDisk and RestoreComplete actions
**Realism rationale:** When the TUI restarts (state = "restarting"), the system reads sessions.json to restore persisted sessions and counter. RestoreFromDisk reads the file, then RestoreComplete transitions back to "running". Weak fairness on both ensures the restore completes — models the fact that file I/O is synchronous and completes in bounded time. The Spec definition in QGSDSessionPersistence.tla embeds `WF_vars(RestoreFromDisk) /\ WF_vars(RestoreComplete)`.

**Source:** `formal/tla/QGSDSessionPersistence.tla`, Spec definition
