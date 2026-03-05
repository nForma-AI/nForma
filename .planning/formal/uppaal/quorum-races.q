// QGSD Quorum Race Detection Property Queries — UPPAAL-01, UPPAAL-03
// Run with: verifyta formal/uppaal/quorum-races.xml formal/uppaal/quorum-races.q
//
// These queries are the critical measurement points (UPPAAL-03) for the
// quorum timed race model. Constants MIN_SLOT_MS, MAX_SLOT_MS, TIMEOUT_MS,
// and MIN_GAP_MS are parameterized — override via verifyta -C flags.

// UPPAAL-01: No deadlock in the quorum-races model
// Safety: the model must never reach a deadlocked state (all automata stuck)
A[] not deadlock

// UPPAAL-03a: Consensus is reachable (quorum can decide within timing bounds)
// Liveness: under the parameterized timing assumptions, the orchestrator reaches Decided
E<> orch.Decided

// UPPAAL-03b: Consensus reachable before timeout — critical measurement point (b)
// Maximum timeout value for which consensus is achievable before deadline
// If this query fails, TIMEOUT_MS must be increased relative to MAX_SLOT_MS
E<> orch.Decided and orch.t < TIMEOUT_MS

// UPPAAL-03a: Race-free operation — critical measurement point (a)
// No race fires when inter-slot response gap >= MIN_GAP_MS (model constraint)
// If this query fails, the model shows races are structurally possible
A[] not race.Race
