---
phase: quick-282
plan: 01
subsystem: infra
tags: [mcp, health-check, deep-probe, service-lifecycle, ccr]

requires:
  - phase: quick-279
    provides: dual-subscription slot wiring in providers.json
  - phase: quick-281
    provides: two-layer health probe in quorum-preflight.cjs
provides:
  - deep_health_check MCP tool with 6-layer failure classification
  - service lifecycle (start/stop/status) for ccr-based slots
  - 4-step diagnostic flow in mcp-repair skill
affects: [mcp-repair, quorum-preflight, unified-mcp-server]

tech-stack:
  added: []
  patterns: [deep-inference-probe, service-lifecycle-management, polling-based-restart]

key-files:
  created: []
  modified:
    - bin/providers.json
    - bin/unified-mcp-server.mjs
    - commands/nf/mcp-repair.md

key-decisions:
  - "deep_health_check is additive — existing health_check tool unchanged for fast dashboards"
  - "Service lifecycle (ccr start/stop/status) only on claude-1..6 — CLI slots are stateless binaries"
  - "Service status check wrapped with 3s timeout to prevent hangs on unresponsive ccr"
  - "Fallback classification re-checks all error keywords before declaring INFERENCE_OK"
  - "HTTP provider deep probe uses runSlotHttpProvider instead of subprocess for correct routing"

patterns-established:
  - "Deep probe pattern: binary check -> service status -> inference probe -> classify"
  - "Polling-based restart: 1s interval, 10s max, no hardcoded sleep"

requirements-completed: [QUICK-282]

duration: 6min
completed: 2026-03-12
---

# Quick 282: Add Service Lifecycle and Deep Inference Probe Summary

**deep_health_check MCP tool with 6-layer failure classification (BINARY_MISSING, SERVICE_DOWN, AUTH_EXPIRED, QUOTA_EXCEEDED, INFERENCE_TIMEOUT, INFERENCE_OK) plus ccr service lifecycle management**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T19:15:35Z
- **Completed:** 2026-03-12T19:21:17Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added deep_probe config to all 12 provider slots and service lifecycle (start/stop/status) to claude-1..6
- Implemented deep_health_check MCP tool with 3-step probe (binary, service status, inference) and 6-layer classification
- Updated mcp-repair skill with 4-step diagnostic flow including polling-based service auto-start

## Task Commits

Each task was committed atomically:

1. **Task 1: Add service lifecycle and deep_probe fields to providers.json** - `d18337eb` (feat)
2. **Task 2: Add deep_health_check tool to unified-mcp-server.mjs** - `02e1c64b` (feat)
3. **Task 3: Update mcp-repair.md with 4-step deep diagnostic flow** - `9851c5dd` (feat)

## Files Created/Modified
- `bin/providers.json` - Added deep_probe config (all 12 slots) and service lifecycle (claude-1..6 only)
- `bin/unified-mcp-server.mjs` - Added runDeepHealthCheck(), runDeepHealthCheckHttp(), tool registration and handlers for all provider types
- `commands/nf/mcp-repair.md` - Updated to 4-step diagnostic with deep_health_check tools, service auto-start, Layer column in diagnosis table

## Decisions Made
- deep_health_check is purely additive — existing health_check remains unchanged for fast dashboard use
- Service lifecycle commands use ccr binary directly (ccr start/stop/status) since all claude-1..6 slots run through ccr
- 3-second timeout on service status prevents the deep probe from hanging indefinitely on unresponsive services
- HTTP provider deep probe uses dedicated runDeepHealthCheckHttp() with same classification logic but HTTP transport
- Fallback path re-checks error keywords before declaring INFERENCE_OK to avoid false positives

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- deep_health_check tool available for all quorum slots via MCP
- mcp-repair skill ready to use 4-step diagnostic with service auto-start
- Service lifecycle commands ready for ccr-based slots

---
*Phase: quick-282*
*Completed: 2026-03-12*
