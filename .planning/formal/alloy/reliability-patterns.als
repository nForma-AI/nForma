-- .formal/alloy/reliability-patterns.als
-- Models reliability patterns: graceful degradation on external failures
-- and progress indication for long-running operations.
-- Source: qgsd-baseline requirements
--
-- @requirement REL-01
-- @requirement REL-02

module reliability_patterns

-- External services that can fail
abstract sig ExternalService {}
sig API, Database, ThirdPartySDK extends ExternalService {}

-- REL-01: Failure handling strategy
-- @requirement REL-01
abstract sig FailureHandling {}
one sig GracefulDegradation extends FailureHandling {}
one sig Crash extends FailureHandling {}

sig ServiceCall {
  target: one ExternalService,
  hasTryCatch: one Bool,
  onFailure: one FailureHandling
}

-- REL-01: All external service calls must have try-catch and degrade gracefully
-- @requirement REL-01
fact GracefulDegradationRequired {
  all sc: ServiceCall |
    sc.hasTryCatch = True and sc.onFailure = GracefulDegradation
}

-- No service call should crash the application
assert NoCrashOnExternalFailure {
  no sc: ServiceCall | sc.onFailure = Crash
}

-- REL-02: Long-running operations
-- @requirement REL-02
sig LongRunningOperation {
  durationExceeds2s: one Bool,
  showsProgress: one Bool,
  isCancellable: one Bool
}

-- REL-02: Long ops (>2s) must show progress and be cancellable
-- @requirement REL-02
fact LongOpsRequireProgressAndCancel {
  all op: LongRunningOperation |
    op.durationExceeds2s = True implies
      (op.showsProgress = True and op.isCancellable = True)
}

-- Short ops have no constraint
assert ShortOpsUnconstrained {
  all op: LongRunningOperation |
    op.durationExceeds2s = False implies
      (op.showsProgress in Bool and op.isCancellable in Bool)
}

-- Verification commands
check NoCrashOnExternalFailure for 5
check ShortOpsUnconstrained for 5

-- Bool helper
abstract sig Bool {}
one sig True, False extends Bool {}
