-- .formal/alloy/baseline-requirements-filter.als
-- Models the baseline requirements filtering by project profile with opt-out.
-- Source: bin/requirements-core.cjs
--
-- @requirement INIT-01

module baseline_requirements_filter

-- Project profiles
abstract sig Profile {}
one sig Web, Mobile, Desktop, Api, Cli, Library extends Profile {}

-- A baseline requirement has applicable profiles
-- @requirement INIT-01
sig BaselineReq {
  applicableTo: set Profile,
  optedOut: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- The active project has one profile
-- @requirement INIT-01
one sig Project {
  profile: one Profile,
  selectedReqs: set BaselineReq
}

-- @requirement INIT-01
-- Selected requirements are profile-filtered minus opt-outs
fact FilterByProfile {
  Project.selectedReqs = { r : BaselineReq |
    Project.profile in r.applicableTo and r.optedOut = False
  }
}

-- @requirement INIT-01
-- Every baseline req applies to at least one profile
fact AtLeastOneProfile {
  all r : BaselineReq | #r.applicableTo > 0
}

-- Satisfiability
run {} for 6 BaselineReq, 6 Profile

-- @requirement INIT-01
-- Opted-out requirements are never in selected set
assert OptOutExcludes {
  all r : BaselineReq |
    r.optedOut = True implies r not in Project.selectedReqs
}
check OptOutExcludes for 8 BaselineReq, 6 Profile

-- @requirement INIT-01
-- Non-applicable requirements are never selected
assert ProfileFilterWorks {
  all r : Project.selectedReqs |
    Project.profile in r.applicableTo
}
check ProfileFilterWorks for 8 BaselineReq, 6 Profile
