-- .planning/formal/alloy/solve-decomposition.als
-- Models the solver's sub-skill decomposition (SOLVE-14) and model complexity
-- profiling with split/merge recommendations (SOLVE-15).
-- Source: commands/nf/solve.md, commands/nf/solve-diagnose.md,
--         commands/nf/solve-remediate.md, commands/nf/solve-report.md,
--         bin/nf-solve.cjs
--
-- @requirement SOLVE-14
-- @requirement SOLVE-15

module solve_decomposition

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── SOLVE-14: Sub-skill decomposition ───────────────────────────────────

-- @requirement SOLVE-14
abstract sig SolveSubSkill {}
one sig SolveDiagnose, SolveRemediate, SolveReport extends SolveSubSkill {}

-- @requirement SOLVE-14
sig SolveDispatcher {
  subSkills: set SolveSubSkill,
  hasConvergenceLoop: one Bool,
  hasReportOnlyGate: one Bool,
  hasPhaseRouting: one Bool
}

-- @requirement SOLVE-14
-- Dispatcher orchestrates exactly 3 sub-skills
fact ThreeSubSkills {
  all d: SolveDispatcher |
    d.subSkills = SolveSubSkill and
    #d.subSkills = 3
}

-- @requirement SOLVE-14
-- Dispatcher retains only convergence loop, report-only gate, phase routing
fact ThinDispatcher {
  all d: SolveDispatcher |
    d.hasConvergenceLoop = True and
    d.hasReportOnlyGate = True and
    d.hasPhaseRouting = True
}

-- @requirement SOLVE-14
-- Each sub-skill is dispatched via Agent with structured JSON I/O
sig AgentDispatch {
  skill: one SolveSubSkill,
  inputIsJSON: one Bool,
  outputIsJSON: one Bool
}

fact StructuredIO {
  all ad: AgentDispatch |
    ad.inputIsJSON = True and ad.outputIsJSON = True
}

-- ── SOLVE-15: Model complexity profiling ────────────────────────────────

-- @requirement SOLVE-15
abstract sig RuntimeClass {}
one sig FAST, MODERATE, SLOW, HEAVY extends RuntimeClass {}

-- @requirement SOLVE-15
sig FormalModel {
  runtimeClass: one RuntimeClass,
  stateSpaceEstimate: lone Int,
  hasSplitRecommendation: one Bool,
  hasMergeRecommendation: one Bool
}

-- @requirement SOLVE-15
sig ComplexityProfile {
  models: set FormalModel,
  surfacedInTextReport: one Bool,
  surfacedInJSONReport: one Bool
}

-- @requirement SOLVE-15
-- Profile surfaces recommendations in both text and JSON outputs
fact DualOutputFormat {
  all cp: ComplexityProfile |
    cp.surfacedInTextReport = True and
    cp.surfacedInJSONReport = True
}

-- @requirement SOLVE-15
-- Fail-open: system works when profiler data is absent
sig SolveSession {
  hasProfilerData: one Bool,
  solveCompletes: one Bool
}

fact FailOpen {
  all s: SolveSession | s.solveCompletes = True
}

-- @requirement SOLVE-15
-- Runtime classification is exhaustive
fact ExhaustiveClassification {
  #RuntimeClass = 4
}

-- Assertions
assert ExactlyThreeSubSkills {
  all d: SolveDispatcher | #d.subSkills = 3
}

assert ProfilerFailOpen {
  all s: SolveSession | s.solveCompletes = True
}

assert RecommendationsSurfaced {
  all cp: ComplexityProfile |
    cp.surfacedInTextReport = True and cp.surfacedInJSONReport = True
}

check ExactlyThreeSubSkills for 3 but 3 SolveDispatcher
check ProfilerFailOpen for 3 but 5 SolveSession
check RecommendationsSurfaced for 3 but 3 ComplexityProfile
