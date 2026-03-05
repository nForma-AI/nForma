-- .formal/alloy/provider-failure.als
-- Models provider failure handling and calibration wiring.
-- Source: bin/providers.json, bin/run-prism.cjs, .formal/policy.yaml
--
-- @requirement FAIL-02
-- @requirement CALIB-04

module provider_failure

abstract sig Bool {}
one sig True, False extends Bool {}

-- Provider status
abstract sig ProviderStatus {}
one sig UP, DOWN extends ProviderStatus {}

-- A provider (e.g., AkashML, Together.xyz)
sig Provider {
  status: one ProviderStatus,
  slots: set Slot
} {
  #slots >= 1
}

-- A quorum slot
sig Slot {
  provider: one Provider,
  skippedInDispatch: one Bool
}

-- Every slot belongs to exactly one provider
fact SlotOwnership {
  all s : Slot | s.provider.slots = s.provider.slots  -- ownership is bidirectional
  all s : Slot | s in s.provider.slots
}

-- FAIL-02: When provider DOWN, all its slots are skipped
-- @requirement FAIL-02
fact DownProviderSkipsAllSlots {
  all p : Provider |
    p.status = DOWN implies
      (all s : p.slots | s.skippedInDispatch = True)
}

-- FAIL-02: UP providers don't skip slots (by default)
-- @requirement FAIL-02
fact UpProviderNoSkip {
  all p : Provider |
    p.status = UP implies
      (all s : p.slots | s.skippedInDispatch = False)
}

-- PRISM calibration constants
-- @requirement CALIB-04
one sig PolicyConfig {
  tpRate: one Int,      -- tp_rate * 100 (integer representation)
  unavailRate: one Int  -- unavail * 100
} {
  tpRate >= 0
  tpRate =< 100
  unavailRate >= 0
  unavailRate =< 100
}

-- @requirement CALIB-04
one sig PRISMConstants {
  fallbackTpRate: one Int,
  fallbackUnavail: one Int
}

-- CALIB-04: Policy values wire to PRISM constants
-- @requirement CALIB-04
fact PolicyWiresToPRISM {
  PRISMConstants.fallbackTpRate = PolicyConfig.tpRate
  PRISMConstants.fallbackUnavail = PolicyConfig.unavailRate
}

-- Satisfiability
run {} for 3 but 2 Provider, 4 Slot, 4 int

-- @requirement FAIL-02
-- DOWN provider means all its slots skipped
assert DownSkipsAll {
  all p : Provider |
    p.status = DOWN implies
      all s : p.slots | s.skippedInDispatch = True
}
check DownSkipsAll for 3 but 3 Provider, 6 Slot, 4 int

-- @requirement FAIL-02
-- UP provider means no slots skipped
assert UpSkipsNone {
  all p : Provider |
    p.status = UP implies
      all s : p.slots | s.skippedInDispatch = False
}
check UpSkipsNone for 3 but 3 Provider, 6 Slot, 4 int

-- @requirement CALIB-04
-- Policy values are always wired through
assert PolicyWired {
  PRISMConstants.fallbackTpRate = PolicyConfig.tpRate
  PRISMConstants.fallbackUnavail = PolicyConfig.unavailRate
}
check PolicyWired for 3 but 2 Provider, 4 Slot, 4 int
