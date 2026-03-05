-- .formal/alloy/schema-extensions.als
-- Models schema extensions: model-registry requirements array,
-- check-result requirement_ids, SCHEMA-03 runner emission, SCHEMA-04 formal_models.
-- Source: .formal/model-registry.json, check-result.schema.json, requirements.json
--
-- @requirement SCHEMA-01
-- @requirement SCHEMA-02
-- @requirement SCHEMA-03
-- @requirement SCHEMA-04

module schema_extensions

-- Requirements
sig Requirement {
  -- SCHEMA-04: requirement has optional formal_models array
  formalModels: set ModelFile
}

-- Formal model files (TLA+, Alloy, PRISM)
sig ModelFile {
  -- SCHEMA-01: model-registry entry has requirements array
  registryReqs: set Requirement
}

-- Check results emitted by verification runners
sig CheckResult {
  model: one ModelFile,
  -- SCHEMA-02: check-result gains requirement_ids array
  resultReqIds: set Requirement,
  passed: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- SCHEMA-01: Registry requirements are non-empty for meaningful models
-- @requirement SCHEMA-01
fact RegistryReqsFromModels {
  all m : ModelFile | #m.registryReqs > 0
}

-- SCHEMA-03: Runners emit requirement_ids extracted from registry or annotations
-- @requirement SCHEMA-03
fact RunnerEmitsReqs {
  all c : CheckResult |
    c.resultReqIds = c.model.registryReqs
}

-- SCHEMA-04: Bidirectional link — if model claims req, req claims model
-- @requirement SCHEMA-04
fact BidirectionalLink {
  all m : ModelFile, r : Requirement |
    r in m.registryReqs iff m in r.formalModels
}

run {} for 4 Requirement, 3 ModelFile, 5 CheckResult, 4 int

-- @requirement SCHEMA-01
assert RegistryNonEmpty {
  all m : ModelFile | #m.registryReqs > 0
}
check RegistryNonEmpty for 4 Requirement, 3 ModelFile, 5 CheckResult, 4 int

-- @requirement SCHEMA-04
assert BidirectionalConsistency {
  all m : ModelFile, r : Requirement |
    (r in m.registryReqs) iff (m in r.formalModels)
}
check BidirectionalConsistency for 4 Requirement, 3 ModelFile, 5 CheckResult, 4 int

-- @requirement SCHEMA-02
-- @requirement SCHEMA-03
assert CheckResultsMatchRegistry {
  all c : CheckResult |
    c.resultReqIds = c.model.registryReqs
}
check CheckResultsMatchRegistry for 4 Requirement, 3 ModelFile, 5 CheckResult, 4 int
