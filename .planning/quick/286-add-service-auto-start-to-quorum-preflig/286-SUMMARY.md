---
phase: quick-286
plan: 01
subsystem: infra
tags: [quorum, preflight, ccr, service-lifecycle, health-probe]

requires:
  - phase: quick-281
    provides: "two-layer parallel health probe in quorum-preflight.cjs"
  - phase: quick-282
    provides: "service lifecycle blocks in providers.json"
provides:
  - "Auto-start ccr service before health probe fan-out in quorum-preflight.cjs"
  - "ensureServices() function with dedup, polling, fail-open semantics"
affects: [quorum-preflight, mcp-repair]

tech-stack:
  added: []
  patterns: [sync-service-poll-1s-10max, fail-open-service-management]

key-files:
  created: []
  modified: [bin/quorum-preflight.cjs]

key-decisions:
  - "Used execFileSync (no shell) for service status/start commands -- safe from injection"
  - "Dedup by JSON.stringify(p.service.status) so ccr checked once, not 6 times"
  - "Fail-open: ensureServices never throws, health probe always runs regardless"

patterns-established:
  - "Service auto-start before probe: ensureServices() runs sync before async probeHealth()"
  - "Poll pattern: 1s interval, 10 iterations max, matching mcp-repair convention"

requirements-completed: [QUICK-286]

duration: 2min
completed: 2026-03-13
---

# Quick 286: Add Service Auto-Start to quorum-preflight.cjs Summary

**Auto-start ccr service before health probe fan-out with 1s/10s poll, deduped by service command, fail-open semantics**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T16:35:53Z
- **Completed:** 2026-03-13T16:37:24Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added ensureServices() that checks service status and auto-starts stopped services before health probing
- Deduplicates by unique service.status command (ccr checked once, not per claude-* slot)
- Polls 1s interval, 10s max for readiness (matches mcp-repair pattern)
- Fail-open: service errors logged to stderr but never prevent health probing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ensureServices() to quorum-preflight.cjs** - `877aa29c` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `bin/quorum-preflight.cjs` - Added ensureServices() function and execFileSync import; integrated call in --all branch before probeHealth()

## Decisions Made
- Used `execFileSync` instead of `spawn` for service management since it must complete before async probeHealth starts
- Deduplication via `JSON.stringify(p.service.status)` Set -- simple and effective for identical command arrays
- Placed ensureServices call inside existing `if (PROBE)` block so `--no-probe` naturally skips service checks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service auto-start integrated into preflight pipeline
- No blockers

---
*Phase: quick-286*
*Completed: 2026-03-13*
