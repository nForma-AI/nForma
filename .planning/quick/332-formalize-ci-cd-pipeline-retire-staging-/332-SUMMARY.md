---
phase: quick-332
plan: 01
subsystem: infra
tags: [ci-cd, workflows, npm-publish, prerelease, github-actions]

# Dependency graph
requires:
  - phase: quick-322
    provides: "Code base with nf branding for PR"
provides:
  - "Formalized CI/CD pipeline: retire staging, add @next prerelease"
  - "Prerelease workflow for v*-rc* and v*-next* tags"
  - "Production-ready npm @next distribution channel"
affects: [quick-330, quick-331, release-pipeline, npm-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns: ["GitHub Actions tag-based workflow triggers", "Semantic versioning with prerelease tags"]

key-files:
  created:
    - ".github/workflows/prerelease.yml"
  modified:
    - ".github/workflows/ci.yml"

key-decisions:
  - "Eliminated staging-publish workflow and @staging npm dist-tag in favor of proper @next"
  - "Prerelease tags (v*-rc*, v*-next*) trigger full test suite before @next publication"
  - "Prerelease workflow stamps version directly from git tag (no custom versioning)"
  - "No GitHub Release creation for prerelease tags (only for stable releases)"

patterns-established:
  - "Tag-based workflow triggering: git tags drive CI/CD pipelines"
  - "npm dist-tags align with release model: @latest (stable), @next (prerelease)"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-19
---

# Quick Task 332: Formalize CI/CD Pipeline, Retire Staging Summary

**Prerelease workflow added for @next npm dist-tag, staging-publish workflow retired, ci.yml scoped to main branch only**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-19T14:30:00Z
- **Completed:** 2026-03-19T14:35:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 deleted, 1 created, 1 modified)

## Accomplishments

- Deleted dead staging-publish.yml workflow
- Removed all staging branch references from ci.yml — now triggers only on main
- Created prerelease.yml with v*-rc* and v*-next* tag triggers, full test suite, and @next npm publication
- Updated PR #31 body to document quick-332 CI/CD changes
- PR #31 remains open from nf/quick-322-replace-qgsd-with-nf-in-active-code-core into main

## Task Commits

1. **Task 1: Retire staging-publish.yml and clean ci.yml staging refs** - `bb85f839` (ci)
2. **Task 2: Create prerelease.yml for v*-rc* and v*-next* tags → npm @next** - (part of bb85f839)
3. **Task 3: Commit changes and open PR for quick-322 into main** - (commit and PR update completed)

## Files Created/Modified

- `.github/workflows/prerelease.yml` - New prerelease workflow for v*-rc* and v*-next* tags, publishes with `--tag next`
- `.github/workflows/ci.yml` - Removed staging branch from push/pull_request triggers
- `.github/workflows/staging-publish.yml` - Deleted (no longer needed)

## Decisions Made

- **Eliminated dual dist-tags:** The @staging npm dist-tag and staging-publish workflow were abandoned. The proper prerelease model uses @next with formal version numbers (e.g., 0.39.0-rc.1) instead of timestamps.
- **Tag-driven prerelease:** Semantic versioning with v*-rc* and v*-next* git tags triggers publication to @next. This aligns with standard npm prerelease practices.
- **No GitHub Releases for prerelease:** The prerelease workflow skips the GitHub Release creation job. Only stable releases (via release.yml) create full GitHub Releases.
- **Full test suite on prerelease:** Prerelease tags run the complete test suite (npm run test:ci, npm run test:tui, lint:isolation) before publication, matching production safety standards.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All success criteria from plan verified:

- `ls .github/workflows/staging-publish.yml` → No such file (deleted)
- `grep staging .github/workflows/ci.yml` → No output (cleaned)
- `grep 'v\*-rc\*\|v\*-next\*' .github/workflows/prerelease.yml` → 2 matches (tag triggers correct)
- `grep 'tag next' .github/workflows/prerelease.yml` → Match (publishes with @next)
- `grep 'npm-publish' .github/workflows/prerelease.yml` → Match (environment reference correct)
- `grep 'id-token: write' .github/workflows/prerelease.yml` → Match (provenance permission correct)
- `gh pr list --head nf/quick-322-replace-qgsd-with-nf-in-active-code-core --state open` → PR #31 open

## Issues Encountered

None - clean execution.

## Next Phase Readiness

The CI/CD pipeline is now formalized:
- Production releases (stable versions) use `release.yml` → npm @latest
- Prerelease candidates (RC and next versions) use new `prerelease.yml` → npm @next
- PR #31 is ready to land both quick-322 (nf rebrand) and quick-332 (CI/CD formalization) changes

---
*Quick Task: 332*
*Completed: 2026-03-19*
