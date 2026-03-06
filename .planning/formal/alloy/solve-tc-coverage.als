-- .planning/formal/alloy/solve-tc-coverage.als
-- Models the T->C coverage cross-referencing that detects false-green properties.
-- Source: bin/nf-solve.cjs (crossReferenceFormalCoverage)
--
-- @requirement SOLVE-10

module solve_tc_coverage

abstract sig Bool {}
one sig True, False extends Bool {}

-- A formal property with test backing
sig FormalProperty {
  hasPassingTest: one Bool,
  testExercisesSource: one Bool,
  isFalseGreen: one Bool
}

-- SOLVE-10: A property is false-green when test passes but exercises zero source
-- @requirement SOLVE-10
fact FalseGreenDetection {
  all p: FormalProperty |
    (p.hasPassingTest = True and p.testExercisesSource = False)
      implies p.isFalseGreen = True
}

-- SOLVE-10: Properties where tests exercise source are NOT false-green
-- @requirement SOLVE-10
fact TrueGreenCorrect {
  all p: FormalProperty |
    (p.hasPassingTest = True and p.testExercisesSource = True)
      implies p.isFalseGreen = False
}

-- SOLVE-10: Failing tests are not false-green
-- @requirement SOLVE-10
fact FailingNotFalseGreen {
  all p: FormalProperty |
    p.hasPassingTest = False implies p.isFalseGreen = False
}

-- Coverage collection configuration
one sig CoverageConfig {
  failOpen: one Bool
}

-- SOLVE-10: Coverage collection is fail-open
-- @requirement SOLVE-10
fact CoverageFailOpen {
  CoverageConfig.failOpen = True
}

-- Assertions

-- @requirement SOLVE-10
assert FalseGreenOnlyWhenNoSourceExercised {
  all p: FormalProperty |
    p.isFalseGreen = True implies
      (p.hasPassingTest = True and p.testExercisesSource = False)
}
check FalseGreenOnlyWhenNoSourceExercised for 5 but 10 FormalProperty

-- @requirement SOLVE-10
assert CoverageAlwaysFailOpen {
  CoverageConfig.failOpen = True
}
check CoverageAlwaysFailOpen for 3
