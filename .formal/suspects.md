# Formal Verification Suspects

**Generated:** 2026-03-03T12:11:15.240Z
**Total Suspects:** 13

## Critical Failures (result=fail)

### tla:mcp-environment
- **Property:** MCP environment — MCPEnvSafety, MCPEnvLiveness
- **Summary:** fail: MCMCPEnv in 176ms
- **Runtime:** 176ms
- **Tags:** none

### alloy:scoreboard
- **Property:** Scoreboard idempotency — no vote loss, no double counting
- **Summary:** fail: alloy:scoreboard in 559ms
- **Runtime:** 559ms
- **Tags:** none

### alloy:install-scope
- **Property:** Installer rollback soundness and config sync completeness
- **Summary:** fail: alloy:install-scope in 713ms
- **Runtime:** 713ms
- **Tags:** none

### alloy:account-pool
- **Property:** Account pool state machine — slot assignment and release invariants
- **Summary:** fail: alloy:account-pool in 864ms
- **Runtime:** 864ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: quorum in 482ms
- **Runtime:** 482ms
- **Tags:** none

### prism:quorum
- **Property:** Quorum consensus probability under agent availability rates
- **Summary:** fail: quorum in 284ms
- **Runtime:** 284ms
- **Tags:** none

### ci:conformance-traces
- **Property:** Conformance event replay through XState machine
- **Summary:** fail: 5381 divergence(s) in 15864 traces (105ms)
- **Runtime:** 105ms
- **Tags:** trace-divergence

## Inconclusive with Tags (result=inconclusive)

### tla:quorum-safety
- **Property:** Safety invariants — TypeInvariant, SafetyInvariant, no deadlock
- **Summary:** inconclusive: fairness missing in 365ms
- **Runtime:** 365ms
- **Tags:** needs-fairness

### tla:convergence
- **Property:** Haiku convergence — OscillationConvergence liveness property
- **Summary:** inconclusive: fairness missing in 264ms
- **Runtime:** 264ms
- **Tags:** needs-fairness

### tla:deliberation
- **Property:** R3 deliberation loop — max 10 rounds + 10 improvement iterations
- **Summary:** inconclusive: fairness missing in 298ms
- **Runtime:** 298ms
- **Tags:** needs-fairness

### tla:stop-hook
- **Property:** Stop hook safety (BLOCK => hasCommand) + liveness (hasQuorumEvidence => <>PASS)
- **Summary:** inconclusive: fairness missing in 270ms
- **Runtime:** 270ms
- **Tags:** needs-fairness

### ci:liveness-fairness-lint
- **Property:** Liveness fairness declarations — all TLA+ liveness properties documented with WF/SF rationale
- **Summary:** inconclusive: fairness declarations missing — MCStopHook: LivenessProperty1, LivenessProperty2, LivenessProperty3; MCTUINavigation: EscapeProgress; MCconvergence: ResolvedAtWriteOnce, HaikuUnavailableNoCorruption; MCdeliberation: DeliberationMonotone, ImprovementMonotone; MCsafety: AllTransitionsValid, DeliberationMonotone
- **Runtime:** 2ms
- **Tags:** needs-fairness

## Other Suspects

### prism:oauth-rotation
- **Property:** OAuth token rotation probability — successful rotation under expiry and concurrency
- **Summary:** pass: prism:oauth-rotation in 326ms
- **Runtime:** 326ms
- **Tags:** low-confidence
