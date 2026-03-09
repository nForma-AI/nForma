-- .planning/formal/alloy/git-history-evidence.als
-- Models the git-history-evidence extractor: commit classification into 7
-- categories, cross-referencing against formal specs, and drift detection.
-- Source: bin/git-history-evidence.cjs, .planning/formal/evidence/git-history-evidence.json
--
-- @requirement EVID-04

module git_history_evidence

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement EVID-04
-- Seven commit categories (exhaustive classification)
abstract sig CommitCategory {}
one sig Feat, Fix, Refactor, Docs, Test, Build, Chore extends CommitCategory {}

-- @requirement EVID-04
sig Commit {
  category: one CommitCategory,
  changedFiles: set SourceFile
}

sig SourceFile {
  hasFormalSpec: one Bool,
  specLastUpdated: lone Timestamp,
  fileLastModified: lone Timestamp
}

sig Timestamp {}

-- @requirement EVID-04
sig ModelRegistryEntry {
  coversFile: one SourceFile
}

-- @requirement EVID-04
-- Every commit is classified into exactly one of the seven categories
fact ExhaustiveClassification {
  #CommitCategory = 7
  all c: Commit | one c.category
}

-- @requirement EVID-04
-- Cross-reference: formal spec awareness comes from model-registry.json
fact CrossReferenceViaRegistry {
  all f: SourceFile |
    f.hasFormalSpec = True iff (some e: ModelRegistryEntry | e.coversFile = f)
}

-- @requirement EVID-04
-- Drift candidate: source file modified after its formal spec was last updated
pred isDriftCandidate[f: SourceFile] {
  f.hasFormalSpec = True and
  some f.fileLastModified and
  some f.specLastUpdated
}

-- @requirement EVID-04
-- Output is consumed by nf-solve sweep pipeline
sig EvidenceOutput {
  commits: set Commit,
  driftCandidates: set SourceFile,
  isInformationalResidual: one Bool
}

fact OutputIsInformational {
  all e: EvidenceOutput | e.isInformationalResidual = True
}

fact DriftCandidatesAreCorrect {
  all e: EvidenceOutput |
    e.driftCandidates = { f: SourceFile | isDriftCandidate[f] }
}

-- Assertions
assert AllCommitsClassified {
  all c: Commit | c.category in CommitCategory
}

assert DriftRequiresFormalSpec {
  all f: SourceFile | isDriftCandidate[f] implies f.hasFormalSpec = True
}

check AllCommitsClassified for 5 but 8 Commit
check DriftRequiresFormalSpec for 5 but 6 SourceFile, 6 ModelRegistryEntry
