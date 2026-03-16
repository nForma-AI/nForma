---
phase: 306-fix-f-c-conformance-trace-divergences-ci
status: complete
---

## Summary

The F->C residual of 2 was caused by a stale `.planning/formal/.divergences.json` file dated 2026-03-05. Running `validate-traces.cjs` confirmed 100.0% valid traces (77820/77820) — zero divergences exist in current codebase.

### Root cause
The `validate-traces.cjs` script only writes `.divergences.json` when divergences are found (conditional write). When divergences were fixed in a prior commit, the old file was never cleaned up. The diagnostic engine's F->C scanner read the stale file and reported residual=2.

### Fix applied
- Removed stale `.planning/formal/.divergences.json`
- Confirmed via fresh `validate-traces.cjs` run: 0 divergences

### Impact
Next diagnostic sweep will correctly report F->C residual = 0.
