# Formal Verification Suspects

**Generated:** 2026-03-03T06:48:58.599Z
**Total Suspects:** 2

## Critical Failures (result=fail)

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 5251 divergence(s) in 15631 traces (116ms)
- **Runtime:** 116ms
- **Tags:** trace-divergence

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCStopHook: LivenessProperty1, LivenessProperty2, LivenessProperty3; MCTUINavigation: EscapeProgress; MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone; MCsafety: AllTransitionsValid, DeliberationMonotone
- **Runtime:** 2ms
- **Tags:** needs-fairness
