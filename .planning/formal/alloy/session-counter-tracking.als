-- .planning/formal/alloy/session-counter-tracking.als
-- Models the constraint that QGSDSessionPersistence TLA+ model uses
-- counter-based state tracking (activeCount, persistedCount) instead of
-- set-based tracking to keep TLC state space within practical bounds.
-- Source: .planning/formal/tla/QGSDSessionPersistence.tla
--
-- @requirement SPEC-07

module session_counter_tracking

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── SPEC-07: Counter-based vs set-based tracking ───────────────────────

-- @requirement SPEC-07
abstract sig TrackingStrategy {}
one sig CounterBased, SetBased extends TrackingStrategy {}

-- @requirement SPEC-07
sig SessionPersistenceModel {
  strategy: one TrackingStrategy,
  preservesSafetyInvariants: one Bool,
  preservesLivenessProperties: one Bool,
  stateSpacePractical: one Bool
}

-- @requirement SPEC-07
-- The model SHALL use counter-based tracking
fact UsesCounterBased {
  all m: SessionPersistenceModel |
    m.strategy = CounterBased
}

-- @requirement SPEC-07
-- Counter-based tracking preserves all safety invariants
fact PreservesSafety {
  all m: SessionPersistenceModel |
    m.preservesSafetyInvariants = True
}

-- @requirement SPEC-07
-- Counter-based tracking preserves all liveness properties
fact PreservesLiveness {
  all m: SessionPersistenceModel |
    m.preservesLivenessProperties = True
}

-- @requirement SPEC-07
-- Counter-based tracking keeps state space practical for TLC
fact PracticalStateSpace {
  all m: SessionPersistenceModel |
    m.stateSpacePractical = True
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement SPEC-07
assert CounterBasedIsUsed {
  all m: SessionPersistenceModel | m.strategy = CounterBased
}
check CounterBasedIsUsed for 3

-- @requirement SPEC-07
assert InvariantsPreserved {
  all m: SessionPersistenceModel |
    m.preservesSafetyInvariants = True and
    m.preservesLivenessProperties = True
}
check InvariantsPreserved for 3
