## Quick Task 17 — Add quorum gate inside map-codebase workflow

**Status:** Complete
**Commit:** 1be247d
**Date:** 2026-02-21
**Quorum override:** All 4 external models UNAVAILABLE — user approved docs-only override

### What was done

**Task 1 — get-shit-done/workflows/map-codebase.md**
- Added new `<step name="quorum_validate">` between `verify_output` and `scan_for_secrets`
- Quorum gate presents STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md to all available quorum models
- Checks: internal consistency, completeness, blind spots, concern triage (blocks vs deferred)
- On APPROVED: continues to scan_for_secrets
- On ISSUES: presents structured list to user with 3 options (edit, accept, abort)
- On all models UNAVAILABLE (R6.6): notes reduced quorum, continues (fail-open)
- Updated success_criteria to include quorum validation

**Task 2 — docs/USER-GUIDE.md**
- Updated brownfield workflow diagram to show [QUORUM VALIDATES] gate
- Gate appears between mapper outputs and /qgsd:new-project
- Lists what quorum checks: consistency, completeness, concern triage

### Verification

- `grep -c "quorum_validate" get-shit-done/workflows/map-codebase.md` → 1 ✓
- `grep -c "QUORUM VALIDATES" docs/USER-GUIDE.md` → 1 ✓
