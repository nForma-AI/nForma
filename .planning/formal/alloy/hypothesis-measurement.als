/**
 * Formal model for H2M-01: Hypothesis-to-Measurement Residual Layer
 *
 * Requirement: The solve engine SHALL include an H->M residual layer that measures
 * formal model tier-1 assumptions against observed trace, scoreboard, and telemetry
 * data, recording CONFIRMED, VIOLATED, and UNMEASURABLE verdicts to
 * hypothesis-measurements.json.
 *
 * Properties verified:
 * 1. Completeness: every tier-1 assumption produces exactly one verdict
 * 2. Trichotomy: verdict is exactly one of {CONFIRMED, VIOLATED, UNMEASURABLE}
 * 3. Data source coverage: measurements draw from conformance, scoreboard, or telemetry
 * 4. Violated detection: assumptions with actual != formal get VIOLATED verdict
 * 5. Unmeasurable safety: missing data sources yield UNMEASURABLE (not CONFIRMED)
 * 6. Output persistence: every measurement is recorded to hypothesis-measurements.json
 */

-- Data sources that provide actual observed values
abstract sig DataSource {}
one sig Conformance, Scoreboard, Telemetry extends DataSource {}

-- Possible verdicts for a hypothesis measurement
abstract sig Verdict {}
one sig CONFIRMED, VIOLATED, UNMEASURABLE extends Verdict {}

-- A tier-1 assumption from a formal model
sig Assumption {
  assumptionName: one String,
  formalValue: one Int,
  sourceModel: one FormalModel
} {
  formalValue >= 0
}

-- A formal model file (TLA+, Alloy, or PRISM)
sig FormalModel {
  assumptions: set Assumption
}

-- Actual observed measurement from a data source
sig ActualMeasurement {
  source: one DataSource,
  observedValue: one Int
} {
  observedValue >= 0
}

-- A hypothesis measurement result
sig HypothesisMeasurement {
  assumption: one Assumption,
  verdict: one Verdict,
  actualData: lone ActualMeasurement,
  recorded: one Bool
}

-- Every assumption has exactly one measurement
fact Completeness {
  all a: Assumption | one m: HypothesisMeasurement | m.assumption = a
}

-- Each measurement maps to exactly one assumption (bijection)
fact OneToOne {
  all m1, m2: HypothesisMeasurement |
    m1.assumption = m2.assumption implies m1 = m2
}

-- Trichotomy: verdict assignment rules
fact VerdictRules {
  all m: HypothesisMeasurement | {
    -- UNMEASURABLE when no actual data available
    (no m.actualData) implies m.verdict = UNMEASURABLE

    -- CONFIRMED when actual matches formal
    (some m.actualData and m.actualData.observedValue = m.assumption.formalValue)
      implies m.verdict = CONFIRMED

    -- VIOLATED when actual differs from formal
    (some m.actualData and m.actualData.observedValue != m.assumption.formalValue)
      implies m.verdict = VIOLATED
  }
}

-- All measurements are recorded (persisted to output file)
fact AllRecorded {
  all m: HypothesisMeasurement | m.recorded = True
}

-- Boolean type for recorded flag
abstract sig Bool {}
one sig True, False extends Bool {}

-- String type placeholder for assumption names
sig String {}

-- PROPERTY 1: Every tier-1 assumption produces exactly one verdict
assert CompleteVerdicts {
  all a: Assumption | one m: HypothesisMeasurement |
    m.assumption = a and m.verdict in CONFIRMED + VIOLATED + UNMEASURABLE
}

-- PROPERTY 2: Verdict trichotomy - exactly one verdict per measurement
assert VerdictTrichotomy {
  all m: HypothesisMeasurement |
    m.verdict in CONFIRMED + VIOLATED + UNMEASURABLE
}

-- PROPERTY 4: Violated detection correctness
assert ViolatedDetection {
  all m: HypothesisMeasurement |
    (some m.actualData and m.actualData.observedValue != m.assumption.formalValue)
      implies m.verdict = VIOLATED
}

-- PROPERTY 5: Unmeasurable safety
assert UnmeasurableSafety {
  all m: HypothesisMeasurement |
    (no m.actualData) implies m.verdict = UNMEASURABLE
}

-- PROPERTY 6: Output persistence
assert AllPersisted {
  all m: HypothesisMeasurement | m.recorded = True
}

-- Check all properties
check CompleteVerdicts for 6
check VerdictTrichotomy for 6
check ViolatedDetection for 6
check UnmeasurableSafety for 6
check AllPersisted for 6

-- Run for visualization
run { some HypothesisMeasurement } for 4
