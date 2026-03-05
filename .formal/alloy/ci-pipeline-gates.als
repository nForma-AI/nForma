-- .formal/alloy/ci-pipeline-gates.als
-- Models CI/CD pipeline gate structure: tests, lint, typecheck must pass before merge.
-- Source: .github/workflows/
--
-- @requirement CI-01
-- @requirement CI-02
-- @requirement CI-03

module ci_pipeline_gates

abstract sig GateStatus {}
one sig Pass, Fail extends GateStatus {}

-- @requirement CI-01
one sig TestGate {
  status: one GateStatus
}

-- @requirement CI-02
one sig LintGate {
  status: one GateStatus
}

-- @requirement CI-03
one sig TypeCheckGate {
  status: one GateStatus
}

one sig Pipeline {
  mergeAllowed: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement CI-01
-- @requirement CI-02
-- @requirement CI-03
-- Merge is blocked unless all gates pass
fact MergeRequiresAllGates {
  Pipeline.mergeAllowed = True iff
    (TestGate.status = Pass and LintGate.status = Pass and TypeCheckGate.status = Pass)
}

run {} for 3

-- @requirement CI-01
assert TestFailBlocksMerge {
  TestGate.status = Fail implies Pipeline.mergeAllowed = False
}
check TestFailBlocksMerge for 3

-- @requirement CI-02
assert LintFailBlocksMerge {
  LintGate.status = Fail implies Pipeline.mergeAllowed = False
}
check LintFailBlocksMerge for 3

-- @requirement CI-03
assert TypeCheckFailBlocksMerge {
  TypeCheckGate.status = Fail implies Pipeline.mergeAllowed = False
}
check TypeCheckFailBlocksMerge for 3
