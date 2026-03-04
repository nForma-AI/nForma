---
phase: quick-153
plan: 01
subsystem: requirements
tags: [requirements, baseline, idempotent, merge, cli]

requires:
  - phase: quick-151
    provides: loadBaselineRequirements(profile) function and baseline requirement data
provides:
  - syncBaselineRequirements(profile, projectRoot) — idempotent merge of baseline reqs into requirements.json
  - CLI with --profile flag, config.json fallback, --json output
affects: [new-project workflow, new-milestone workflow, requirements management]

tech-stack:
  added: []
  patterns: [text-field dedup matching, next-available ID assignment per prefix, defensive hash comparison]

key-files:
  created:
    - bin/sync-baseline-requirements.cjs
    - bin/sync-baseline-requirements.test.cjs
  modified: []

key-decisions:
  - "Match on exact text field for deduplication (not ID, since IDs may differ across projects)"
  - "Defensive hash comparison: only write file if content_hash actually changed"
  - "ID padding adapts beyond 99 (UX-99 -> UX-100 with 3-digit padding)"

patterns-established:
  - "Baseline sync pattern: load baseline -> match on text -> assign next-available IDs -> update envelope"

requirements-completed: [QUICK-153]

duration: 2min
completed: 2026-03-04
---

# Quick Task 153: sync-baseline-requirements Summary

**Idempotent CLI tool merging baseline requirements into .formal/requirements.json with text-field dedup and next-available ID assignment**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T10:37:51Z
- **Completed:** 2026-03-04T10:39:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `bin/sync-baseline-requirements.cjs` with dual module/CLI interface
- Text-field matching prevents duplicate entries across re-runs
- Next-available ID assignment per prefix namespace (no collisions)
- 12-test suite covering all merge scenarios with temp directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sync-baseline-requirements module and CLI** - `eef57bd5` (feat)
2. **Task 2: Create comprehensive test suite** - `7a70a337` (test)

## Files Created/Modified
- `bin/sync-baseline-requirements.cjs` - Idempotent merge tool: loads baselines, matches on text, assigns next-available IDs, updates envelope
- `bin/sync-baseline-requirements.test.cjs` - 12 tests covering empty merge, idempotency, text dedup, ID assignment, provenance, envelope, ID padding >99

## Decisions Made
- Match on exact `text` field for deduplication (IDs may differ across projects)
- Defensive hash comparison before writing (quorum feedback)
- ID padding adapts beyond 99 entries (quorum feedback)
- try-catch on loadBaselineRequirements with exit code 2 (quorum feedback)

## Deviations from Plan

None - plan executed exactly as written. Quorum feedback items (try-catch, ID padding test, defensive hash) were incorporated as specified in constraints.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool ready for integration into new-project and new-milestone workflows
- Can be called programmatically via `syncBaselineRequirements(profile, projectRoot)`

---
*Phase: quick-153*
*Completed: 2026-03-04*
