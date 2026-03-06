-- .planning/formal/alloy/traceability-obligations.als
-- Models the traceability annotation obligations for specific subsystems.
-- Source: bin/observe-handlers.cjs, bin/validate-traces.cjs, bin/formal-test-sync.cjs
--
-- @requirement DEBT-01
-- @requirement FVTOOL-01
-- @requirement TRACE-07

module traceability_obligations

abstract sig Bool {}
one sig True, False extends Bool {}

-- Subsystem categories with traceability obligations
abstract sig Subsystem {}
one sig DebtObservability, FormalTooling, ConformanceInfra extends Subsystem {}

-- A source file belonging to a subsystem
sig SourceFile {
  subsystem: one Subsystem,
  hasReqAnnotation: one Bool
}

-- A test file covering a source file
sig TestFile {
  covers: one SourceFile,
  hasReqAnnotation: one Bool
}

-- DEBT-01: Debt/observability source files have @requirement annotations
-- @requirement DEBT-01
fact DebtAnnotated {
  all f: SourceFile |
    f.subsystem = DebtObservability implies f.hasReqAnnotation = True
}

-- FVTOOL-01: Formal tooling scripts have @requirement annotations
-- @requirement FVTOOL-01
fact FormalToolingAnnotated {
  all f: SourceFile |
    f.subsystem = FormalTooling implies f.hasReqAnnotation = True
}

-- FVTOOL-01: Each formal tooling script has a test with @req
-- @requirement FVTOOL-01
fact FormalToolingHasTests {
  all f: SourceFile |
    f.subsystem = FormalTooling implies
      (some t: TestFile | t.covers = f and t.hasReqAnnotation = True)
}

-- TRACE-07: Conformance infra source files are requirement-traced
-- @requirement TRACE-07
fact ConformanceAnnotated {
  all f: SourceFile |
    f.subsystem = ConformanceInfra implies f.hasReqAnnotation = True
}

-- TRACE-07: Conformance infra has test coverage with @req
-- @requirement TRACE-07
fact ConformanceHasTests {
  all f: SourceFile |
    f.subsystem = ConformanceInfra implies
      (some t: TestFile | t.covers = f and t.hasReqAnnotation = True)
}

-- Assertions

-- @requirement DEBT-01
assert DebtSubsystemFullyTraced {
  all f: SourceFile |
    f.subsystem = DebtObservability implies f.hasReqAnnotation = True
}
check DebtSubsystemFullyTraced for 5 but 8 SourceFile, 8 TestFile

-- @requirement FVTOOL-01
assert FormalToolingFullyTraced {
  all f: SourceFile |
    f.subsystem = FormalTooling implies
      (f.hasReqAnnotation = True and
       some t: TestFile | t.covers = f and t.hasReqAnnotation = True)
}
check FormalToolingFullyTraced for 5 but 8 SourceFile, 8 TestFile

-- @requirement TRACE-07
assert ConformanceFullyTraced {
  all f: SourceFile |
    f.subsystem = ConformanceInfra implies
      (f.hasReqAnnotation = True and
       some t: TestFile | t.covers = f and t.hasReqAnnotation = True)
}
check ConformanceFullyTraced for 5 but 8 SourceFile, 8 TestFile
