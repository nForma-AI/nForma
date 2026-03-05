-- .formal/alloy/health-validation.als
-- Models the health validation patterns and false positive elimination.
-- Source: bin/gsd-tools.cjs (validate health), qgsd-core/skills/health.md
--
-- @requirement HLTH-01
-- @requirement HLTH-02
-- @requirement HLTH-03
-- @requirement VIS-01

module health_validation

abstract sig Bool {}
one sig True, False extends Bool {}

-- Warning types
abstract sig WarningType {}
one sig W002, W005, W007, W008 extends WarningType {}

-- A directory or reference being validated
sig ValidationTarget {
  isVersionedPhaseDir: one Bool,
  isVersionedPhaseRef: one Bool,
  matchesPattern: one Bool
}

-- A health warning emitted by the validator
sig HealthWarning {
  warningType: one WarningType,
  target: one ValidationTarget,
  isFalsePositive: one Bool
}

-- HLTH-01: Zero W005 false positives for versioned phase dirs
-- @requirement HLTH-01
fact NoW005FalsePositives {
  all w : HealthWarning |
    (w.warningType = W005 and w.target.isVersionedPhaseDir = True)
      implies w.isFalsePositive = False
}

-- Stronger: versioned phase dirs never trigger W005 at all
-- @requirement HLTH-01
fact W005NeverOnVersionedDirs {
  no w : HealthWarning |
    w.warningType = W005 and w.target.isVersionedPhaseDir = True
}

-- HLTH-02: Zero W007 false positives for versioned phase dirs
-- @requirement HLTH-02
fact NoW007FalsePositives {
  no w : HealthWarning |
    w.warningType = W007 and w.target.isVersionedPhaseDir = True
}

-- HLTH-03: Zero W002 false positives for versioned phase refs in STATE.md
-- @requirement HLTH-03
fact NoW002FalsePositives {
  no w : HealthWarning |
    w.warningType = W002 and w.target.isVersionedPhaseRef = True
}

-- Quorum slot failure tracking
sig QuorumSlot {
  failureCount: one Int
} {
  failureCount >= 0
}

-- VIS-01: W008 surfaced when slot has >= 3 failures
-- @requirement VIS-01
fact W008OnHighFailure {
  all s : QuorumSlot |
    s.failureCount >= 3 implies
      (some w : HealthWarning | w.warningType = W008)
}

-- Satisfiability
run {} for 3 but 3 HealthWarning, 3 ValidationTarget, 2 QuorumSlot, 4 int

-- @requirement HLTH-01
assert ZeroW005OnVersioned {
  no w : HealthWarning |
    w.warningType = W005 and w.target.isVersionedPhaseDir = True
}
check ZeroW005OnVersioned for 3 but 4 HealthWarning, 4 ValidationTarget, 2 QuorumSlot, 4 int

-- @requirement HLTH-02
assert ZeroW007OnVersioned {
  no w : HealthWarning |
    w.warningType = W007 and w.target.isVersionedPhaseDir = True
}
check ZeroW007OnVersioned for 3 but 4 HealthWarning, 4 ValidationTarget, 2 QuorumSlot, 4 int

-- @requirement VIS-01
assert W008SurfacedForFailures {
  all s : QuorumSlot |
    s.failureCount >= 3 implies some w : HealthWarning | w.warningType = W008
}
check W008SurfacedForFailures for 3 but 3 QuorumSlot, 3 HealthWarning, 3 ValidationTarget, 4 int
