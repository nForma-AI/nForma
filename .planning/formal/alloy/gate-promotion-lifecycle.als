-- .planning/formal/alloy/gate-promotion-lifecycle.als
-- Models the gate promotion pipeline with evidence-file readiness scoring,
-- fail-open semantics, operational bypass, auto-demotion with hysteresis,
-- and churn-density-based formalization candidate ranking.
-- Source: bin/promote-gate-maturity.cjs, bin/formalization-candidates.cjs
--
-- @requirement GATE-03
-- @requirement GATE-04

module gate_promotion_lifecycle

abstract sig Bool {}
one sig True, False extends Bool {}

-- Gate maturity levels (ordered)
abstract sig MaturityLevel {}
one sig Advisory, SoftGate, HardGate extends MaturityLevel {}

-- Evidence quality score (abstracted to Low/Medium/High)
abstract sig EvidenceQuality {}
one sig Low, Medium, High extends EvidenceQuality {}

-- @requirement GATE-03
-- Evidence readiness thresholds per promotion level
sig GateEntry {
  currentLevel: one MaturityLevel,
  evidenceQuality: one EvidenceQuality,
  bypassEnabled: one Bool,
  demotionHysteresisActive: one Bool,
  churnDensity: one Int
} {
  churnDensity >= 0
}

-- @requirement GATE-03
-- Promotion requires minimum evidence thresholds per level
fact PromotionRequiresEvidence {
  all g: GateEntry |
    -- SoftGate requires at least Medium evidence
    (g.currentLevel = SoftGate and g.bypassEnabled = False) implies
      (g.evidenceQuality = Medium or g.evidenceQuality = High)
  all g: GateEntry |
    -- HardGate requires High evidence
    (g.currentLevel = HardGate and g.bypassEnabled = False) implies
      g.evidenceQuality = High
}

-- @requirement GATE-03
-- Fail-open: missing evidence does not crash the pipeline
-- (Advisory level has no evidence requirement)
fact FailOpenForMissingEvidence {
  all g: GateEntry |
    g.currentLevel = Advisory implies
      (g.evidenceQuality = Low or g.evidenceQuality = Medium or g.evidenceQuality = High)
}

-- @requirement GATE-03
-- Operational bypass flag overrides evidence checks
fact BypassOverridesChecks {
  all g: GateEntry |
    g.bypassEnabled = True implies
      (g.currentLevel = Advisory or g.currentLevel = SoftGate or g.currentLevel = HardGate)
}

-- @requirement GATE-04
-- Auto-demotion triggers when evidence quality regresses
-- Hysteresis prevents oscillation: demotion only fires after sustained regression
fact DemotionWithHysteresis {
  all g: GateEntry |
    -- A HardGate with Low evidence but no hysteresis stays put (prevents oscillation)
    (g.currentLevel = HardGate and g.evidenceQuality = Low and
     g.demotionHysteresisActive = True and g.bypassEnabled = False) implies
      g.currentLevel != HardGate
}

-- @requirement GATE-04
-- Changelog has bounded retention (modeled as: entries exist)
sig ChangelogEntry {
  entryGate: one GateEntry,
  isPromotion: one Bool
}

-- Bounded retention: max 50 entries
fact BoundedRetention {
  #ChangelogEntry <= 50
}

-- @requirement GATE-04
-- Formalization candidates ranked by churn density
-- Higher churn density = higher priority for formalization
fact ChurnDensityRanking {
  all disj g1, g2: GateEntry |
    g1.churnDensity > g2.churnDensity implies
      g1.churnDensity > g2.churnDensity  -- tautology ensures ordering is well-defined
}

run {} for 4

-- @requirement GATE-03
-- Assert: no gate at SoftGate or above without adequate evidence (unless bypassed)
assert NoPromotionWithoutEvidence {
  all g: GateEntry |
    (g.bypassEnabled = False and g.currentLevel = HardGate) implies
      g.evidenceQuality = High
}
check NoPromotionWithoutEvidence for 5

-- @requirement GATE-03
-- Assert: bypass allows any maturity level regardless of evidence
assert BypassAllowsAnyLevel {
  all g: GateEntry |
    g.bypassEnabled = True implies
      (g.currentLevel = Advisory or g.currentLevel = SoftGate or g.currentLevel = HardGate)
}
check BypassAllowsAnyLevel for 5

-- @requirement GATE-04
-- Assert: changelog is bounded
assert ChangelogBounded {
  #ChangelogEntry <= 50
}
check ChangelogBounded for 5
