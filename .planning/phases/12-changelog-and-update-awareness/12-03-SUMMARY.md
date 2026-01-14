---
phase: 12-changelog-and-update-awareness
plan: 03
subsystem: infra
tags: [changelog, version, whats-new, update-awareness]

requires:
  - phase: 12-01
    provides: CHANGELOG.md file and installer changelog copy
provides:
  - /gsd:whats-new command for version comparison
  - VERSION file written during installation
  - Help documentation for whats-new command
affects: []

tech-stack:
  added: []
  patterns:
    - Remote changelog fetch via WebFetch for update awareness
    - VERSION file for installed version tracking

key-files:
  created:
    - commands/gsd/whats-new.md
  modified:
    - bin/install.js
    - commands/gsd/help.md

key-decisions:
  - "VERSION file approach (simpler than parsing package.json)"
  - "Remote fetch from GitHub raw for discovering unreleased changes"
  - "Graceful fallback to local changelog when offline"

duration: 4min
completed: 2026-01-14
---

# Phase 12 Plan 03: whats-new Command Summary

**/gsd:whats-new command created for users to discover changes since their installed version, with VERSION file written during installation and help documentation updated**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-14T20:10:00Z
- **Completed:** 2026-01-14T20:14:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created /gsd:whats-new command with remote changelog fetch
- Added VERSION file creation to installer
- Updated help.md with whats-new command documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create whats-new.md command** - `1a55ac8` (feat)
2. **Task 2: Update install.js to write VERSION file** - `b281148` (feat)
3. **Task 3: Update help.md to include whats-new command** - `68f3cd1` (docs)

## Files Created/Modified
- `commands/gsd/whats-new.md` - Command for version comparison and changelog display
- `bin/install.js` - Added VERSION file creation during installation
- `commands/gsd/help.md` - Added whats-new to Utility Commands section

## Decisions Made
- VERSION file approach chosen over parsing package.json (simpler, more reliable)
- Remote fetch from GitHub enables discovering changes in versions not yet installed
- Graceful fallback to local changelog when offline or GitHub unavailable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- /gsd:whats-new command ready for users to discover updates
- Phase 12 complete (all 3 plans finished)
- Ready for phase completion and milestone wrap-up

---
*Phase: 12-changelog-and-update-awareness*
*Completed: 2026-01-14*
