-- .planning/formal/alloy/solve-automation-features.als
-- Models the solve diagnostic engine's automation features:
-- fast mode, FP suppression, Category B auto-ack, recipe sidecars.
-- Source: bin/qgsd-solve.cjs, bin/formal-test-sync.cjs
--
-- @requirement SOLVE-09

module solve_automation_features

abstract sig Bool {}
one sig True, False extends Bool {}

-- Solver execution mode
one sig SolverConfig {
  fastMode: one Bool,
  fpSuppressionEnabled: one Bool,
  catBAutoAck: one Bool
}

-- Layer transitions
abstract sig Layer {}
one sig FtoC, TtoC, RtoF, FtoT, CtoF, RtoD, DtoC extends Layer {}

-- Which layers are skipped in fast mode
fun fastSkippedLayers : set Layer {
  FtoC + TtoC
}

-- SOLVE-09: Fast mode skips F->C and T->C
-- @requirement SOLVE-09
fact FastModeSkipsExpensiveLayers {
  SolverConfig.fastMode = True implies
    fastSkippedLayers = FtoC + TtoC
}

-- D->C false positive suppression
sig DtoCClaim {
  matchesFpPattern: one Bool,
  suppressed: one Bool
}

-- SOLVE-09: Pattern-matched D->C claims are suppressed
-- @requirement SOLVE-09
fact FpPatternSuppression {
  SolverConfig.fpSuppressionEnabled = True implies
    (all c: DtoCClaim | c.matchesFpPattern = True implies c.suppressed = True)
}

-- Non-matching claims are NOT suppressed
fact NonMatchingNotSuppressed {
  all c: DtoCClaim |
    c.matchesFpPattern = False implies c.suppressed = False
}

-- Reverse discovery candidates
abstract sig CandidateCategory {}
one sig CategoryA, CategoryB extends CandidateCategory {}

sig ReverseCandidate {
  category: one CandidateCategory,
  autoAcknowledged: one Bool
}

-- SOLVE-09: Category B auto-acknowledged
-- @requirement SOLVE-09
fact CategoryBAutoAck {
  SolverConfig.catBAutoAck = True implies
    (all c: ReverseCandidate | c.category = CategoryB implies c.autoAcknowledged = True)
}

-- Category A never auto-acknowledged (requires human)
fact CategoryANotAutoAck {
  all c: ReverseCandidate |
    c.category = CategoryA implies c.autoAcknowledged = False
}

-- Recipe sidecars with absolute paths
sig RecipeSidecar {
  hasAbsolutePaths: one Bool,
  hasTestTemplate: one Bool
}

-- SOLVE-09: Recipe sidecars have absolute paths and templates
-- @requirement SOLVE-09
fact RecipeSidecarsComplete {
  all r: RecipeSidecar |
    r.hasAbsolutePaths = True and r.hasTestTemplate = True
}

-- Assertions
assert FastModeOnlySkipsTwoLayers {
  #fastSkippedLayers = 2
}

assert FpSuppressionCorrect {
  SolverConfig.fpSuppressionEnabled = True implies
    (all c: DtoCClaim | c.matchesFpPattern = True implies c.suppressed = True)
}

assert CategoryBAlwaysAutoAcked {
  SolverConfig.catBAutoAck = True implies
    (all c: ReverseCandidate | c.category = CategoryB implies c.autoAcknowledged = True)
}

assert CategoryANeverAutoAcked {
  all c: ReverseCandidate | c.category = CategoryA implies c.autoAcknowledged = False
}

assert RecipeSidecarsHaveAbsPaths {
  all r: RecipeSidecar | r.hasAbsolutePaths = True
}

check FastModeOnlySkipsTwoLayers for 5
check FpSuppressionCorrect for 5 but 8 DtoCClaim
check CategoryBAlwaysAutoAcked for 5 but 8 ReverseCandidate
check CategoryANeverAutoAcked for 5 but 8 ReverseCandidate
check RecipeSidecarsHaveAbsPaths for 5 but 8 RecipeSidecar
