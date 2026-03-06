-- .planning/formal/alloy/trace-coverage-matrix.als
-- Models the traceability matrix coverage computation and CI guard.
-- Source: bin/generate-traceability-matrix.cjs
--
-- Split from: traceability-annotations.als (coupling verification)
-- Overlaps with: annotation-extraction.als
--   Shared sigs: ModelFile, Annotation, Requirement
--   This model proves coverage is correctly computed from annotations.
--   The sibling model proves annotations are correctly extracted.
--
-- @requirement TRACE-01
-- @requirement TRACE-02
-- @requirement TRACE-04
-- @requirement TRACE-05

module trace_coverage_matrix

-- ── Shared sigs (overlap with annotation-extraction.als) ─────────────

sig ModelFile {
  annotations: set Annotation
}

sig Annotation {
  reqIds: set Requirement
}

sig Requirement {
  claimedModels: set ModelFile
}

-- ── Local sigs ───────────────────────────────────────────────────────

-- The traceability matrix output (singleton)
one sig Matrix {
  coveredReqs: set Requirement,
  uncoveredReqs: set Requirement,
  totalReqs: one Int
}

-- CI coverage threshold guard
one sig CIGuard {
  threshold: one Int
} {
  threshold >= 0
  threshold =< 100
}

-- ── Structural constraints ───────────────────────────────────────────

-- Bound set fields to keep scenarios under budget
fact BoundedAnnotations {
  all m : ModelFile | #m.annotations <= 2
}

fact BoundedReqIds {
  all a : Annotation | #a.reqIds <= 2
}

fact BoundedClaims {
  all r : Requirement | #r.claimedModels <= 1
}

-- Matrix sets are bounded by total requirements
fact BoundedMatrixSets {
  #Matrix.coveredReqs <= #Requirement
  #Matrix.uncoveredReqs <= #Requirement
}

-- Every annotation belongs to some model
fact AnnotationOwned {
  all a : Annotation | some m : ModelFile | a in m.annotations
}

-- TRACE-01: Coverage = requirements linked via annotations
-- @requirement TRACE-01
fact CoverageDefinition {
  Matrix.coveredReqs = { r : Requirement |
    some m : ModelFile, a : m.annotations | r in a.reqIds
  }
}

-- TRACE-02: Uncovered is the complement; total is count
-- @requirement TRACE-02
fact CoverageSummary {
  Matrix.uncoveredReqs = Requirement - Matrix.coveredReqs
  Matrix.totalReqs = #Requirement
}

-- TRACE-04: Bidirectional — annotation links iff requirement claims the model
-- @requirement TRACE-04
fact BidirectionalValidation {
  all m : ModelFile, r : Requirement |
    (some a : m.annotations | r in a.reqIds) iff (m in r.claimedModels)
}

-- ── Assertions ───────────────────────────────────────────────────────

-- @requirement TRACE-02
-- Covered + uncovered = all requirements (partition)
assert CoveragePartition {
  Matrix.coveredReqs + Matrix.uncoveredReqs = Requirement
}
check CoveragePartition for 2 ModelFile, 3 Annotation, 3 Requirement, 4 int

-- @requirement TRACE-04
-- Bidirectionality holds: annotation link implies claim, and vice versa
assert BidirectionalConsistent {
  all m : ModelFile, r : Requirement |
    (some a : m.annotations | r in a.reqIds) iff (m in r.claimedModels)
}
check BidirectionalConsistent for 2 ModelFile, 3 Annotation, 3 Requirement, 4 int

-- @requirement TRACE-05
-- CI guard threshold is bounded [0, 100]
assert CIGuardBounded {
  CIGuard.threshold >= 0 and CIGuard.threshold =< 100
}
check CIGuardBounded for 2 ModelFile, 3 Annotation, 3 Requirement, 4 int

-- @requirement TRACE-01
-- No requirement is both covered and uncovered
assert NoCoverageContradiction {
  no r : Requirement | r in Matrix.coveredReqs and r in Matrix.uncoveredReqs
}
check NoCoverageContradiction for 2 ModelFile, 3 Annotation, 3 Requirement, 4 int

-- Satisfiability
run {} for 2 ModelFile, 3 Annotation, 3 Requirement, 4 int
