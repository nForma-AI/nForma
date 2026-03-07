-- .planning/formal/alloy/spec-quality-guardrails.als
-- Models formal specification quality guardrails: no tautological assertions,
-- bounded TLA+ domains, and per-sig Alloy scopes.
-- Source: bin/run-formal-verify.cjs, .planning/formal/alloy/*.als, .planning/formal/tla/*.tla
--
-- @requirement SPEC-06

module spec_quality_guardrails

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── SPEC-06: Formal model quality constraints ────────────────────

-- @requirement SPEC-06
abstract sig Formalism {}
one sig TLAPlus, Alloy extends Formalism {}

-- @requirement SPEC-06
sig Assertion {
  formalism: one Formalism,
  isTautological: one Bool
}

-- @requirement SPEC-06
sig TypeOKDomain {
  formalism: one Formalism,
  isBounded: one Bool
}

-- @requirement SPEC-06
sig CheckCommand {
  formalism: one Formalism,
  usesPerSigScope: one Bool,
  sig_hierarchy: set Sig
}

sig Sig {
  parent: lone Sig
}

-- @requirement SPEC-06
-- No Alloy assertion may be tautological (P=>P, x=x patterns)
fact NoTautologicalAssertions {
  all a: Assertion | a.isTautological = False
}

-- @requirement SPEC-06
-- All TLA+ TypeOK domains must use bounded ranges (no raw Nat/Int)
fact BoundedTypeOKDomains {
  all d: TypeOKDomain |
    d.formalism = TLAPlus implies d.isBounded = True
}

-- @requirement SPEC-06
-- All Alloy check commands must use per-sig scopes matching hierarchy
fact PerSigScopes {
  all c: CheckCommand |
    c.formalism = Alloy implies c.usesPerSigScope = True
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement SPEC-06
assert NoTautologies {
  no a: Assertion | a.isTautological = True
}
check NoTautologies for 5 but 3 Assertion, 2 TypeOKDomain, 2 CheckCommand, 2 Sig

-- @requirement SPEC-06
assert AllTLADomainsBounded {
  all d: TypeOKDomain |
    d.formalism = TLAPlus implies d.isBounded = True
}
check AllTLADomainsBounded for 5 but 3 Assertion, 3 TypeOKDomain, 2 CheckCommand, 2 Sig

-- @requirement SPEC-06
assert AllAlloyChecksPerSig {
  all c: CheckCommand |
    c.formalism = Alloy implies c.usesPerSigScope = True
}
check AllAlloyChecksPerSig for 5 but 2 Assertion, 2 TypeOKDomain, 3 CheckCommand, 3 Sig
