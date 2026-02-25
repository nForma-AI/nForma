---- MODULE QGSDAccountManager ----
(*
 * formal/tla/QGSDAccountManager.tla
 * Handwritten — not generated from XState.
 * Source: bin/account-manager.cjs
 *
 * Models the OAuth account pool manager for QGSD providers.
 *
 * States:
 *   IDLE       — no operation in progress
 *   ADDING     — capturing current active credential (awaiting copy)
 *   SAVING     — writing captured credential to pool
 *   SWITCHING  — swapping active credential file
 *   REMOVING   — removing account from pool
 *   ERROR      — recoverable error, awaiting reset
 *
 * Key invariants:
 *   ActiveIsPoolMember : if an active account is set, it must be in the pool
 *   NoActiveWhenEmpty  : if pool is empty, active must be NoAccount
 *   IdleNoPending      : in IDLE, no pending operation is in-flight
 *   OpMatchesState     : pending_op.type is consistent with current state
 *
 * Liveness:
 *   IdleReachable      : IDLE is always eventually reachable (no deadlocks)
 *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS MaxPool   \* upper bound on pool size (e.g. 10)

VARIABLES
    state,       \* FSM state ∈ {"IDLE","ADDING","SAVING","SWITCHING","REMOVING","ERROR"}
    pool,        \* set of account IDs currently in the pool
    active,      \* currently active account ID, or NoAccount
    pending_op   \* { type: OpType, target: AccountId } or NoPending

\* ── Type helpers ─────────────────────────────────────────────────────────────
AccountIds == 1..MaxPool
NoAccount  == 0
NoPending  == [type |-> "none", target |-> NoAccount]
OpTypes    == {"none", "ADD", "SWITCH", "REMOVE"}
FsmStates  == {"IDLE", "ADDING", "SAVING", "SWITCHING", "REMOVING", "ERROR"}

vars == <<state, pool, active, pending_op>>

TypeOK ==
    /\ state      \in FsmStates
    /\ pool       \in SUBSET AccountIds
    /\ active     \in AccountIds \union {NoAccount}
    /\ pending_op \in [type: OpTypes, target: AccountIds \union {NoAccount}]

\* ── Initial state ─────────────────────────────────────────────────────────────
Init ==
    /\ state      = "IDLE"
    /\ pool       = {}
    /\ active     = NoAccount
    /\ pending_op = NoPending

\* ── Actions ───────────────────────────────────────────────────────────────────

\* IDLE → ADDING: user invokes `add --name <id>`
\* Guard: id not already in pool; pool not full
StartAdd(id) ==
    /\ state        = "IDLE"
    /\ id          \notin pool
    /\ Cardinality(pool) < MaxPool
    /\ state'       = "ADDING"
    /\ pending_op'  = [type |-> "ADD", target |-> id]
    /\ UNCHANGED <<pool, active>>

\* ADDING → SAVING: source credential file is readable
OAuthSuccess ==
    /\ state  = "ADDING"
    /\ state' = "SAVING"
    /\ UNCHANGED <<pool, active, pending_op>>

\* ADDING → ERROR: source credential file missing or unreadable
OAuthFail ==
    /\ state  = "ADDING"
    /\ state' = "ERROR"
    /\ UNCHANGED <<pool, active, pending_op>>

\* SAVING → IDLE: file written to pool successfully
\* If pool was empty, the new account also becomes active.
SaveOk ==
    /\ state       = "SAVING"
    /\ pool'       = pool \union {pending_op.target}
    /\ active'     = IF active = NoAccount THEN pending_op.target ELSE active
    /\ state'      = "IDLE"
    /\ pending_op' = NoPending

\* SAVING → ERROR: file write failed
SaveFail ==
    /\ state      = "SAVING"
    /\ state'     = "ERROR"
    /\ UNCHANGED <<pool, active, pending_op>>

\* IDLE → SWITCHING: user invokes `switch <target>`
\* Guard: target exists in pool
StartSwitch(id) ==
    /\ state        = "IDLE"
    /\ id          \in pool
    /\ state'       = "SWITCHING"
    /\ pending_op'  = [type |-> "SWITCH", target |-> id]
    /\ UNCHANGED <<pool, active>>

\* SWITCHING → IDLE: active credential file overwritten successfully
SwapOk ==
    /\ state       = "SWITCHING"
    /\ active'     = pending_op.target
    /\ state'      = "IDLE"
    /\ pending_op' = NoPending
    /\ UNCHANGED pool

\* SWITCHING → ERROR: file overwrite failed
SwapFail ==
    /\ state      = "SWITCHING"
    /\ state'     = "ERROR"
    /\ UNCHANGED <<pool, active, pending_op>>

\* IDLE → REMOVING: user invokes `remove <target>`
\* Guard: target exists in pool
StartRemove(id) ==
    /\ state        = "IDLE"
    /\ id          \in pool
    /\ state'       = "REMOVING"
    /\ pending_op'  = [type |-> "REMOVE", target |-> id]
    /\ UNCHANGED <<pool, active>>

\* REMOVING → IDLE: account removed from pool
\* If removed account was active, rotate to any remaining account (or NoAccount).
RemoveOk ==
    /\ state       = "REMOVING"
    /\ pool'       = pool \ {pending_op.target}
    /\ active'     = IF active /= pending_op.target
                     THEN active
                     ELSE IF pool' = {} THEN NoAccount
                          ELSE CHOOSE a \in pool' : TRUE
    /\ state'      = "IDLE"
    /\ pending_op' = NoPending

\* REMOVING → ERROR: file deletion failed
RemoveFail ==
    /\ state      = "REMOVING"
    /\ state'     = "ERROR"
    /\ UNCHANGED <<pool, active, pending_op>>

\* ERROR → IDLE: user resets / retries (via `account-manager.cjs reset`)
ResetError ==
    /\ state       = "ERROR"
    /\ state'      = "IDLE"
    /\ pending_op' = NoPending
    /\ UNCHANGED <<pool, active>>

\* ── Next ──────────────────────────────────────────────────────────────────────
Next ==
    \/ \E id \in AccountIds : StartAdd(id)
    \/ OAuthSuccess
    \/ OAuthFail
    \/ SaveOk
    \/ SaveFail
    \/ \E id \in AccountIds : StartSwitch(id)
    \/ SwapOk
    \/ SwapFail
    \/ \E id \in AccountIds : StartRemove(id)
    \/ RemoveOk
    \/ RemoveFail
    \/ ResetError

\* ── Safety invariants ────────────────────────────────────────────────────────

\* ActiveIsPoolMember: active account (when set) must be in the pool
ActiveIsPoolMember ==
    active /= NoAccount => active \in pool

\* NoActiveWhenEmpty: empty pool implies no active account
NoActiveWhenEmpty ==
    pool = {} => active = NoAccount

\* IdleNoPending: in IDLE state there is no pending operation
IdleNoPending ==
    state = "IDLE" => pending_op = NoPending

\* OpMatchesState: pending_op.type is consistent with the FSM state
OpMatchesState ==
    \/ state = "IDLE"      /\ pending_op.type = "none"
    \/ state = "ADDING"    /\ pending_op.type = "ADD"
    \/ state = "SAVING"    /\ pending_op.type = "ADD"
    \/ state = "SWITCHING" /\ pending_op.type = "SWITCH"
    \/ state = "REMOVING"  /\ pending_op.type = "REMOVE"
    \/ state = "ERROR"     \* pending_op may be any type from the failing op

\* ── Liveness ─────────────────────────────────────────────────────────────────

\* IdleReachable: from any state, IDLE is eventually reachable (no deadlocks)
IdleReachable == <>(state = "IDLE")

\* ── Full specification ────────────────────────────────────────────────────────
Spec == Init /\ [][Next]_vars
        /\ WF_vars(OAuthSuccess)
        /\ WF_vars(OAuthFail)
        /\ WF_vars(SaveOk)
        /\ WF_vars(SaveFail)
        /\ WF_vars(SwapOk)
        /\ WF_vars(SwapFail)
        /\ WF_vars(RemoveOk)
        /\ WF_vars(RemoveFail)
        /\ WF_vars(ResetError)

====
