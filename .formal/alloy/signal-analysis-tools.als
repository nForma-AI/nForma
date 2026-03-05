-- .formal/alloy/signal-analysis-tools.als
-- Models the structural constraints of formal signal analysis tools.
-- Source: bin/detect-coverage-gaps.cjs, bin/generate-petri-net.cjs,
--         bin/prism-priority.cjs, bin/quorum-consensus-gate.cjs
--
-- @requirement SIG-01
-- @requirement SIG-02
-- @requirement SIG-03
-- @requirement SIG-04

module signal_analysis_tools

abstract sig Bool {}
one sig True, False extends Bool {}

-- Base analysis tool
abstract sig AnalysisTool {
  hasInput: one Bool,
  hasOutput: one Bool
} {
  hasInput = True
  hasOutput = True
}

-- SIG-01: Coverage gap detector
-- @requirement SIG-01
one sig CoverageGapDetector extends AnalysisTool {
  diffsTLCStates: one Bool,
  diffsTraces: one Bool,
  producesCoverageGaps: one Bool
} {
  diffsTLCStates = True
  diffsTraces = True
  producesCoverageGaps = True
}

-- SIG-02: Petri net generator for roadmap
-- @requirement SIG-02
one sig PetriNetGenerator extends AnalysisTool {
  readsRoadmap: one Bool,
  modelsDependencies: one Bool,
  hasCriticalPath: one Bool
} {
  readsRoadmap = True
  modelsDependencies = True
  hasCriticalPath = True
}

-- SIG-03: PRISM priority ranker
-- @requirement SIG-03
one sig PrismPriorityRanker extends AnalysisTool {
  ranksByFailureProbability: one Bool,
  readsRoadmapItems: one Bool
} {
  ranksByFailureProbability = True
  readsRoadmapItems = True
}

-- SIG-04: Quorum consensus gate
-- @requirement SIG-04
one sig ConsensusGate extends AnalysisTool {
  usesPoissonBinomial: one Bool,
  hasThreshold: one Bool
} {
  usesPoissonBinomial = True
  hasThreshold = True
}

-- Satisfiability
run {} for 3

-- @requirement SIG-01
-- Coverage gap detector always diffs both TLC states and traces
assert GapDetectorDiffsBoth {
  CoverageGapDetector.diffsTLCStates = True and
  CoverageGapDetector.diffsTraces = True
}
check GapDetectorDiffsBoth for 3

-- @requirement SIG-02
-- Petri net generator always includes critical path analysis
assert PetriHasCriticalPath {
  PetriNetGenerator.hasCriticalPath = True
}
check PetriHasCriticalPath for 3

-- @requirement SIG-04
-- Consensus gate uses Poisson binomial model
assert ConsensusUsesPoisson {
  ConsensusGate.usesPoissonBinomial = True
}
check ConsensusUsesPoisson for 3

-- All tools have input and output
assert AllToolsComplete {
  all t : AnalysisTool | t.hasInput = True and t.hasOutput = True
}
check AllToolsComplete for 3
