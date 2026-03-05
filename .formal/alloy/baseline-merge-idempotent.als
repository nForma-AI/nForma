-- .formal/alloy/baseline-merge-idempotent.als
-- Models idempotent merge of baseline requirements into requirements.json.
-- Source: bin/requirements-core.cjs, bin/sync-baseline-requirements.cjs
--
-- @requirement INST-12

module baseline_merge_idempotent

sig ReqText {}

-- @requirement INST-12
sig Requirement {
  text: one ReqText
}

-- The envelope before and after merge
-- @requirement INST-12
one sig BeforeMerge {
  reqs: set Requirement
}
one sig AfterMerge {
  reqs: set Requirement
}
one sig BaselineInput {
  reqs: set Requirement
}

-- @requirement INST-12
-- Match-on-text: baseline reqs with same text as existing are not duplicated
fact IdempotentMerge {
  -- After merge contains all originals
  BeforeMerge.reqs in AfterMerge.reqs
  -- After merge contains all baseline that don't match existing text
  all b : BaselineInput.reqs |
    (some e : BeforeMerge.reqs | e.text = b.text) or b in AfterMerge.reqs
  -- No duplicates by text
  all r1, r2 : AfterMerge.reqs |
    r1 != r2 implies r1.text != r2.text
}

-- @requirement INST-12
-- Double-merge produces same result (idempotent)
one sig DoubleMerge {
  reqs: set Requirement
}
fact DoubleIsIdempotent {
  DoubleMerge.reqs = AfterMerge.reqs
}

run {} for 5

-- @requirement INST-12
assert MergeIsIdempotent {
  DoubleMerge.reqs = AfterMerge.reqs
}
check MergeIsIdempotent for 6
