---
task: quick-165
status: complete
commits:
  - 2aec828e
  - 6ff105da
files_modified:
  - bin/qgsd-solve.cjs
  - bin/run-uppaal.cjs
verification: passed
---

## Summary

Fixed `sweepFtoC()` in `bin/qgsd-solve.cjs` to always run `run-formal-verify.cjs` instead of reading stale `check-results.ndjson` in `--report-only` mode.

### Problem

The solver's F→C layer had a `reportOnly` shortcut that read cached `check-results.ndjson` instead of running verification. When the cache contained only 4 CI-gated summary checks (from a partial or CI-only run), the solver reported `f_to_c.residual: 0` while 7 individual alloy/tla/prism checks were actually failing. This prevented `/qgsd:solve` from dispatching remediation for real formal verification failures.

### Changes

1. **Removed report-only shortcut** (lines 628-687 deleted): `sweepFtoC()` now always runs `run-formal-verify.cjs` to get fresh data from all 26+ checks, matching `sweepTtoC()` behavior.

2. **Fixed non-zero exit handling**: `run-formal-verify.cjs` exits non-zero when any check fails. The solver now correctly parses `check-results.ndjson` even when the verification script exits non-zero — only bails on actual spawn errors where no ndjson was generated.

3. **UPPAAL error handling** (run-uppaal.cjs): Added license detection for UPPAAL 5.x and `--disable-memory-reduction` duplicate option bug workaround with automatic retry.

### Verification

Before: `f_to_c.residual: 0, total_checks: 4`
After: `f_to_c.residual: 7, total_checks: 26` (13 pass, 7 fail, 6 inconclusive)

The solver now correctly reports all formal verification failures, enabling `/qgsd:solve` to dispatch targeted remediation.
