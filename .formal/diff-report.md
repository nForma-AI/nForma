# Formal Verification Diff Report

**Generated:** 2026-03-05T08:15:26.810Z
**Current Run:** 0 pass, 6 fail
**Previous Run:** 3 transitions, 2 new, 21 removed
**Overall Status:** fail

## Transitioned Checks

| Check | Previous | Current | Summary |
|-------|----------|---------|---------|
| tla:oscillation | pass | fail | fail: Java not found in 0ms |
| prism:oauth-rotation | pass | fail | fail: prism:oauth-rotation (binary not found) |
| prism:oauth-rotation | pass | fail | fail: prism:oauth-rotation (binary not found) |

## New Checks

| Check | Result | Summary |
|-------|--------|---------|
| alloy:bogus | fail | fail: alloy:bogus (invalid spec) |
| alloy:invalid | fail | fail: alloy:invalid (invalid spec) |

## Removed Checks

- tla:quorum-safety: no longer run
- tla:quorum-liveness: no longer run
- tla:convergence: no longer run
- tla:breaker: no longer run
- tla:deliberation: no longer run
- tla:prefilter: no longer run
- tla:account-manager: no longer run
- tla:mcp-environment: no longer run
- tla:stop-hook: no longer run
- alloy:quorum-votes: no longer run
- alloy:scoreboard: no longer run
- alloy:availability: no longer run
- alloy:transcript: no longer run
- alloy:install-scope: no longer run
- alloy:taxonomy-safety: no longer run
- alloy:account-pool: no longer run
- alloy:quorum-composition: no longer run
- prism:quorum: no longer run
- ci:trace-redaction: no longer run
- ci:trace-schema-drift: no longer run
- ci:liveness-fairness-lint: no longer run

## Unchanged Checks

1 check(s) unchanged from previous run — no action needed.

## Previous Run (for next comparison)

```json
{"alloy:bogus":"fail","alloy:invalid":"fail","tla:oscillation":"fail","prism:oauth-rotation":"fail","ci:conformance-traces":"fail"}
```