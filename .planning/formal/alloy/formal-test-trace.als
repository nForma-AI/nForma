-- .formal/alloy/formal-test-trace.als
-- Models the formal-test-sync cross-referencing structure.
-- Source: bin/formal-test-sync.cjs, commands/qgsd/formal-test-sync.md
--
-- @requirement TRACE-06

module formal_test_trace

abstract sig Bool {}
one sig True, False extends Bool {}

-- Formal model invariant
sig FormalInvariant {
  requirementId: one RequirementId,
  hasTestBacking: one Bool
}

sig RequirementId {}

-- Unit test covering an invariant
sig UnitTest {
  coversInvariant: one FormalInvariant
}

-- Constants validation entry
sig ConstantEntry {
  formalValue: one Int,
  configValue: one Int,
  matches: one Bool,
  intentionalDivergence: one Bool
}

-- TRACE-06: formal-test-sync cross-references invariants with test coverage
-- @requirement TRACE-06
fact CrossReference {
  all inv: FormalInvariant |
    inv.hasTestBacking = True iff
      some t: UnitTest | t.coversInvariant = inv
}

-- Constants match check
fact ConstantMatchLogic {
  all c: ConstantEntry |
    c.matches = True iff c.formalValue = c.configValue
}

assert TestBackingConsistent {
  all inv: FormalInvariant |
    (some t: UnitTest | t.coversInvariant = inv) implies
      inv.hasTestBacking = True
}

check TestBackingConsistent for 5
