-- .formal/alloy/security-scanning.als
-- Models security scanning pipeline: pre-commit + CI secret scanning,
-- input validation, and dependency vulnerability checks.
-- Source: .github/workflows/, .pre-commit-config.yaml
--
-- @requirement SEC-01
-- @requirement SEC-02
-- @requirement SEC-03
-- @requirement SEC-04

module security_scanning

abstract sig ScanResult {}
one sig Clean, Dirty extends ScanResult {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement SEC-01
-- Pre-commit hook blocks commits with secrets
one sig PreCommitScan {
  result: one ScanResult,
  commitBlocked: one Bool
} {
  result = Dirty implies commitBlocked = True
  result = Clean implies commitBlocked = False
}

-- @requirement SEC-02
-- CI deep scan across repo history
one sig CIDeepScan {
  result: one ScanResult,
  prBlocked: one Bool
} {
  result = Dirty implies prBlocked = True
  result = Clean implies prBlocked = False
}

-- @requirement SEC-03
-- External input validation at system boundaries
sig ExternalInput {
  validated: one Bool,
  sanitized: one Bool
}

fact AllInputValidated {
  all i : ExternalInput | i.validated = True and i.sanitized = True
}

-- @requirement SEC-04
-- Dependency vulnerability scanning
one sig DepScan {
  criticalFindings: one Bool,
  ciBlocked: one Bool
} {
  criticalFindings = True implies ciBlocked = True
}

run {} for 4

-- @requirement SEC-01
assert SecretsBlockCommit {
  PreCommitScan.result = Dirty implies PreCommitScan.commitBlocked = True
}
check SecretsBlockCommit for 3

-- @requirement SEC-02
assert DeepScanBlocksPR {
  CIDeepScan.result = Dirty implies CIDeepScan.prBlocked = True
}
check DeepScanBlocksPR for 3

-- @requirement SEC-04
assert CriticalDepsBlock {
  DepScan.criticalFindings = True implies DepScan.ciBlocked = True
}
check CriticalDepsBlock for 3
