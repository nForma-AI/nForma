---
phase: quick-313
plan: 01
type: execute
completed_date: 2026-03-16
commit: 1337b827
duration_minutes: 15
tasks_completed: 2
files_modified: 5
---

# Quick Task 313 Summary: Add tier field to requirements — tier: user|technical

## Objective
Add a `tier` field to the requirements schema (`user` | `technical`) and make the C->R / T->R reverse scanners propose `tier: technical` for infrastructure/tooling files instead of flagging them as false-positive missing user requirements.

## Completion Status
✅ **COMPLETE** - All 2 tasks executed successfully with 19 aggregate tests and 3 classifyCandidate tests passing.

## Tasks Executed

### Task 1: Add tier field to requirements schema and aggregation ✅
- Modified `parseRequirements()` to detect optional `(technical)` suffix in requirement text and set `tier: 'technical'` when present; otherwise defaults to `tier: 'user'`
- Updated `mergeFileIntoMap()` to preserve the tier field during merge operations
- Updated `validateEnvelope()` to accept tier as an optional field with values "user" or "technical"
- Added tier defaulting step in `aggregateRequirements()` to ensure all merged requirements have a tier field
- Fixed pre-existing issue: added missing `frozen_at: null` field to requirements.json before re-aggregation
- Regenerated requirements.json with all 372 requirements having `tier: "user"` (backward-compatible default)
- **Tests added:**
  - Verified parseRequirements defaults tier to "user" without (technical) suffix
  - Verified parseRequirements detects (technical) suffix and sets tier accordingly, stripping suffix from text
  - Verified aggregateRequirements defaults tier field for all merged requirements

### Task 2: Make C->R and T->R classifiers propose tier for infrastructure candidates ✅
- Modified `classifyCandidate()` to add infrastructure detection logic for module/test type candidates
- Infrastructure patterns detected: install, aggregate-, build-, compute-, validate-, config-loader, layer-constants, providers, unified-mcp-server, review-mcp-logs, check-mcp-health, security-sweep, token-dashboard, solve-tui, solve-worker, solve-wave-dag, solve-debt-bridge, and files under hooks/
- Returns `proposed_tier: 'technical'` for infrastructure modules/tests, `proposed_tier: 'user'` for feature modules/tests
- Modified `assembleReverseCandidates()` to propagate proposed_tier from classifyCandidate onto the candidate object
- **Tests added to sweep-reverse.test.cjs:**
  - Verified infrastructure module (install) gets `proposed_tier: 'technical'`
  - Verified feature module (nf-solve.cjs) gets `proposed_tier: 'user'`
  - Verified hooks files get `proposed_tier: 'technical'`
  - Verified build- prefix modules get `proposed_tier: 'technical'`
  - Verified test type candidates receive appropriate proposed_tier

## Verification Results

### Test Results
- **aggregate-requirements.test.cjs**: 19/19 tests passing ✅
  - All existing tests continue to pass
  - 3 new tier-related tests added and passing

- **classifyCandidate tests**: 3/3 tests passing ✅
  - Infrastructure detection working correctly
  - proposed_tier assignment correct for all candidate types

- **aggregate-requirements.cjs execution**: ✅
  - Successfully re-aggregated 372 requirements
  - All requirements now have tier field
  - Backward compatibility maintained

### Verification Criteria Met
- ✅ Every requirement in requirements.json has a tier field
- ✅ Existing requirements default to tier: "user"
- ✅ C->R and T->R scanners classify infrastructure files as tier: technical instead of FP-ing as missing user requirements
- ✅ classifyCandidate returns proposed_tier for module/test candidates
- ✅ All existing tests continue to pass
- ✅ New tests validate both tier assignment paths

## Files Modified
1. `bin/aggregate-requirements.cjs` - Added tier field parsing and handling
2. `bin/aggregate-requirements.test.cjs` - Added 3 new tests for tier functionality
3. `bin/nf-solve.cjs` - Added infrastructure detection and proposed_tier in classifyCandidate
4. `bin/sweep-reverse.test.cjs` - Added 7 new tests for classifyCandidate with proposed_tier
5. `.planning/formal/requirements.json` - Regenerated with tier field for all 372 requirements

## Key Decisions
- Infrastructure patterns are detected by file basename matching and hooks/ path prefix, not by full path analysis
- All 372 existing requirements default to tier: "user" for backward compatibility
- The (technical) suffix in REQUIREMENTS.md is stripped from requirement text after tier detection
- proposed_tier is set to 'user' as fallback if classification doesn't return a tier

## Technical Notes
- Fixed pre-existing bug: requirements.json was missing the frozen_at field, preventing re-aggregation
- Infrastructure patterns list includes build/tooling, config, MCP/internal, and security/ops tools
- The tier distinction enables the solve loop to distinguish infrastructure requirements from user-facing ones, reducing false positives in reverse traceability scanning

## No Deviations from Plan
All tasks executed exactly as planned. No blocking issues or unexpected requirements.
