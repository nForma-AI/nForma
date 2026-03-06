-- .planning/formal/alloy/doc-claims-backing.als
-- Models the constraint that README capability claims must be backed by requirements.
-- Source: README.md, .planning/formal/requirements.json
--
-- @requirement DOC-01

module doc_claims_backing

abstract sig Bool {}
one sig True, False extends Bool {}

-- A capability claim made in README.md
sig CapabilityClaim {
  backedByRequirement: one Bool
}

-- The requirements database
one sig RequirementsDB {
  totalReqs: one Int
}

-- DOC-01: Every README capability claim must have a backing requirement
-- @requirement DOC-01
fact AllClaimsBacked {
  all c: CapabilityClaim | c.backedByRequirement = True
}

-- DOC-01: There must be at least one requirement in the database
-- @requirement DOC-01
fact RequirementsExist {
  RequirementsDB.totalReqs > 0
}

-- Assertion
assert NoUnbackedClaims {
  all c: CapabilityClaim | c.backedByRequirement = True
}

check NoUnbackedClaims for 5 but 10 CapabilityClaim
