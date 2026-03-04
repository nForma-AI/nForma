# Quick Task 151: Wire Baseline Requirements into New-Project and New-Milestone Workflows

**Date:** 2026-03-04
**Status:** Completed

## Summary

Implemented comprehensive baseline requirements system that automatically seeds QGSD projects with industry-standard quality requirements (UX, Security, Reliability, Observability, CI/CD, Performance) filtered by project type (web, mobile, desktop, api, cli, library). Users can opt out of unwanted baselines during project and milestone scoping.

## Completed Tasks

### Task 1: Create load-baseline-requirements utility and tests

**Files:**
- `bin/load-baseline-requirements.cjs` — CLI and module
- `bin/load-baseline-requirements.test.cjs` — Comprehensive test suite

**What was built:**
- Node.js CJS script that reads `qgsd-core/defaults/baseline-requirements/index.json` and category files
- Filters 34 baseline requirements by 6 profiles (web/mobile/desktop/api/cli/library)
- Assigns sequential IDs per category using id_template (UX-01, SEC-01, etc.)
- Supports CLI mode: `--profile <web|mobile|...>` and `--list-profiles`
- Exports `loadBaselineRequirements(profile, basePath?)` for programmatic use

**Algorithm:**
1. For `includes_only` profiles (library): Load only specified category files
2. For all other profiles: Load all categories, then filter per-requirement by checking if profile is in requirement's `profiles` array
3. Assign sequential IDs per category using id_template
4. Return structured { profile, label, description, categories: [...], total }

**Profile coverage:**
- Web: 34 requirements (all)
- Mobile: 34 requirements (all)
- Desktop: 20 requirements (excludes profile-restricted reqs)
- API: 18 requirements (only backend-compatible)
- CLI: 13 requirements (only CLI-compatible)
- Library: 6 requirements (security + ci-cd only)

**Test coverage:**
- 20 tests covering all profiles, filter semantics, ID generation, CLI flags
- All tests pass (0 failures)

**Verification:**
```
$ node --test bin/load-baseline-requirements.test.cjs
✔ All 20 tests pass
✔ node bin/load-baseline-requirements.cjs --profile web | jq .total → 34
✔ node bin/load-baseline-requirements.cjs --profile library | jq '.categories | map(.name)' → ["Security","CI/CD"]
✔ node bin/load-baseline-requirements.cjs --list-profiles | jq length → 6
```

### Task 2: Wire baseline requirements into new-project workflow

**Files modified:**
- `qgsd-core/workflows/new-project.md`

**Changes:**
- **Step 6.5 (Project Profile Selection):** New step after Research Decision with 6-option picker (web/mobile/desktop/api/cli/library)
  - Auto mode defaults to web profile
  - Stores `PROJECT_PROFILE` variable

- **Step 6.6 (Load Baseline Requirements):** New step to load and present baselines for opt-out
  - Runs `node bin/load-baseline-requirements.cjs --profile "$PROJECT_PROFILE"`
  - Presents baseline requirements per category using multiSelect (all pre-selected)
  - Auto mode keeps all baselines automatically
  - Stores `BASELINE_KEPT` and `BASELINE_REMOVED`

- **Step 7 (Define Requirements):** Updated to integrate baseline requirements
  - Added section in REQUIREMENTS.md generation instructions
  - Baseline Requirements section goes BEFORE project-specific v1 Requirements
  - Baseline IDs use own namespace (UX-XX, SEC-XX, etc.) separate from REQ-IDs
  - Removed baselines shown struck through for traceability

- **Success criteria:** Updated with 4 new items:
  - Project profile selected
  - Baseline requirements loaded and filtered
  - User opted out of unwanted baselines
  - REQUIREMENTS.md includes Baseline Requirements section

### Task 3: Wire baseline requirements into new-milestone workflow

**Files modified:**
- `qgsd-core/workflows/new-milestone.md`

**Changes:**
- **Step 8.5 (Project Profile Selection):** New step with milestone-specific logic
  - Checks PROJECT.md for existing profile via grep
  - If exists: Offer to keep or change profile
  - If not: Show full 6-option picker (same as new-project)
  - Updates PROJECT.md with Profile field if new

- **Step 8.6 (Load Baseline Requirements):** New step with carry-forward detection
  - Checks REQUIREMENTS.md for existing "## Baseline Requirements" section
  - If exists: Present summary, optionally let user review/modify
  - If not: Load fresh baselines using same flow as new-project
  - Supports updating from previous milestone

- **Step 9 (Define Requirements):** Updated to integrate baseline requirements
  - Preserves existing Baseline Requirements section if already present
  - Creates new Baseline Requirements section if first milestone
  - Same namespace separation as new-project (baseline IDs vs REQ-IDs)

- **Success criteria:** Updated with 3 new items:
  - Project profile confirmed or selected
  - Baseline requirements loaded (new) or carried forward (existing)
  - REQUIREMENTS.md includes Baseline Requirements section

## Key Design Decisions

1. **Per-requirement profiles filtering:** Each baseline requirement has a `profiles` array in the JSON files. Used this directly rather than parsing excludes syntax, simplifying the algorithm and making requirements portable across profile definitions.

2. **Separate ID namespace:** Baseline requirements use UX-XX, SEC-XX, etc. prefix, completely separate from project-specific REQ-IDs (AUTH-01, CONT-02, etc.). This keeps quality requirements distinct from feature requirements in REQUIREMENTS.md.

3. **Opt-out, not opt-in:** All baseline requirements are pre-selected by default, with users able to deselect. This ensures nothing obvious is missed while respecting project-specific needs.

4. **Carry-forward pattern in milestones:** New milestone checks if baselines exist from previous milestone and preserves them, allowing gradual refinement across milestones.

5. **Auto mode simplification:** Auto mode defaults to web profile and keeps all baselines, eliminating interactive steps for CI/automated workflows.

## Artifacts Created

| File | Purpose | Lines |
|------|---------|-------|
| `bin/load-baseline-requirements.cjs` | CLI utility + module export | 92 |
| `bin/load-baseline-requirements.test.cjs` | Comprehensive test suite | 223 |
| `qgsd-core/workflows/new-project.md` | Updated with Steps 6.5, 6.6, Step 7 baseline integration | +150 |
| `qgsd-core/workflows/new-milestone.md` | Updated with Steps 8.5, 8.6, Step 9 baseline integration | +100 |

## Success Criteria Met

- [x] `node --test bin/load-baseline-requirements.test.cjs` passes all 20 tests
- [x] `node bin/load-baseline-requirements.cjs --profile web` returns JSON with 34 total
- [x] `node bin/load-baseline-requirements.cjs --profile library` returns only Security + CI/CD categories
- [x] `node bin/load-baseline-requirements.cjs --list-profiles` returns 6 profiles
- [x] new-project.md includes "load-baseline-requirements" reference in bash command
- [x] new-project.md includes "Project Profile Selection" Step 6.5
- [x] new-project.md includes "Baseline Requirements" in 5 locations (step headings, generation instructions, success criteria)
- [x] new-project.md auto mode defaults to web profile
- [x] new-project.md includes all 6 profiles in picker
- [x] new-milestone.md includes "load-baseline-requirements" reference
- [x] new-milestone.md includes "Project Profile Selection" Step 8.5
- [x] new-milestone.md includes "Baseline Requirements" in 7 locations
- [x] new-milestone.md includes carry-forward detection (EXISTING_PROFILE, HAS_BASELINE)
- [x] Both workflows integrate baseline requirements with own ID namespace

## Deviations from Plan

None. Plan executed exactly as written. Implementation matched all requirements and test specifications.

## Technical Notes

1. **Per-requirement profiles:** The JSON files were already structured with per-requirement `profiles` arrays, making excludes-based filtering unnecessary. The simplified approach using these arrays is more maintainable.

2. **ID generation:** Baseline requirement IDs are assigned based on the category's `id_template` field (e.g., "UX-{N}"), ensuring consistency with the baseline requirement definitions.

3. **CLI robustness:** The utility gracefully handles invalid profiles with clear error messages and supports piping JSON to downstream tools.

4. **Test isolation:** Tests use Node.js built-in test framework (same as existing patterns in qgsd.test.cjs) for consistency and no external dependencies.

## Next Steps

This feature is ready for integration testing when users create new projects with `/qgsd:new-project` and milestones with `/qgsd:new-milestone`. The baseline requirements will automatically appear in REQUIREMENTS.md with clear opt-out controls.
