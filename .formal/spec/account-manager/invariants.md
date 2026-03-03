# Liveness Fairness Declarations: account-manager

**Spec source:** `formal/tla/QGSDAccountManager.tla`
**Config:** `formal/tla/MCaccount-manager.cfg`

## IdleReachable

**Property:** `IdleReachable == <>(state = "IDLE")`
**Config line:** `PROPERTIES IdleReachable` (MCaccount-manager.cfg)
**Fairness assumption:** WF_vars on 9 actions: OAuthSuccess, OAuthFail, SaveOk, SaveFail, SwapOk, SwapFail, RemoveOk, RemoveFail, ResetError
**Realism rationale:** The account manager in QGSD's credential management system processes OAuth flows and key operations sequentially. Each operation (OAuth, Save, Swap, Remove) must eventually complete — either succeeding or failing — before the state machine can progress toward IDLE. By weak fairness, once any operation's completion action is enabled (the external OAuth/API call returns), it must eventually fire. The 10s timeout on all API calls in QGSD's credential manager (MCTimeout constant) bounds the time any action remains pending, ensuring WF holds in the deployed context.

**Source:** `formal/tla/QGSDAccountManager.tla`, lines 194–207
