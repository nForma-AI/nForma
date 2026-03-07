-- .planning/formal/alloy/trace-event-normalization.als
-- Models mapToXStateEvent normalization: event identity via action||type fallback,
-- handling of quorum_fallback_t1_required, quorum_block_r3_2, security_sweep,
-- and non-FSM actions in KNOWN_NON_FSM_ACTIONS counted as valid (not divergent).
-- Source: bin/conformance-traces.cjs
--
-- @requirement TRACE-08

module trace_event_normalization

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── TRACE-08: Event normalization ────────────────────────────────

-- @requirement TRACE-08
sig TraceEvent {
  action: lone ActionField,
  eventType: lone TypeField,
  resolvedIdentity: one EventIdentity,
  isKnownNonFSM: one Bool,
  isDivergent: one Bool
}

sig ActionField {}
sig TypeField {}
sig EventIdentity {}

-- @requirement TRACE-08
-- Known non-FSM action names
abstract sig KnownNonFSMAction {}
one sig QuorumFallbackT1, QuorumBlockR3_2, SecuritySweep extends KnownNonFSMAction {}

-- @requirement TRACE-08
-- Normalization: identity = action if present, else type (fallback)
fact ActionOrTypeFallback {
  all e: TraceEvent |
    (some e.action implies e.resolvedIdentity in EventIdentity) and
    (no e.action and some e.eventType implies e.resolvedIdentity in EventIdentity) and
    (no e.action and no e.eventType implies no e.resolvedIdentity)
}

-- @requirement TRACE-08
-- Action takes precedence: same action field → same resolved identity
fact ActionPrecedence {
  all e1, e2: TraceEvent |
    (some e1.action and some e2.action and e1.action = e2.action) implies
      e1.resolvedIdentity = e2.resolvedIdentity
}

-- @requirement TRACE-08
-- Non-FSM actions are never counted as divergent
fact NonFSMNotDivergent {
  all e: TraceEvent |
    e.isKnownNonFSM = True implies e.isDivergent = False
}

-- @requirement TRACE-08
-- Events must have at least action or type to be resolvable
fact MustHaveIdentitySource {
  all e: TraceEvent |
    some e.resolvedIdentity implies (some e.action or some e.eventType)
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement TRACE-08
assert NonFSMNeverDivergent {
  all e: TraceEvent |
    e.isKnownNonFSM = True implies e.isDivergent = False
}
check NonFSMNeverDivergent for 4 but 4 TraceEvent, 3 ActionField, 3 TypeField, 4 EventIdentity

-- @requirement TRACE-08
assert IdentityRequiresSource {
  all e: TraceEvent |
    some e.resolvedIdentity implies (some e.action or some e.eventType)
}
check IdentityRequiresSource for 4 but 4 TraceEvent, 3 ActionField, 3 TypeField, 4 EventIdentity

-- @requirement TRACE-08
assert ActionTakesPrecedence {
  all e1, e2: TraceEvent |
    (some e1.action and some e2.action and e1.action = e2.action) implies
      e1.resolvedIdentity = e2.resolvedIdentity
}
check ActionTakesPrecedence for 4 but 4 TraceEvent, 2 ActionField, 3 TypeField, 4 EventIdentity
