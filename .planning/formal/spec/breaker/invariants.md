# Liveness Fairness Declarations: breaker

**Spec source:** `formal/tla/QGSDCircuitBreaker.tla`
**Config:** `formal/tla/MCbreaker.cfg`

## MonitoringReachable

**Property:** `MonitoringReachable == <>(active = FALSE /\ disabled = FALSE)`
**Config line:** `PROPERTY MonitoringReachable` (MCbreaker.cfg)
**Fairness assumption:** WF_vars on 4 actions: OscillationDetected, ResetBreaker, DisableBreaker, EnableBreaker
**Realism rationale:** The circuit breaker in `hooks/qgsd-circuit-breaker.js` progresses through states (monitoring → active → disabled) via explicit user or Claude actions. OscillationDetected fires when the run-collapse algorithm detects 3+ alternating commit groups; ResetBreaker fires after oscillation resolution (explicitly called via `npx qgsd --reset-breaker`). By weak fairness, once any terminal action (Reset or Enable) is enabled, it must eventually fire — models the fact that the resolution protocol, once invoked, will run to completion in QGSD's sequential hook execution context.

**Source:** `formal/tla/QGSDCircuitBreaker.tla`, lines 77, 80–84
