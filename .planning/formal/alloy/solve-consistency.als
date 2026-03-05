-- .formal/alloy/solve-consistency.als
-- Models the consistency solver's layer transition sweep structure.
-- Source: bin/qgsd-solve.cjs, commands/qgsd/solve.md
--
-- @requirement SOLVE-01
-- @requirement SOLVE-02

module solve_consistency

abstract sig Bool {}
one sig True, False extends Bool {}

-- Layer transitions in the solver
abstract sig LayerTransition {
  hasResidual: one Bool
}
one sig RtoF, FtoT, CtoF, TtoC, FtoC, RtoD, DtoC extends LayerTransition {}

-- Solver iteration state
sig SolverIteration {
  sweepComplete: one Bool,
  autoCloseRan: one Bool,
  residualTotal: one Int,
  formalTestCacheCleared: one Bool
}

-- SOLVE-01: Solver sweeps all 7 layer transitions
-- @requirement SOLVE-01
fact AllLayersSwept {
  #LayerTransition = 7
  RtoF + FtoT + CtoF + TtoC + FtoC + RtoD + DtoC = LayerTransition
}

-- SOLVE-02: Cache cleared at each iteration
-- @requirement SOLVE-02
fact CacheClearedPerIteration {
  all it: SolverIteration |
    it.sweepComplete = True implies it.formalTestCacheCleared = True
}

-- Convergence: residual non-negative
fact ResidualNonNegative {
  all it: SolverIteration |
    it.residualTotal >= 0 or it.residualTotal = -1 -- -1 = error sentinel
}

-- Auto-close only runs after sweep
fact AutoCloseAfterSweep {
  all it: SolverIteration |
    it.autoCloseRan = True implies it.sweepComplete = True
}

-- Assertions
assert SweepCoversAllLayers {
  #LayerTransition = 7
}

assert CacheAlwaysCleared {
  all it: SolverIteration |
    it.sweepComplete = True implies it.formalTestCacheCleared = True
}

check SweepCoversAllLayers for 7
check CacheAlwaysCleared for 7
