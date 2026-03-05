-- .formal/alloy/decomp-cross-model.als
-- Models cross-model decomposition analysis for state-space reduction.
-- Source: bin/analyze-state-space.cjs
--
-- @requirement DECOMP-05

module decomp_cross_model

abstract sig Bool {}
one sig True, False extends Bool {}

-- Formal model with state-space properties
sig FormalModel {
  sourceFiles: set SourceFile,
  reqPrefix: one RequirementPrefix,
  stateSpaceSize: one Int
}

sig SourceFile {}
sig RequirementPrefix {}

-- Model pair sharing sources or prefix
sig ModelPair {
  modelA: one FormalModel,
  modelB: one FormalModel,
  sharesSource: one Bool,
  sharesPrefix: one Bool,
  mergedEstimate: one Int
}

-- DECOMP-05: Identify model pairs sharing sources or prefixes
-- @requirement DECOMP-05
fact PairDetection {
  all p: ModelPair | {
    p.modelA != p.modelB
    p.sharesSource = True implies
      some (p.modelA.sourceFiles & p.modelB.sourceFiles)
    p.sharesPrefix = True implies
      p.modelA.reqPrefix = p.modelB.reqPrefix
  }
}

-- Merged estimate non-negative
fact ValidEstimates {
  all p: ModelPair | p.mergedEstimate >= 0
  all m: FormalModel | m.stateSpaceSize >= 0
}

assert SharedDetected {
  all p: ModelPair |
    (some (p.modelA.sourceFiles & p.modelB.sourceFiles))
      implies p.sharesSource = True
}

check SharedDetected for 4
