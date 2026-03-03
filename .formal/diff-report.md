# Formal Verification Diff Report

**Generated:** 2026-03-03T12:11:15.234Z
**Current Run:** 13 pass, 7 fail, 5 warn/inconclusive
**Previous Run:** 0 transitions, 21 new, 0 removed
**Overall Status:** fail

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| tla:quorum-safety | inconclusive | inconclusive: fairness missing in 365ms |
| tla:quorum-liveness | pass | pass: MCliveness in 301ms |
| tla:oscillation | pass | pass: MCoscillation in 1309ms |
| tla:convergence | inconclusive | inconclusive: fairness missing in 264ms |
| tla:breaker | pass | pass: MCbreaker in 278ms |
| tla:deliberation | inconclusive | inconclusive: fairness missing in 298ms |
| tla:prefilter | pass | pass: MCprefilter in 278ms |
| tla:account-manager | pass | pass: MCaccount-manager in 311ms |
| tla:mcp-environment | fail | fail: MCMCPEnv in 176ms |
| tla:stop-hook | inconclusive | inconclusive: fairness missing in 270ms |
| alloy:quorum-votes | pass | pass: alloy:quorum-votes in 1052ms |
| alloy:scoreboard | fail | fail: alloy:scoreboard in 559ms |
| alloy:availability | pass | pass: alloy:availability in 720ms |
| alloy:transcript | pass | pass: alloy:transcript in 726ms |
| alloy:install-scope | fail | fail: alloy:install-scope in 713ms |
| alloy:taxonomy-safety | pass | pass: alloy:taxonomy-safety in 686ms |
| alloy:account-pool | fail | fail: alloy:account-pool in 864ms |
| alloy:quorum-composition | pass | pass: alloy:quorum-composition in 659ms |
| prism:quorum | fail | fail: quorum in 482ms |
| prism:oauth-rotation | pass | pass: prism:oauth-rotation in 326ms |
| prism:quorum | fail | fail: quorum in 284ms |

## Unchanged Checks

4 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"tla:quorum-safety":"inconclusive","tla:quorum-liveness":"pass","tla:oscillation":"pass","tla:convergence":"inconclusive","tla:breaker":"pass","tla:deliberation":"inconclusive","tla:prefilter":"pass","tla:account-manager":"pass","tla:mcp-environment":"fail","tla:stop-hook":"inconclusive","alloy:quorum-votes":"pass","alloy:scoreboard":"fail","alloy:availability":"pass","alloy:transcript":"pass","alloy:install-scope":"fail","alloy:taxonomy-safety":"pass","alloy:account-pool":"fail","alloy:quorum-composition":"pass","prism:quorum":"fail","prism:oauth-rotation":"pass","ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","ci:conformance-traces":"fail"}
```