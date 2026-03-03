---
phase: quick-134
task: 134
type: completion
completed_date: 2026-03-03
status: complete
subsystem: requirements-traceability
tags: [formal_models, fm-badge, coverage-gaps, tui-menu]
one_liner: "Integrated formal_models field into requirements-core and added detect-coverage-gaps TUI menu item"
---

# Quick Task 134: Integrate formal_models field and detect-coverage-gaps into requirements TUI

## Objective
Integrate the formal_models field from requirements.json (added by SCHEMA-04) into requirements-core.cjs (computeCoverage and buildTraceability) and agents.cjs (FM badge), and add detect-coverage-gaps.cjs to the TUI menu. Purpose: 56 requirements in requirements.json have a direct formal_models field, but requirements-core.cjs only finds formal models via model-registry forward links, leaving the direct field unused.

## Completion Summary

### Tasks Completed

**Task 1: Integrate formal_models field into requirements-core.cjs and add tests**
- Modified `computeCoverage()`: Added second pass after registry loop to union requirements with direct formal_models field into reqsWithModels Set
- Modified `buildTraceability()`: Added block to include models from requirement.formal_models array, with deduplication by path
- Added 5 new tests covering formal_models integration:
  1. `computeCoverage: formal_models field adds to withFormalModels count` — direct field without registry entry
  2. `computeCoverage: formal_models + registry union is deduplicated` — same model from both sources
  3. `buildTraceability: includes models from requirement formal_models field` — direct field without registry entry
  4. `buildTraceability: deduplicates models from formal_models and registry` — dedup avoids double-entry
  5. `buildTraceability: formal_models enriches with registry metadata when available` — pulls description/version from registry even if registry doesn't list the requirement
- All 29 tests pass (24 existing + 5 new)
- **Commit:** 1fed76a5

**Task 2: Update FM badge in agents.cjs and add Coverage Gaps TUI menu item**
- Updated FM badge in `renderReqList()`: Now checks both model-registry AND requirement.formal_models field (union approach)
- Added Coverage Gaps menu item: New `req-gaps` action in MENU_ITEMS array in Requirements section
- Implemented `reqCoverageGapsFlow()` function:
  - Requires and calls `detectCoverageGaps` from bin/detect-coverage-gaps.cjs
  - Runs for all 3 specs: QGSDQuorum, QGSDStopHook, QGSDCircuitBreaker
  - Displays formatted output with status (full-coverage, gaps-found, no-traces, unknown-spec)
  - For each spec, shows gap count and individual unreached states
  - Aggregates total gap count across all specs
  - Renders as synchronous function (detectCoverageGaps is sync)
- Updated `dispatch()` function: Added dispatch for `req-gaps` action (no await, sync)
- Updated `agents.test.cjs` MENU_ITEMS test: Added `req-gaps` to expected actions array
- All 61 tests pass
- **Commit:** cb764f6f

## Verification Results

✅ `node --test bin/requirements-core.test.cjs` — **29/29 tests pass** (24 existing + 5 new)

✅ `node --test bin/agents.test.cjs` — **61/61 tests pass** (updated MENU_ITEMS test includes req-gaps)

✅ Spot check: computeCoverage counts formal_models field
```
node -e "const rc = require('./bin/requirements-core.cjs'); const cov = rc.computeCoverage([{id:'X', status:'Complete', formal_models:['a.tla']}], {models:{}}, []); console.log('withFM:', cov.withFormalModels)"
→ withFM: 1 ✓
```

✅ Spot check: buildTraceability includes formal_models field
```
node -e "const rc = require('./bin/requirements-core.cjs'); const t = rc.buildTraceability('X', [{id:'X', formal_models:['a.tla']}], {models:{}}, []); console.log('models:', t.formalModels.length)"
→ models: 1 ✓
```

✅ FM badge label exists and reqCoverageGapsFlow wired in agents.cjs (grep checks)

## Key Artifacts Modified

| File | Changes | Lines |
|------|---------|-------|
| bin/requirements-core.cjs | Added formal_models union pass to computeCoverage() and buildTraceability() | +23 |
| bin/requirements-core.test.cjs | Added section 8 with 5 new tests for formal_models integration | +56 |
| bin/agents.cjs | Updated FM badge logic, added req-gaps menu item, added reqCoverageGapsFlow() function, updated dispatch | +50 |
| bin/agents.test.cjs | Updated MENU_ITEMS test to include req-gaps in expected actions | +1 |

## Behavioral Changes

### computeCoverage()
- **Before:** `withFormalModels` only counted requirements found in model-registry forward links
- **After:** `withFormalModels` counts union of:
  1. Requirements listed in model-registry.models[*].requirements arrays
  2. Requirements with direct formal_models array field (SCHEMA-04)
- **Result:** Accurate count of all requirements with at least one formal model (either source)

### buildTraceability()
- **Before:** `formalModels` array only included models from registry forward links
- **After:** `formalModels` array includes union of:
  1. Models from registry forward links (with registry metadata)
  2. Models from requirement.formal_models array (deduplicated by path)
- **Deduplication:** If same model path appears in both sources, includes once with registry metadata (richer data)
- **Result:** Complete traceability including both registry-discoverable and direct-field-specified models

### FM Badge in Browse Reqs
- **Before:** [FM] badge only showed for requirements in model-registry.models[*].requirements
- **After:** [FM] badge shows for requirements with formal_models field OR in model-registry
- **Result:** Browse Reqs accurately reflects all formalized requirements

### TUI Menu
- **Before:** No way to access detect-coverage-gaps analysis from TUI
- **After:** New "Coverage Gaps" menu item in Requirements section
  - Action: `req-gaps`
  - Displays synchronized analysis of 3 specs
  - Shows coverage status for each spec with gap details
  - Aggregates total gaps across all specs
- **Result:** Formal verification coverage gap analysis accessible via TUI

## Deviations from Plan

None — plan executed exactly as written. All specified changes implemented, all tests pass, all verification criteria met.

## Success Criteria Verification

- ✅ `computeCoverage()` `withFormalModels` reflects union of model-registry and requirement.formal_models
- ✅ `buildTraceability()` `formalModels` array includes models from both sources, deduplicated
- ✅ Browse Reqs FM badge lights up for requirements with direct formal_models field
- ✅ Coverage Gaps menu item appears in TUI Requirements section
- ✅ `reqCoverageGapsFlow` runs all 3 specs through detect-coverage-gaps.cjs
- ✅ All existing tests continue to pass; new tests cover formal_models integration

## Testing Summary

| Test Suite | Count | Status |
|------------|-------|--------|
| requirements-core.test.cjs | 29 | ✅ Pass |
| agents.test.cjs | 61 | ✅ Pass |
| **Total** | **90** | **✅ Pass** |

## Self-Check: PASSED

- ✅ bin/requirements-core.cjs modified and committed
- ✅ bin/requirements-core.test.cjs modified and committed
- ✅ bin/agents.cjs modified and committed
- ✅ bin/agents.test.cjs modified and committed
- ✅ All 29 requirements-core tests pass
- ✅ All 61 agents tests pass
- ✅ Spot checks verified
- ✅ Both commits created (1fed76a5 and cb764f6f)
- ✅ SUMMARY.md created at expected location

## Commits

| Hash | Message |
|------|---------|
| 1fed76a5 | feat(quick-134): integrate formal_models field into computeCoverage and buildTraceability |
| cb764f6f | feat(quick-134): add FM badge formal_models support and Coverage Gaps TUI menu |
