# Formal Verification Diff Report

**Generated:** 2026-03-09T09:09:02.293Z
**Current Run:** 3 pass, 0 fail, 1 warn/inconclusive
**Previous Run:** 1 transitions, 2 new, 0 removed
**Overall Status:** inconclusive

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| ci:liveness-fairness-lint | pass | inconclusive | inconclusive: fairness declarations missing — MCconvergence: |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| ci:trace-redaction | pass | pass: ci:trace-redaction in 1ms |
| ci:conformance-traces | pass | pass: 61489/61489 traces valid (372ms) |

## Unchanged Checks

1 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"inconclusive","ci:conformance-traces":"pass"}
```