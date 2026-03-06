# Quick Task 188: Review upstream and deps handler implementations

## What was done

Performed a structured code review of the two new observe handlers (`observe-handler-upstream.cjs` and `observe-handler-deps.cjs`) plus their integration points across the observe pipeline.

## Key Findings

### Code Quality
- `formatAge` duplicated across **6 files** with 3 different null-handling behaviors — active drift causing visual inconsistency
- `parseDuration` duplicated in 2 files (identical implementation)
- `checkNodeVersion` uses unreliable `npm view node version` — queries npm registry for a shim package, not actual Node.js releases
- `checkPythonVersion` hardcodes `< 3.12` threshold — will go stale
- Nested try/catch in `checkNpmOutdated`/`checkNpmAudit` silently swallows JSON parse errors

### Integration
- All 12 integration checks PASS — config type inference, handler registration, render routing, observe-sources examples all consistent
- Both handlers return correct standard schema with all required fields

### Test Coverage
- 47 tests total (24 upstream + 23 deps), all passing
- 6 minor coverage gaps identified (none blocking)

## Requirements Identified

6 candidate requirements documented in `188-REQUIREMENTS.md`:

| ID | Priority | Status |
|----|----------|--------|
| OBS-SCHEMA (Standard Handler Return Schema) | HIGH | Pending elevation |
| OBS-DEDUP (Shared Utility Functions) | HIGH | Pending elevation |
| OBS-UPSTREAM-EVAL (Upstream Quality Comparison) | HIGH | Pending elevation |
| OBS-FAILOPEN (Fail-Open Handler Convention) | MEDIUM | Pending elevation |
| OBS-DI (Dependency Injection for Testability) | MEDIUM | Pending elevation |
| OBS-STATE (Persistent State Cursor Pattern) | LOW | Pending elevation |

## Artifacts
- `188-REVIEW.md` — Full review with 5 audit dimensions
- `188-REQUIREMENTS.md` — 6 candidate requirements with rationale and evidence
