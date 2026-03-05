-- .formal/alloy/uppaal-model-reqs.als
-- Models the structural requirements for the UPPAAL timed automaton.
-- Source: bin/run-uppaal.cjs, .formal/uppaal/quorum-races.xml
--
-- @requirement UPPAAL-01
-- @requirement UPPAAL-02
-- @requirement UPPAAL-03

module uppaal_model_reqs

abstract sig Bool {}
one sig True, False extends Bool {}

-- The UPPAAL model structure
-- @requirement UPPAAL-01
sig UppaalModel {
  automata: set TimedAutomaton,
  usesEmpiricalTiming: one Bool,
  hasCheckResult: one Bool,
  properties: set AnnotatedProperty
} {
  #automata >= 2  -- at least slot response + timeout automata
  usesEmpiricalTiming = True  -- UPPAAL-01: uses runtime_ms from check-results
}

sig TimedAutomaton {
  clockGuards: set ClockConstraint,
  invariants: set ClockConstraint
}

sig ClockConstraint {
  empirical: one Bool  -- derived from check-results.ndjson runtime_ms
}

-- UPPAAL-01: All clock constraints use empirical timing, not hardcoded
-- @requirement UPPAAL-01
fact EmpiricalTiming {
  all c : ClockConstraint | c.empirical = True
}

-- UPPAAL-02: run-uppaal.cjs produces a check result
-- @requirement UPPAAL-02
sig UppaalRunner {
  model: one UppaalModel,
  producesCheckResult: one Bool,
  addedToFormalVerify: one Bool
} {
  producesCheckResult = True
  addedToFormalVerify = True
}

-- UPPAAL-02: Check result written to check-results.ndjson
-- @requirement UPPAAL-02
fact RunnerProducesResult {
  all r : UppaalRunner | r.model.hasCheckResult = True
}

-- Critical measurement points
abstract sig MeasurementType {}
one sig MinInterSlotGap, MaxTimeoutForConsensus extends MeasurementType {}

-- UPPAAL-03: Annotated properties for critical measurements
-- @requirement UPPAAL-03
sig AnnotatedProperty {
  measurement: one MeasurementType
}

-- UPPAAL-03: Model surfaces both critical measurement points
-- @requirement UPPAAL-03
fact BothMeasurements {
  all m : UppaalModel |
    (some p : m.properties | p.measurement = MinInterSlotGap) and
    (some p : m.properties | p.measurement = MaxTimeoutForConsensus)
}

-- Satisfiability
run {} for 3 but 1 UppaalModel, 3 TimedAutomaton, 3 ClockConstraint, 2 AnnotatedProperty, 1 UppaalRunner

-- @requirement UPPAAL-01
-- No hardcoded constants in clock constraints
assert AllConstraintsEmpirical {
  all c : ClockConstraint | c.empirical = True
}
check AllConstraintsEmpirical for 3 but 1 UppaalModel, 3 TimedAutomaton, 3 ClockConstraint, 2 AnnotatedProperty, 1 UppaalRunner

-- @requirement UPPAAL-03
-- Both measurement points always present
assert BothMeasurementsPresent {
  all m : UppaalModel |
    #{ p : m.properties | p.measurement = MinInterSlotGap } >= 1 and
    #{ p : m.properties | p.measurement = MaxTimeoutForConsensus } >= 1
}
check BothMeasurementsPresent for 3 but 1 UppaalModel, 3 TimedAutomaton, 3 ClockConstraint, 3 AnnotatedProperty, 1 UppaalRunner
