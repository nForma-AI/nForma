---- MODULE QGSDCircuitBreaker ----
(*
 * formal/tla/QGSDCircuitBreaker.tla
 * Handwritten — not generated from XState.
 * Source: hooks/qgsd-circuit-breaker.js + bin/qgsd.cjs
 *
 * Models the circuit breaker CLI state machine.
 * State encoding (from bin/qgsd.cjs):
 *   MONITORING = active=FALSE /\ disabled=FALSE
 *   TRIGGERED  = active=TRUE  /\ disabled=FALSE
 *   DISABLED   = disabled=TRUE (active forced FALSE by DisableBreaker)
*)
EXTENDS Naturals, TLC

VARIABLES active, disabled
vars == <<active, disabled>>

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ active   \in BOOLEAN
    /\ disabled \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
\* Both FALSE = MONITORING state (nominal idle state)
Init ==
    /\ active   = FALSE
    /\ disabled = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* MONITORING -> TRIGGERED: hook sets active=TRUE when oscillation detected
OscillationDetected ==
    /\ active   = FALSE
    /\ disabled = FALSE
    /\ active'   = TRUE
    /\ UNCHANGED disabled

\* TRIGGERED -> MONITORING: --reset-breaker deletes state file (active=FALSE)
ResetBreaker ==
    /\ active   = TRUE
    /\ disabled = FALSE
    /\ active'   = FALSE
    /\ UNCHANGED disabled

\* MONITORING or TRIGGERED -> DISABLED: --disable-breaker sets disabled=TRUE, active=FALSE
DisableBreaker ==
    /\ disabled = FALSE
    /\ disabled' = TRUE
    /\ active'   = FALSE

\* DISABLED -> MONITORING: --enable-breaker sets disabled=FALSE, active=FALSE
EnableBreaker ==
    /\ disabled = TRUE
    /\ disabled' = FALSE
    /\ active'   = FALSE

Next ==
    \/ OscillationDetected
    \/ ResetBreaker
    \/ DisableBreaker
    \/ EnableBreaker

\* ── Safety invariants ────────────────────────────────────────────────────────

\* DisabledExcludesActive: disabled=TRUE => active=FALSE
\* Encodes the invariant that the DISABLED state cannot coexist with TRIGGERED.
DisabledExcludesActive ==
    disabled = TRUE => active = FALSE

\* EnableClearsDisable: after EnableBreaker, disabled=FALSE
\* (enforced structurally by EnableBreaker action — no separate invariant needed)

\* ── Liveness ─────────────────────────────────────────────────────────────────

\* MonitoringReachable: from any state, MONITORING is eventually reachable
\* (active=FALSE /\ disabled=FALSE is the MONITORING encoding)
MonitoringReachable == <>(active = FALSE /\ disabled = FALSE)

\* ── Full specification with weak fairness ────────────────────────────────────
Spec == Init /\ [][Next]_vars
        /\ WF_vars(OscillationDetected)
        /\ WF_vars(ResetBreaker)
        /\ WF_vars(DisableBreaker)
        /\ WF_vars(EnableBreaker)

====
