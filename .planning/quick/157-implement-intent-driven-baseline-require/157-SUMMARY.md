---
phase: quick-157
plan: 01
subsystem: baseline-requirements
tags: [baseline-requirements, intent-driven, auto-detection, packs]
tech-stack:
  added:
    - Intent-based requirement filtering (conditional packs)
    - Auto-detection from repo signals (Terraform, Docker, etc.)
    - Multi-dimensional intent objects (base_profile, iac, deploy, sensitive, oss, monorepo)
  patterns:
    - "Packs model: always vs conditional activation"
    - "Signal confidence levels: high/medium/low"
    - "Enriched intent: defaults + user input + derived fields (has_ui)"
key-files:
  created:
    - qgsd-core/defaults/baseline-requirements/iac.json (12 IaC requirements)
    - bin/detect-project-intent.cjs (repo signal scanner)
    - bin/detect-project-intent.test.cjs (10 detection tests)
  modified:
    - qgsd-core/defaults/baseline-requirements/index.json (added packs section, total 46 reqs)
    - bin/load-baseline-requirements.cjs (added loadBaselineRequirementsFromIntent, --intent-file CLI)
    - bin/load-baseline-requirements.test.cjs (added 9 intent tests, 29 total)
    - bin/sync-baseline-requirements.cjs (added syncBaselineRequirementsFromIntent, _syncFromBaseline helper)
    - bin/sync-baseline-requirements.test.cjs (added 6 intent sync tests, 18 total)
    - commands/qgsd/sync-baselines.md (updated with --detect mode and user confirmation flow)
duration: ~2 hours
completed: 2026-03-04
---

# Quick Task 157: Implement Intent-Driven Baseline Requirements Pack System

## Summary

Implemented the intent-driven baseline requirements pack system with three core capabilities:

1. **Packs Model**: Unified all 34 existing requirements + 12 new IaC requirements into 7 configurable packs (4 always-on, 3 conditional)
2. **Auto-Detection**: Scans repository for signals (Terraform, Docker, OSS markers, etc.) to suggest project intent with confidence levels
3. **Intent-Based Filtering**: Loads requirement sets dynamically based on multi-dimensional intent objects (base_profile, iac, deploy, sensitive, oss, monorepo)

## Tasks Completed

### Task 1: Create IaC pack, extend index.json with packs model, add loadBaselineRequirementsFromIntent

- **iac.json**: Created with 12 Infrastructure as Code requirements covering Terraform/Pulumi, linting, CI validation, secrets management, environment separation, state management, modules, PR review, version pinning, and documentation
- **index.json**: Extended with `packs` section mapping 7 requirement category files (security, reliability, observability, ci-cd, ux-heuristics, performance, iac)
  - 4 always-on packs: security, reliability, observability, ci-cd
  - 3 conditional packs: ux-heuristics, performance (always included due to per-requirement filtering), iac (activated when intent.iac=true)
  - Updated total_requirements: 34 → 46
- **loadBaselineRequirementsFromIntent()**: New function implementing intent-based loading
  - Validates base_profile (required)
  - Derives has_ui from base_profile: true for web/mobile/desktop, false for api/cli/library
  - Builds enriched intent with defaults (iac:false, deploy:"none", sensitive:false, oss:false, monorepo:false)
  - Evaluates pack activation rules (always vs conditional)
  - Filters requirements by both pack membership and per-requirement profiles array
  - Returns object with profile, label, intent, categories, packs_applied, total
- **CLI Support**: Added --intent-file <path> flag to load intent from JSON file
- **Backwards Compatibility**: Original loadBaselineRequirements() function unchanged; all 20 existing tests pass

### Task 2: Create detect-project-intent, extend sync-baseline-requirements, update skill

- **detect-project-intent.cjs**: New repo signal scanner with 6 detection dimensions
  - **base_profile** (medium confidence): Scans package.json for framework markers (next/nuxt/vite→web, react-native→mobile, electron→desktop, bin field→cli, openapi→api)
  - **iac** (high confidence): Checks for *.tf, Pulumi.yaml, cdk.json, serverless.yml, infra/ directory
  - **deploy** (high confidence): Detects Dockerfile→docker, fly.toml→fly, vercel.json→vercel, Procfile→heroku
  - **sensitive** (medium confidence): Scans for auth libs (passport, next-auth, auth0) and payment libs (stripe, paypal)
  - **oss** (high confidence): Detects LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md
  - **monorepo** (high confidence): Finds pnpm-workspace.yaml, lerna.json, nx.json, turbo.json
  - Returns: suggested intent, signals array with dimension/confidence/evidence, needs_confirmation array
  - CLI: `--root <path>` and `--json` flags
  - Uses only fs/path (zero external dependencies)
- **sync-baseline-requirements.cjs Refactoring**:
  - Extracted merge logic into _syncFromBaseline() private helper (steps 2-7)
  - Created syncBaselineRequirementsFromIntent() function (mirrors profile-based function)
  - Added CLI flags in priority order: --intent-file > --detect > --profile > config.json intent > config.json profile
  - Maintains identical behavior for profile mode after refactor
  - All 12 existing tests pass
- **sync-baselines.md Skill Update**:
  - Updated to support three modes: profile-based, intent-based (--detect), intent-file
  - Step 1: Mode selection and intent confirmation (shows detection signals, asks for confirmation on medium-confidence dims)
  - Step 2: Run sync with chosen method
  - Step 3: Persist intent to .planning/config.json if auto-detected
  - Step 4: Commit if requirements added

### Task 3: Add tests for detect-project-intent, extend load-baseline and sync-baseline tests

- **detect-project-intent.test.cjs**: 10 tests
  - Empty directory → all false, base_profile unknown
  - Terraform detection → iac:true, high confidence
  - LICENSE detection → oss:true, high confidence
  - Dockerfile detection → deploy:docker, high confidence
  - pnpm-workspace.yaml → monorepo:true
  - Next.js detection → base_profile:web, medium confidence
  - Electron detection → base_profile:desktop, medium confidence
  - Combined signals → all dimensions merge correctly
  - Return shape validation → suggested/signals/needs_confirmation types correct
  - CLI --json flag → produces valid JSON output
  - All 10 tests pass

- **load-baseline-requirements.test.cjs**: 9 new tests added (29 total)
  - Test 21: web intent returns 34 reqs (same as profile)
  - Test 22: cli intent returns 13 reqs (same as profile)
  - Test 23: web+iac intent returns 46 reqs (34 + 12 IaC)
  - Test 24: library+iac returns 6 (library not in IaC profiles)
  - Test 25: web+iac packs_applied contains all 7 packs
  - Test 26: cli intent packs_applied excludes conditional iac
  - Test 27: missing base_profile throws error
  - Test 28: api intent works with defaults
  - Test 29: intent result has enriched intent with has_ui derived
  - All 29 tests pass (20 existing unchanged + 9 new)

- **sync-baseline-requirements.test.cjs**: 6 new tests added (18 total)
  - Test 13: syncBaselineRequirementsFromIntent on empty project
  - Test 14: idempotency on second run
  - Test 15: IAC prefix independent counter
  - Test 16: backwards compat profile sync still works
  - Test 17: sequential sync (profile then intent adds only new packs)
  - Test 18: return shape validation
  - All 18 tests pass (12 existing unchanged + 6 new)

## Verification

✅ **Backwards Compatibility**
- `node bin/load-baseline-requirements.cjs --profile cli` → 13 reqs (unchanged)
- `node --test bin/load-baseline-requirements.test.cjs` → 20 original tests pass
- `node --test bin/sync-baseline-requirements.test.cjs` → 12 original tests pass

✅ **Intent-Based Loading**
- `node bin/load-baseline-requirements.cjs --intent-file /tmp/intent.json` with `{base_profile:"cli"}` → 13 reqs ✓
- `node bin/load-baseline-requirements.cjs --intent-file /tmp/intent.json` with `{base_profile:"web",iac:true}` → 46 reqs ✓
- `loadBaselineRequirementsFromIntent({base_profile:"web"})` → packs_applied has 7 entries ✓

✅ **Project Intent Detection**
- `node bin/detect-project-intent.cjs --root /Users/jonathanborduas/code/QGSD --json` → valid JSON with base_profile:cli, oss:true, needs_confirmation includes base_profile ✓

✅ **Intent-Based Sync**
- `node bin/sync-baseline-requirements.cjs --detect --json` → end-to-end detection+sync works ✓
- Sequential sync: profile then intent → only new packs added on second call ✓

✅ **Test Coverage**
- 10 detect tests + 9 load-baseline intent tests + 6 sync-baseline intent tests = 25 new tests
- Full suite: 57 tests pass (10 detect + 29 load-baseline + 18 sync-baseline)

## Deviations from Plan

None - plan executed exactly as written.

All success criteria met:
- ✅ iac.json has 12 requirements in correct format
- ✅ index.json has packs section with 7 entries
- ✅ loadBaselineRequirementsFromIntent produces correct filtered sets
- ✅ detectProjectIntent scans repo and produces intent with confidence
- ✅ syncBaselineRequirementsFromIntent merges intent-based baselines idempotently
- ✅ sync-baselines.md supports --detect mode with user confirmation
- ✅ All 20 existing load-baseline tests pass
- ✅ All 12 existing sync-baseline tests pass
- ✅ 25 new tests cover intent loading, detection, and intent sync

## Key Design Decisions

1. **Packs as First-Class Concept**: Moved from direct category references to explicit packs section in index.json, enabling clean conditional activation logic
2. **has_ui Derivation**: Automatically derived from base_profile to enable smart filtering without explicit user input
3. **Signal Confidence Levels**: High-confidence signals (filesystem artifacts) used directly; medium-confidence signals (package.json deps) added to needs_confirmation for user approval
4. **Zero External Dependencies**: detect-project-intent.cjs uses only fs/path, keeping the tool lightweight
5. **Refactored Internals**: _syncFromBaseline() helper eliminates code duplication while maintaining identical behavior for existing profile-based sync

## Next Steps

The intent-driven baseline system is now ready for integration into:
- /qgsd:new-project workflow (can auto-detect intent instead of asking profile)
- /qgsd:new-milestone workflow (can sync intent-based requirements)
- Manual /qgsd:sync-baselines invocations (supports --detect flag)

Users can now:
1. Let QGSD auto-detect their project intent from repo signals
2. Confirm/customize detected dimensions (medium-confidence items)
3. Load appropriate requirement sets based on detected intent
4. Persist intent to .planning/config.json for future runs
