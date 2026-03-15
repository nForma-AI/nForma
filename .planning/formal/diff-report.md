# Formal Verification Diff Report

**Generated:** 2026-03-15T22:18:15.087Z
**Current Run:** 12 pass, 0 fail
**Previous Run:** 0 transitions, 11 new, 4 removed
**Overall Status:** pass

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:architecture-registry | pass | pass: alloy:architecture-registry in 1236ms |
| petri:account-manager-petri-net | pass | pass: account-manager-petri-net Petri net validation in 1ms  |
| petri:quorum-petri-net | pass | pass: quorum-petri-net Petri net validation in 0ms (places=1 |
| alloy:ci-quality-gates | pass | pass: alloy:ci-quality-gates in 1494ms |
| ci:trace-schema-drift | pass | pass: ci:trace-schema-drift in 40ms |
| tla:mclearning | pass | pass: MClearning in 731ms |
| ci:liveness-fairness-lint | pass | pass: all liveness properties have fairness declarations (2  |
| tla:mccheckpointgate | pass | pass: MCcheckpointgate in 765ms |
| alloy:autoclose-signals | pass | pass: alloy:autoclose-signals in 1040ms |
| tla:quorum-liveness | pass | pass: MCliveness in 677ms |
| tla:mcci-checks | pass | pass: MCci-checks in 608ms |

## Removed Checks

- tla:mcwizard: no longer run
- tla:mctuimodules: no longer run
- tla:mcsolve-report-only: no longer run
- tla:mctuinavigation: no longer run

## Unchanged Checks

1 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:architecture-registry":"pass","petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","alloy:ci-quality-gates":"pass","ci:trace-schema-drift":"pass","tla:mclearning":"pass","ci:liveness-fairness-lint":"pass","tla:mccheckpointgate":"pass","alloy:autoclose-signals":"pass","tla:quorum-liveness":"pass","tla:mcci-checks":"pass","ci:conformance-traces":"pass"}
```