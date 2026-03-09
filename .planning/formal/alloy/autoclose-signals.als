-- .planning/formal/alloy/autoclose-signals.als
-- Models the AutoClose remediation signal production constraint (GATE-02).
-- AutoClose steps produce observable signals; they never write gate_maturity
-- directly. Promotion is determined by scoring functions evaluating signals.
-- Source: bin/nf-solve.cjs, .planning/formal/model-registry.json
--
-- @requirement GATE-02

module autoclose_signals

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── GATE-02: Observable signals from AutoClose ───────────────────────

-- @requirement GATE-02
abstract sig SignalType {}
one sig SourceLayerClassification, SemanticDeclaration, TestCoverage extends SignalType {}

-- @requirement GATE-02
sig AutoCloseStep {
  producesSignals: set SignalType,
  writesGateMaturityDirectly: one Bool
}

-- @requirement GATE-02
-- AutoClose steps SHALL produce at least one observable signal
fact ProducesObservableSignals {
  all s: AutoCloseStep |
    #s.producesSignals > 0
}

-- @requirement GATE-02
-- AutoClose SHALL NOT write gate_maturity directly
fact NeverWritesGateMaturity {
  all s: AutoCloseStep |
    s.writesGateMaturityDirectly = False
}

-- @requirement GATE-02
sig ScoringFunction {
  evaluatesSignals: set SignalType,
  determinesPromotion: one Bool
}

-- @requirement GATE-02
-- Promotion follows from scoring functions independently evaluating signals
fact PromotionViaScoringOnly {
  all sf: ScoringFunction |
    #sf.evaluatesSignals > 0 and
    sf.determinesPromotion = True
}

-- @requirement GATE-02
-- Scoring functions evaluate the same signal types AutoClose produces
fact SignalAlignment {
  all sf: ScoringFunction |
    sf.evaluatesSignals in (AutoCloseStep.producesSignals)
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement GATE-02
assert AutoCloseNeverWritesMaturity {
  no s: AutoCloseStep | s.writesGateMaturityDirectly = True
}
check AutoCloseNeverWritesMaturity for 5

-- @requirement GATE-02
assert AllStepsProduceSignals {
  all s: AutoCloseStep | #s.producesSignals > 0
}
check AllStepsProduceSignals for 5
