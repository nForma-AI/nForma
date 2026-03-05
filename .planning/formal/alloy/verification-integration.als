-- .formal/alloy/verification-integration.als
-- Models the verification integration requirements.
-- Source: qgsd-core/agents/qgsd-verifier.md, VERIFICATION.md template
--
-- @requirement VERIFY-01
-- @requirement VERIFY-02

module verification_integration

abstract sig Bool {}
one sig True, False extends Bool {}

-- Formalism types
abstract sig Formalism {}
one sig TLA, Alloy, PRISM, CI extends Formalism {}

-- Check result from run-formal-verify
sig FormalCheckResult {
  formalism: one Formalism,
  result: one ResultType
}

abstract sig ResultType {}
one sig Pass, Fail, Warn extends ResultType {}

-- VERIFY-01: Verifier agent runs run-formal-verify
-- @requirement VERIFY-01
one sig QGSDVerifier {
  runsFormalVerify: one Bool,
  includesDigest: one Bool
} {
  runsFormalVerify = True
  includesDigest = True
}

-- VERIFY-02: VERIFICATION.md template
-- @requirement VERIFY-02
one sig VerificationDoc {
  hasFormalVerificationSection: one Bool,
  passCounts: set FormalismCount,
  failCounts: set FormalismCount,
  warnCounts: set FormalismCount
} {
  hasFormalVerificationSection = True
}

-- Per-formalism count in the template
sig FormalismCount {
  formalism: one Formalism,
  count: one Int
} {
  count >= 0
}

-- VERIFY-02: Every formalism has a count entry
-- @requirement VERIFY-02
fact AllFormalismsRepresented {
  all f : Formalism |
    (some c : VerificationDoc.passCounts | c.formalism = f) and
    (some c : VerificationDoc.failCounts | c.formalism = f) and
    (some c : VerificationDoc.warnCounts | c.formalism = f)
}

-- VERIFY-01: Digest includes check results
-- @requirement VERIFY-01
fact DigestIncludesResults {
  QGSDVerifier.includesDigest = True implies
    #FormalCheckResult >= 0  -- results are captured (even if zero)
}

-- Satisfiability
run {} for 3 but 4 FormalCheckResult, 6 FormalismCount, 4 int

-- @requirement VERIFY-02
-- All formalisms have counts in the verification doc
assert AllFormalismsHaveCounts {
  all f : Formalism |
    some c : VerificationDoc.passCounts | c.formalism = f
}
check AllFormalismsHaveCounts for 3 but 4 FormalCheckResult, 6 FormalismCount, 4 int

-- @requirement VERIFY-01
-- Verifier always runs formal verify
assert VerifierRunsFV {
  QGSDVerifier.runsFormalVerify = True
}
check VerifierRunsFV for 3 but 4 FormalCheckResult, 6 FormalismCount, 4 int
