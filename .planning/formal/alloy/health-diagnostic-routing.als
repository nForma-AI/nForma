-- .planning/formal/alloy/health-diagnostic-routing.als
-- Models the observe handler routing for nf:health diagnostic codes,
-- including severity mapping and QGSD source repo gating.
-- Source: bin/observe-handlers/*.cjs, core/bin/gsd-tools.cjs
--
-- @requirement OBS-16

module health_diagnostic_routing

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement OBS-16
-- Diagnostic code prefixes map to severity
abstract sig DiagnosticPrefix {}
one sig ErrorCode, WarningCode, InfoCode extends DiagnosticPrefix {}

-- @requirement OBS-16
sig DiagnosticCode {
  prefix: one DiagnosticPrefix,
  description: one CodeDescription
}
sig CodeDescription {}

-- @requirement OBS-16
abstract sig Severity {}
one sig High, Medium, Low extends Severity {}

-- @requirement OBS-16
sig ObserveIssue {
  fromDiagnostic: one DiagnosticCode,
  severity: one Severity,
  source: one IssueSource
}

one sig HealthDiagnosticSource extends IssueSource {}
abstract sig IssueSource {}

-- @requirement OBS-16
sig ExecutionContext {
  isQGSDSourceRepo: one Bool,
  gsdToolsExists: one Bool
}

-- @requirement OBS-16
-- Severity mapping: E* -> High, W* -> Medium, I* -> Low
fact SeverityMapping {
  all issue: ObserveIssue |
    (issue.fromDiagnostic.prefix = ErrorCode implies issue.severity = High) and
    (issue.fromDiagnostic.prefix = WarningCode implies issue.severity = Medium) and
    (issue.fromDiagnostic.prefix = InfoCode implies issue.severity = Low)
}

-- @requirement OBS-16
-- Gate: only surfaces in QGSD source repo (gsd-tools.cjs existence check)
fact GatedToQGSDRepo {
  all ctx: ExecutionContext |
    ctx.gsdToolsExists = True iff ctx.isQGSDSourceRepo = True
}

-- @requirement OBS-16
-- Issues only exist when gsd-tools.cjs exists in some context
fact OnlySurfaceInQGSD {
  some ObserveIssue implies
    some ctx: ExecutionContext | ctx.gsdToolsExists = True
}

-- Assertions
assert SeverityCorrectlyRouted {
  all issue: ObserveIssue |
    issue.fromDiagnostic.prefix = ErrorCode implies issue.severity = High
}

assert NeverSurfacesOutsideQGSD {
  all ctx: ExecutionContext |
    ctx.isQGSDSourceRepo = False implies ctx.gsdToolsExists = False
}

check SeverityCorrectlyRouted for 5 but 6 ObserveIssue, 6 DiagnosticCode
check NeverSurfacesOutsideQGSD for 5 but 3 ExecutionContext
