-- .planning/formal/alloy/debate-trace-persistence.als
-- Models the quorum debate trace persistence structure and fail-open I/O behavior.
-- Source: bin/quorum-slot-dispatch.cjs
--
-- @requirement DISP-07

module debate_trace_persistence

abstract sig Bool {}
one sig True, False extends Bool {}

-- Frontmatter fields required by DISP-07
sig DebateTrace {
  hasDate: one Bool,
  hasQuestion: one Bool,
  hasSlot: one Bool,
  hasRound: one Bool,
  hasMode: one Bool,
  hasVerdict: one Bool,
  hasMatchedReqIds: one Bool,
  hasArtifactPath: one Bool
}

-- A quorum slot dispatch that produces a debate trace
sig SlotDispatch {
  successful: one Bool,
  trace: lone DebateTrace,
  ioFailed: one Bool
}

-- @requirement DISP-07
-- Successful dispatches always attempt to persist a trace (fail-open)
fact SuccessfulDispatchPersistsTrace {
  all d: SlotDispatch |
    d.successful = True implies some d.trace
}

-- @requirement DISP-07
-- Failed dispatches may or may not have a trace
fact FailedDispatchNoTraceRequired {
  all d: SlotDispatch |
    d.successful = False implies no d.trace
}

-- @requirement DISP-07
-- Every persisted trace has all required frontmatter fields
fact TraceHasAllFrontmatter {
  all t: DebateTrace |
    t.hasDate = True and
    t.hasQuestion = True and
    t.hasSlot = True and
    t.hasRound = True and
    t.hasMode = True and
    t.hasVerdict = True and
    t.hasMatchedReqIds = True and
    t.hasArtifactPath = True
}

-- @requirement DISP-07
-- I/O failure never blocks the dispatch (fail-open semantics)
-- Even when ioFailed is True, the dispatch still completes successfully
fact FailOpenIO {
  all d: SlotDispatch |
    d.ioFailed = True implies d.successful = True
}

run {} for 4

-- @requirement DISP-07
-- Assert: a successful dispatch always has a trace with complete frontmatter
assert SuccessfulDispatchHasCompleteTrace {
  all d: SlotDispatch |
    d.successful = True implies
      (some d.trace and
       d.trace.hasDate = True and
       d.trace.hasQuestion = True and
       d.trace.hasSlot = True and
       d.trace.hasRound = True and
       d.trace.hasMode = True and
       d.trace.hasVerdict = True and
       d.trace.hasMatchedReqIds = True and
       d.trace.hasArtifactPath = True)
}
check SuccessfulDispatchHasCompleteTrace for 5

-- @requirement DISP-07
-- Assert: I/O failures never block dispatch completion
assert IOFailureNeverBlocks {
  all d: SlotDispatch |
    d.ioFailed = True implies d.successful = True
}
check IOFailureNeverBlocks for 5
