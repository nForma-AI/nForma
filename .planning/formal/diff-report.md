# Formal Verification Diff Report

**Generated:** 2026-03-17T13:22:27.047Z
**Current Run:** 5 pass, 0 fail
**Previous Run:** 1 transitions, 2 new, 13 removed
**Overall Status:** pass

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:liveness-fairness-lint | inconclusive | pass | pass: all liveness properties have fairness declarations (2  |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| petri:account-manager-petri-net | pass | pass: account-manager-petri-net Petri net validation in 0ms  |
| petri:quorum-petri-net | pass | pass: quorum-petri-net Petri net validation in 0ms (places=1 |

## Removed Checks

- ci:trace-redaction: no longer run
- alloy:annotation-extraction: no longer run
- tla:mcimprovement: no longer run
- alloy:bin-path-resolution: no longer run
- tla:mcsolve-report-only: no longer run
- alloy:unified-check-results: no longer run
- tla:mcinstaller: no longer run
- alloy:account-pool: no longer run
- alloy:mcp-detection: no longer run
- alloy:statusline-context-tiers: no longer run
- alloy:installer-sync: no longer run
- alloy:scoreboard: no longer run
- tla:mcsolvep2f: no longer run

## Unchanged Checks

2 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"petri:account-manager-petri-net":"pass","petri:quorum-petri-net":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","ci:conformance-traces":"pass"}
```