-- .planning/formal/alloy/observability-handlers.als
-- Models observability handler contract: return schema, canonical utility module,
-- upstream comparison, and internal error handling.
-- Source: bin/observe-handlers/*.cjs, bin/observe-utils.cjs
--
-- @requirement OBS-09
-- @requirement OBS-10
-- @requirement OBS-11
-- @requirement OBS-12

module observability_handlers

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── OBS-09: Handler return schema ──────────────────────────────────────

-- @requirement OBS-09
abstract sig StatusValue {}
one sig Ok, Error extends StatusValue {}

-- @requirement OBS-09
sig ObserveIssue {
  hasSourceLabel: one Bool,
  hasSourceType: one Bool
}

-- @requirement OBS-09
sig HandlerResult {
  sourceLabel: one Bool,
  sourceType: one Bool,
  status: one StatusValue,
  issues: set ObserveIssue,
  errorString: lone ErrorMsg
}

sig ErrorMsg {}

-- @requirement OBS-09
-- Every handler result has source_label and source_type populated
fact HandlerSchemaComplete {
  all r: HandlerResult |
    r.sourceLabel = True and r.sourceType = True
}

-- @requirement OBS-09
-- error string present iff status is Error
fact ErrorStringPresence {
  all r: HandlerResult |
    (r.status = Error iff some r.errorString)
}

-- ── OBS-10: Canonical utility module ───────────────────────────────────

-- @requirement OBS-10
abstract sig UtilFunction {}
one sig FormatAge, ParseDuration, ClassifySeverity extends UtilFunction {}

-- @requirement OBS-10
one sig CanonicalModule {
  exports: set UtilFunction
}

-- @requirement OBS-10
sig HandlerModule {
  imports: set UtilFunction,
  definesLocally: set UtilFunction
}

-- @requirement OBS-10
-- All utility functions are exported from the canonical module
fact AllUtilsExported {
  CanonicalModule.exports = UtilFunction
}

-- @requirement OBS-10
-- No handler defines utility functions locally — must import from canonical
fact NoLocalDuplication {
  all h: HandlerModule | no h.definesLocally
}

-- @requirement OBS-10
-- Every handler that uses a util function imports it from canonical
fact ImportsFromCanonical {
  all h: HandlerModule | h.imports in CanonicalModule.exports
}

-- ── OBS-11: Upstream comparison before porting ─────────────────────────

-- @requirement OBS-11
abstract sig CompareResult {}
one sig Overlapping, Disjoint extends CompareResult {}

-- @requirement OBS-11
sig UpstreamChange {
  evaluated: one Bool,
  compareResult: one CompareResult
}

-- @requirement OBS-11
-- All upstream changes are evaluated before porting
fact AllEvaluated {
  all u: UpstreamChange | u.evaluated = True
}

-- ── OBS-12: Handler error containment ──────────────────────────────────

-- @requirement OBS-12
sig HandlerExecution {
  handler: one HandlerModule,
  internalError: one Bool,
  result: one HandlerResult,
  throwsException: one Bool
}

-- @requirement OBS-12
-- If internal error occurs, handler returns status: Error with descriptive string
fact ErrorContainment {
  all e: HandlerExecution |
    e.internalError = True implies
      (e.result.status = Error and some e.result.errorString)
}

-- @requirement OBS-12
-- No handler throws exceptions — errors are always caught internally
fact NoExceptionPropagation {
  all e: HandlerExecution | e.throwsException = False
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement OBS-09
assert SchemaAlwaysComplete {
  all r: HandlerResult |
    r.sourceLabel = True and r.sourceType = True
}
check SchemaAlwaysComplete for 5

-- @requirement OBS-10
assert NoUtilDuplication {
  all h: HandlerModule | no h.definesLocally
}
check NoUtilDuplication for 5

-- @requirement OBS-11
assert UpstreamAlwaysEvaluated {
  all u: UpstreamChange | u.evaluated = True
}
check UpstreamAlwaysEvaluated for 5

-- @requirement OBS-12
assert HandlerNeverThrows {
  all e: HandlerExecution | e.throwsException = False
}
check HandlerNeverThrows for 5
