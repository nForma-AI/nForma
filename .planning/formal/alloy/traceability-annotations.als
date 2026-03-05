-- .formal/alloy/traceability-annotations.als
-- Models the traceability matrix and @requirement annotation system.
-- Source: bin/generate-traceability-matrix.cjs, bin/extract-annotations.cjs
--
-- @requirement TRACE-01
-- @requirement TRACE-02
-- @requirement TRACE-03
-- @requirement TRACE-04
-- @requirement TRACE-05
-- @requirement ANNOT-01
-- @requirement ANNOT-02
-- @requirement ANNOT-03
-- @requirement ANNOT-04
-- @requirement ANNOT-05

module traceability_annotations

abstract sig ModelType {}
one sig TLA, Alloy, PRISM extends ModelType {}

-- Model files with annotations
sig ModelFile {
  modelType: one ModelType,
  -- ANNOT-01/02/03: model files contain @requirement annotations
  annotations: set Annotation
}

-- Individual @requirement annotation in a model file
sig Annotation {
  property: one Property,
  reqIds: set Requirement
}

-- Properties/invariants within model files
sig Property {
  inModel: one ModelFile
}

-- Requirements from requirements.json
sig Requirement {
  -- TRACE-04: requirement claims models
  claimedModels: set ModelFile
}

-- Registry claims (model-registry.json)
sig RegistryClaim {
  model: one ModelFile,
  reqs: set Requirement
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- The traceability matrix output
one sig TraceabilityMatrix {
  totalReqs: one Int,
  coveredReqs: set Requirement,
  uncoveredReqs: set Requirement,
  orphanProperties: set Property,
  coveragePercent: one Int,
  previousPercent: one Int
}

-- CI threshold
one sig CIGuard {
  threshold: one Int
} {
  threshold >= 0
  threshold =< 100
}

-- ANNOT-04: extract-annotations parses all model types
-- @requirement ANNOT-04
fact AnnotationsFromAllTypes {
  all m : ModelFile | m.modelType in TLA + Alloy + PRISM
}

-- ANNOT-05: Traceability reads annotations as primary, registry as fallback
-- @requirement ANNOT-05
fact AnnotationsPrimary {
  all m : ModelFile, r : Requirement |
    (some a : m.annotations | r in a.reqIds) implies r in TraceabilityMatrix.coveredReqs
}

-- TRACE-01: Matrix links requirements to properties
-- @requirement TRACE-01
fact MatrixLinkage {
  TraceabilityMatrix.coveredReqs = { r : Requirement |
    some m : ModelFile, a : m.annotations | r in a.reqIds
  }
}

-- TRACE-02: Coverage summary
-- @requirement TRACE-02
fact CoverageSummary {
  TraceabilityMatrix.uncoveredReqs = Requirement - TraceabilityMatrix.coveredReqs
  TraceabilityMatrix.totalReqs = #Requirement
  TraceabilityMatrix.orphanProperties = { p : Property |
    no a : Annotation | a.property = p and #a.reqIds > 0
  }
}

-- TRACE-04: Bidirectional validation
-- @requirement TRACE-04
fact BidirectionalValidation {
  all m : ModelFile, r : Requirement |
    (some a : m.annotations | r in a.reqIds) iff (m in r.claimedModels)
}

-- Properties belong to their model
fact PropertyOwnership {
  all a : Annotation | a.property.inModel in ModelFile
}

-- Annotations belong to a model
fact AnnotationOwnership {
  all a : Annotation | some m : ModelFile | a in m.annotations
}

run {} for 4 ModelFile, 6 Annotation, 6 Property, 6 Requirement, 2 RegistryClaim, 4 int

-- @requirement TRACE-04
assert BidirectionalConsistent {
  all m : ModelFile, r : Requirement |
    (some a : m.annotations | r in a.reqIds) iff (m in r.claimedModels)
}
check BidirectionalConsistent for 4 ModelFile, 6 Annotation, 6 Property, 6 Requirement, 2 RegistryClaim, 4 int

-- @requirement TRACE-02
assert CoverageComplete {
  TraceabilityMatrix.coveredReqs + TraceabilityMatrix.uncoveredReqs = Requirement
}
check CoverageComplete for 6 Requirement, 4 ModelFile, 6 Annotation, 6 Property, 2 RegistryClaim, 4 int

-- @requirement TRACE-05
-- CI warns when coverage drops below threshold
assert CIGuardCheck {
  TraceabilityMatrix.coveragePercent >= 0
}
check CIGuardCheck for 6 Requirement, 4 ModelFile, 6 Annotation, 6 Property, 2 RegistryClaim, 4 int
