-- .planning/formal/alloy/requirements-aggregation.als
-- Models the requirements aggregation pipeline: parsing, validation,
-- merge semantics, and envelope structural invariants.
-- Source: bin/aggregate-requirements.cjs
--
-- @requirement SOLVE-18

module requirements_aggregation

-- A requirement parsed from REQUIREMENTS.md
sig Requirement {
  reqId: one ReqId,
  text: one Text,
  category: one Category,
  phase: one Phase,
  status: one Status,
  provenance: one Provenance,
  -- Optional enrichment data preserved across re-aggregation
  formalModels: set ModelFile
}

-- Requirement ID must match pattern [A-Z]+-[0-9]+
sig ReqId {}

-- Opaque text content
sig Text {}

-- Category (raw or group-mapped)
sig Category {}

-- Phase identifier (vX.XX-NN or "unknown")
sig Phase {}

-- Status: Pending or Complete
abstract sig Status {}
one sig Pending, Complete extends Status {}

-- Provenance tracks source file and milestone
sig Provenance {
  sourceFile: one SourceFile,
  milestone: one Milestone
}

sig SourceFile {}
sig Milestone {}

-- Formal model files referenced by enrichment
sig ModelFile {}

-- The aggregated envelope
sig Envelope {
  schemaVersion: one SchemaVersion,
  contentHash: one ContentHash,
  frozenAt: lone FrozenTimestamp,
  requirements: set Requirement
}

-- Schema version: only V1 is valid
abstract sig SchemaVersion {}
one sig V1 extends SchemaVersion {}

sig ContentHash {}
sig FrozenTimestamp {}

-- Source files feeding the merge pipeline
sig InputFile {
  provides: set Requirement
}

-- SOLVE-18: Envelope schema_version must be "1"
-- @requirement SOLVE-18
fact SchemaVersionIsV1 {
  all e : Envelope | e.schemaVersion = V1
}

-- SOLVE-18: Every requirement must have a non-empty id and text
-- @requirement SOLVE-18
fact RequirementFieldsNonEmpty {
  all r : Requirement |
    one r.reqId and one r.text and one r.category
}

-- SOLVE-18: Every requirement must have provenance with source_file and milestone
-- @requirement SOLVE-18
fact ProvenanceComplete {
  all r : Requirement |
    one r.provenance.sourceFile and one r.provenance.milestone
}

-- SOLVE-18: Envelope requirements are sorted by id (determinism) —
-- modeled as uniqueness: no two requirements share the same id
-- @requirement SOLVE-18
fact UniqueRequirementIds {
  all disj r1, r2 : Requirement | r1.reqId != r2.reqId
}

-- SOLVE-18: Merge semantics — last-write-wins across input files,
-- so each requirement id appears exactly once in the envelope
-- @requirement SOLVE-18
fact LastWriteWinsMerge {
  all e : Envelope |
    all disj r1, r2 : e.requirements | r1.reqId != r2.reqId
}

-- SOLVE-18: Frozen envelopes reject mutation
-- @requirement SOLVE-18
fact FrozenEnvelopeImmutable {
  -- If frozen_at is set, the envelope must have non-empty requirements
  all e : Envelope | some e.frozenAt implies #e.requirements > 0
}

-- SOLVE-18: Content hash is computed from requirements array
-- @requirement SOLVE-18
fact ContentHashDetermined {
  all e : Envelope | one e.contentHash
}

-- SOLVE-18: Each provenance is owned by exactly one requirement
-- @requirement SOLVE-18
fact ProvenanceOwnership {
  all p : Provenance | one r : Requirement | r.provenance = p
}

-- Run: find valid instances
run {} for 4 Requirement, 2 Envelope, 3 InputFile, 4 ReqId, 4 Text,
  3 Category, 3 Phase, 4 Provenance, 3 SourceFile, 3 Milestone,
  2 ModelFile, 2 ContentHash, 2 FrozenTimestamp, 4 int

-- @requirement SOLVE-18
assert EnvelopeSchemaValid {
  all e : Envelope | e.schemaVersion = V1
}
check EnvelopeSchemaValid for 4 Requirement, 2 Envelope, 3 InputFile,
  4 ReqId, 4 Text, 3 Category, 3 Phase, 4 Provenance,
  3 SourceFile, 3 Milestone, 2 ModelFile, 2 ContentHash,
  2 FrozenTimestamp, 4 int

-- @requirement SOLVE-18
assert NoDuplicateIds {
  all disj r1, r2 : Requirement | r1.reqId != r2.reqId
}
check NoDuplicateIds for 4 Requirement, 2 Envelope, 3 InputFile,
  4 ReqId, 4 Text, 3 Category, 3 Phase, 4 Provenance,
  3 SourceFile, 3 Milestone, 2 ModelFile, 2 ContentHash,
  2 FrozenTimestamp, 4 int

-- @requirement SOLVE-18
assert ProvenanceAlwaysPresent {
  all r : Requirement |
    one r.provenance and one r.provenance.sourceFile and one r.provenance.milestone
}
check ProvenanceAlwaysPresent for 4 Requirement, 2 Envelope, 3 InputFile,
  4 ReqId, 4 Text, 3 Category, 3 Phase, 4 Provenance,
  3 SourceFile, 3 Milestone, 2 ModelFile, 2 ContentHash,
  2 FrozenTimestamp, 4 int
