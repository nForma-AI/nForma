# Formal Verification Suspects

**Generated:** 2026-03-07T15:27:22.611Z
**Total Suspects:** 2

## Inconclusive with Tags (result=inconclusive)

### uppaal:quorum-races
- **Property:** Quorum timed race model — minimum inter-slot gap and maximum timeout for consensus
- **Summary:** inconclusive: UPPAAL 5.0.0 -C flag bug — falling back to XML-embedded constants
- **Runtime:** 70ms
- **Tags:** uppaal-bug

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone
- **Runtime:** 5ms
- **Tags:** needs-fairness
