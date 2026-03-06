# Formal Verification Suspects

**Generated:** 2026-03-06T21:57:55.854Z
**Total Suspects:** 8

## Critical Failures (result=fail)

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 1 divergence(s) in 1 traces (11ms)
- **Runtime:** 11ms
- **Tags:** trace-divergence

### tla:mctuisessions
- **Property:** MCTUISessions
- **Summary:** fail: MCTUISessions in 352ms
- **Runtime:** 352ms
- **Tags:** none

### tla:mctuisessions
- **Property:** MCTUISessions
- **Summary:** fail: MCTUISessions in 296ms
- **Runtime:** 296ms
- **Tags:** none

### tla:account-manager
- **Property:** Account manager quorum state machine — MCAM correctness
- **Summary:** fail: MCaccount-manager in 225ms
- **Runtime:** 225ms
- **Tags:** none

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 6373 divergence(s) in 37518 traces (535ms)
- **Runtime:** 535ms
- **Tags:** trace-divergence

### tla:account-manager
- **Property:** Account manager quorum state machine — MCAM correctness
- **Summary:** fail: MCaccount-manager in 230ms
- **Runtime:** 230ms
- **Tags:** none

## Inconclusive with Tags (result=inconclusive)

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone
- **Runtime:** 2ms
- **Tags:** needs-fairness

## Other Suspects

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** pass: quorum in 820ms
- **Runtime:** 820ms
- **Tags:** low-confidence
