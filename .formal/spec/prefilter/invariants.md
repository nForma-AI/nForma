# Liveness Fairness Declarations: prefilter

**Spec source:** `formal/tla/QGSDPreFilter.tla`
**Config:** `formal/tla/MCprefilter.cfg`

## PreFilterTerminates

**Property:** `PreFilterTerminates == <>(filterPhase = "AUTO_RESOLVED" \/ filterPhase = "USER_NEEDED")`
**Config line:** `PROPERTY PreFilterTerminates` (MCprefilter.cfg)
**Fairness assumption:** WF_vars on 2 composite actions: EvaluateAndResolve (existentially quantified over BOOLEAN), EscalateToUser
**Realism rationale:** The R4 pre-filter in `hooks/qgsd-prompt.js` runs voting rounds in a loop until consensus or escalation. EvaluateAndResolve covers the agreement/disagreement outcome for any Boolean vote result — once an outcome is enabled (a voting slot responds), by weak fairness it must eventually fire. EscalateToUser fires when all deliberation rounds exhaust without consensus; the bounded loop in R4 (capped at 3 rounds) guarantees this action eventually becomes enabled, and WF ensures it fires.

**Source:** `formal/tla/QGSDPreFilter.tla`, lines 101, 105–107
