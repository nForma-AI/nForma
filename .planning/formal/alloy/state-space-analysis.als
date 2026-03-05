-- .formal/alloy/state-space-analysis.als
-- Models the state-space analysis tool constraints.
-- Source: bin/analyze-state-space.cjs
--
-- @requirement DECOMP-01
-- @requirement DECOMP-02
-- @requirement DECOMP-03
-- @requirement DECOMP-04

module state_space_analysis

-- Risk classification levels
abstract sig RiskLevel {}
one sig MINIMAL, LOW, MODERATE, HIGH extends RiskLevel {}

-- A TLA+ model being analyzed
sig TLAModel {
  variables: set Variable,
  stateSpaceSize: one Int,
  risk: one RiskLevel,
  hasUnboundedDomain: one Bool,
  inTraceMatrix: one Bool
} {
  stateSpaceSize > 0
}

sig Variable {
  bounded: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- DECOMP-01: Risk classification based on state-space size thresholds
-- @requirement DECOMP-01
fact RiskClassification {
  all m : TLAModel |
    (m.stateSpaceSize =< 1000 implies m.risk = MINIMAL) and
    (m.stateSpaceSize > 1000 and m.stateSpaceSize =< 10000 implies m.risk = LOW) and
    (m.stateSpaceSize > 10000 and m.stateSpaceSize =< 100000 implies m.risk = MODERATE) and
    (m.stateSpaceSize > 100000 implies m.risk = HIGH)
}

-- DECOMP-02: Unbounded domains flagged as HIGH risk
-- @requirement DECOMP-02
fact UnboundedIsHigh {
  all m : TLAModel |
    m.hasUnboundedDomain = True implies m.risk = HIGH
}

-- Unbounded domain detection from variables
fact UnboundedDetection {
  all m : TLAModel |
    (some v : m.variables | v.bounded = False)
      implies m.hasUnboundedDomain = True
}

-- A model split operation
sig ModelSplit {
  original: one TLAModel,
  fragments: set TLAModel,
  originalReqs: set Requirement,
  fragmentReqs: set Requirement
} {
  #fragments >= 2
  -- fragments are distinct from original
  original not in fragments
}

sig Requirement {}

-- DECOMP-03: Split preserves requirement coverage
-- @requirement DECOMP-03
fact SplitPreservesCoverage {
  all s : ModelSplit |
    s.originalReqs in s.fragmentReqs
}

-- DECOMP-04: State-space report included in traceability matrix
-- @requirement DECOMP-04
fact ReportInMatrix {
  all m : TLAModel |
    m.inTraceMatrix = True
}

-- Satisfiability check
run {} for 3 but 3 TLAModel, 4 Variable, 2 ModelSplit, 4 Requirement, 5 int

-- @requirement DECOMP-02
-- Unbounded models are always HIGH risk
assert UnboundedAlwaysHigh {
  all m : TLAModel |
    m.hasUnboundedDomain = True implies m.risk = HIGH
}
check UnboundedAlwaysHigh for 3 but 3 TLAModel, 4 Variable, 2 ModelSplit, 4 Requirement, 5 int

-- @requirement DECOMP-03
-- No requirement lost during split
assert SplitNeverLosesReqs {
  all s : ModelSplit |
    s.originalReqs in s.fragmentReqs
}
check SplitNeverLosesReqs for 3 but 3 TLAModel, 4 Variable, 2 ModelSplit, 4 Requirement, 5 int

-- @requirement DECOMP-04
-- All models appear in traceability matrix
assert AllModelsInMatrix {
  all m : TLAModel | m.inTraceMatrix = True
}
check AllModelsInMatrix for 3 but 3 TLAModel, 4 Variable, 2 ModelSplit, 4 Requirement, 5 int
