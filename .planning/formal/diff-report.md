# Formal Verification Diff Report

**Generated:** 2026-03-06T21:57:55.844Z
**Current Run:** 8 pass, 6 fail, 1 warn/inconclusive
**Previous Run:** 3 transitions, 4 new, 5 removed
**Overall Status:** fail

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:conformance-traces | fail | pass | pass: no conformance log found — nothing to validate |
| ci:conformance-traces | fail | pass | pass: 1/1 traces valid (12ms) |
| ci:conformance-traces | fail | pass | pass: 1/1 traces valid (13ms) |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| tla:mctuinavigation | pass | pass: MCTUINavigation in 474ms |
| tla:mctuinavigation | pass | pass: MCTUINavigation in 569ms |
| tla:mctuisessions | fail | fail: MCTUISessions in 352ms |
| tla:mctuisessions | fail | fail: MCTUISessions in 296ms |

## Removed Checks

- alloy:account-pool: no longer run
- alloy:quorum-votes: no longer run
- alloy:scoreboard: no longer run
- alloy:bogus: no longer run
- tla:breaker: no longer run

## Unchanged Checks

8 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"tla:mctuinavigation":"pass","prism:quorum":"pass","ci:conformance-traces":"fail","ci:trace-redaction":"pass","tla:mctuisessions":"fail","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","tla:account-manager":"fail"}
```