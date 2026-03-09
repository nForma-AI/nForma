# Formal Verification Diff Report

**Generated:** 2026-03-09T22:47:01.829Z
**Current Run:** 3 pass, 2 fail
**Previous Run:** 0 transitions, 2 new, 5 removed
**Overall Status:** fail

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| tla:mctuinavigation | fail | fail: MCTUINavigation in 599ms |
| tla:prefilter | fail | fail: MCprefilter in 713ms |

## Removed Checks

- tla:mcdispatch: no longer run
- tla:mcagentloop: no longer run
- alloy:account-pool: no longer run
- ci:conformance-traces: no longer run
- tla:stop-hook: no longer run

## Unchanged Checks

3 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"tla:mctuinavigation":"fail","alloy:quorum-votes":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","tla:prefilter":"fail"}
```