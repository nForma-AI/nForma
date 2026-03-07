-- .planning/formal/alloy/gate-a-scoping.als
-- Models the --base-ref scoping behavior of gate-a-grounding.cjs:
-- when a base-ref is provided, grounding analysis is scoped to changed files
-- while still reporting the global score as informational.
-- Source: bin/gate-a-grounding.cjs
--
-- @requirement GATE-01

module gate_a_scoping

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── GATE-01: Base-ref scoping ────────────────────────────────────

-- @requirement GATE-01
sig Action {
  inChangedFiles: one Bool
}

-- @requirement GATE-01
sig GroundingRun {
  baseRefProvided: one Bool,
  actions: set Action,
  scopedActions: set Action,
  scopedScore: one Score,
  globalScore: one Score,
  scopedEnforced: one Bool,
  globalEnforced: one Bool
}

sig Score {
  meetsThreshold: one Bool
}

-- @requirement GATE-01
-- When base-ref is provided, scoped subset = actions from changed files
fact ScopedSubsetIsChangedFiles {
  all r: GroundingRun |
    r.baseRefProvided = True implies
      r.scopedActions = { a: r.actions | a.inChangedFiles = True }
}

-- @requirement GATE-01
-- When no base-ref, scoped = all actions (no filtering)
fact NoBaseRefMeansAllActions {
  all r: GroundingRun |
    r.baseRefProvided = False implies
      r.scopedActions = r.actions
}

-- @requirement GATE-01
-- 80% target enforced on scoped subset
fact ScopedTargetEnforced {
  all r: GroundingRun |
    r.baseRefProvided = True implies
      r.scopedEnforced = True
}

-- @requirement GATE-01
-- Global score is informational only when base-ref is provided
fact GlobalIsInformational {
  all r: GroundingRun |
    r.baseRefProvided = True implies
      r.globalEnforced = False
}

-- @requirement GATE-01
-- Without base-ref, global score is enforced
fact NoBaseRefGlobalEnforced {
  all r: GroundingRun |
    r.baseRefProvided = False implies
      r.globalEnforced = True
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement GATE-01
assert ScopedSubsetCorrect {
  all r: GroundingRun |
    r.baseRefProvided = True implies
      (all a: r.scopedActions | a.inChangedFiles = True) and
      (all a: r.actions | a.inChangedFiles = True implies a in r.scopedActions)
}
check ScopedSubsetCorrect for 3 but exactly 1 GroundingRun, 2 Score

-- @requirement GATE-01
assert GlobalNeverEnforcedWithBaseRef {
  all r: GroundingRun |
    r.baseRefProvided = True implies r.globalEnforced = False
}
check GlobalNeverEnforcedWithBaseRef for 3 but exactly 1 GroundingRun, 2 Score

-- @requirement GATE-01
assert ScopedAlwaysEnforcedWithBaseRef {
  all r: GroundingRun |
    r.baseRefProvided = True implies r.scopedEnforced = True
}
check ScopedAlwaysEnforcedWithBaseRef for 3 but exactly 1 GroundingRun, 2 Score
