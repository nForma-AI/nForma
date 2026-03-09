-- .planning/formal/alloy/prism-delegation.als
-- Models the constraint that run-formal-check.cjs delegates ALL PRISM
-- invocations through run-prism.cjs, inheriting its full feature set.
-- Source: bin/run-formal-check.cjs, bin/run-prism.cjs
--
-- @requirement FVTOOL-02

module prism_delegation

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement FVTOOL-02
-- PRISM invocation entry points
abstract sig PRISMEntryPoint {}
one sig RunFormalCheck, RunPrism extends PRISMEntryPoint {}

-- @requirement FVTOOL-02
-- Features that run-prism.cjs provides
abstract sig PRISMFeature {}
one sig PropsFileInjection, ScoreboardCalibration,
        ColdStartDetection, PolicyYamlLoading extends PRISMFeature {}

-- @requirement FVTOOL-02
sig PRISMInvocation {
  entryPoint: one PRISMEntryPoint,
  delegatesTo: lone PRISMEntryPoint,
  features: set PRISMFeature
}

-- @requirement FVTOOL-02
-- RunPrism has all features natively
fact RunPrismHasAllFeatures {
  all inv: PRISMInvocation |
    inv.entryPoint = RunPrism implies
      inv.features = PRISMFeature
}

-- @requirement FVTOOL-02
-- RunFormalCheck delegates to RunPrism for PRISM model-checking
fact RunFormalCheckDelegates {
  all inv: PRISMInvocation |
    inv.entryPoint = RunFormalCheck implies
      inv.delegatesTo = RunPrism
}

-- @requirement FVTOOL-02
-- Delegation inherits all features
fact DelegationInheritsFeatures {
  all inv: PRISMInvocation |
    some inv.delegatesTo implies
      inv.features = { f: PRISMFeature |
        some delegate: PRISMInvocation |
          delegate.entryPoint = inv.delegatesTo and f in delegate.features
      }
}

-- Assertions
assert NoDuplicatePRISMCodePath {
  all inv: PRISMInvocation |
    inv.entryPoint = RunFormalCheck implies inv.delegatesTo = RunPrism
}

assert AllFeaturesInherited {
  all inv: PRISMInvocation |
    inv.entryPoint = RunFormalCheck implies inv.features = PRISMFeature
}

check NoDuplicatePRISMCodePath for 4 but 4 PRISMInvocation
check AllFeaturesInherited for 4 but 4 PRISMInvocation
