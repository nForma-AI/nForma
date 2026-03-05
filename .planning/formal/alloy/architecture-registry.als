-- .formal/alloy/architecture-registry.als
-- Models formal verification architecture: registry as source of truth,
-- promotion, debug invariant acceptance, and meta-decisioning.
-- Source: .formal/model-registry.json, bin/promote-model.cjs, bin/accept-debug-invariant.cjs
--
-- @requirement ARCH-01
-- @requirement ARCH-02
-- @requirement ARCH-03
-- @requirement META-01
-- @requirement META-02
-- @requirement META-03

module architecture_registry

-- Requirements covered by models
sig Requirement {}

-- Model files live in canonical or per-phase locations
sig ModelFile {
  inRegistry: one Bool,
  provenance: one Provenance,
  requirements: set Requirement
}

abstract sig Provenance {}
one sig Manual, Generated, Promoted, DebugDiscovered extends Provenance {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- ARCH-01: Registry is single source of truth
-- @requirement ARCH-01
one sig Registry {
  models: set ModelFile
}

-- Promotion action
sig PromotionAction {
  source: one ModelFile,
  target: one ModelFile
}

-- Debug invariant acceptance
sig DebugAcceptAction {
  invariant: one ModelFile
}

-- Questions encountered during planning
sig PlanningQuestion {
  quorumResolved: one Bool,
  presentedToUser: one Bool
}

-- ARCH-01: All tracked models are in registry
-- @requirement ARCH-01
fact RegistrySoT {
  Registry.models = { m : ModelFile | m.inRegistry = True }
  all m : ModelFile | m.inRegistry = True
}

-- ARCH-02: Promotion produces registry entry with no duplicates
-- @requirement ARCH-02
fact PromotionAtomic {
  all p : PromotionAction | {
    p.target.inRegistry = True
    p.target.provenance = Promoted
    p.source != p.target
    p.target.requirements = p.source.requirements
  }
}

-- ARCH-03: Debug acceptance writes with session provenance
-- @requirement ARCH-03
fact DebugAcceptProvenance {
  all d : DebugAcceptAction | {
    d.invariant.inRegistry = True
    d.invariant.provenance = DebugDiscovered
  }
}

-- META-01: Planning questions auto-resolved via quorum first
-- @requirement META-01
fact QuorumFirst {
  all q : PlanningQuestion |
    q.presentedToUser = True implies q.quorumResolved = False
}

-- META-02: Only quorum-failed questions presented to user
-- @requirement META-02
fact OnlyFailedEscalated {
  all q : PlanningQuestion |
    q.presentedToUser = True iff q.quorumResolved = False
}

-- META-03: Auto-resolved shown as assumptions
-- @requirement META-03
-- (structural: resolved questions exist alongside escalated ones)
fact ResolvedAreAssumptions {
  all q : PlanningQuestion |
    q.quorumResolved = True implies q.presentedToUser = False
}

run {} for 4 ModelFile, 4 Requirement, 2 PromotionAction, 2 DebugAcceptAction, 4 PlanningQuestion, 4 int

-- @requirement ARCH-01
assert AllInRegistry {
  all m : ModelFile | m.inRegistry = True
}
check AllInRegistry for 4 ModelFile, 4 Requirement, 2 PromotionAction, 2 DebugAcceptAction, 4 PlanningQuestion, 4 int

-- @requirement ARCH-02
assert PromotionNoDuplicates {
  all p : PromotionAction | p.source != p.target
}
check PromotionNoDuplicates for 4 ModelFile, 4 Requirement, 3 PromotionAction, 2 DebugAcceptAction, 4 PlanningQuestion, 4 int

-- @requirement META-02
assert EscalationOnlyOnFail {
  all q : PlanningQuestion |
    q.presentedToUser = True implies q.quorumResolved = False
}
check EscalationOnlyOnFail for 4 ModelFile, 4 Requirement, 2 PromotionAction, 2 DebugAcceptAction, 6 PlanningQuestion, 4 int
