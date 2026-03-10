# Formal Verification Diff Report

**Generated:** 2026-03-10T14:17:44.119Z
**Current Run:** 7 pass, 0 fail
**Previous Run:** 0 transitions, 3 new, 4 removed
**Overall Status:** pass

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:multi-slot-structure | pass | pass: alloy:multi-slot-structure in 1257ms |
| alloy:availability | pass | pass: alloy:availability in 948ms |
| alloy:headless-execution | pass | pass: alloy:headless-execution in 960ms |

## Removed Checks

- tla:mcsolve-convergence: no longer run
- alloy:install-scope: no longer run
- tla:mcsolve-orchestrator: no longer run
- alloy:formal-test-trace: no longer run

## Unchanged Checks

4 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:multi-slot-structure":"pass","ci:trace-redaction":"pass","ci:trace-schema-drift":"pass","ci:liveness-fairness-lint":"pass","alloy:availability":"pass","ci:conformance-traces":"pass","alloy:headless-execution":"pass"}
```