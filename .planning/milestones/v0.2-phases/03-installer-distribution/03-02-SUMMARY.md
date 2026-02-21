---
phase: 03-installer-distribution
plan: "03-02"
subsystem: infra
tags: [installer, mcp-detection, validation, warn, redetect, reinstall-summary]

# Dependency graph
requires:
  - phase: 02-config-mcp-detection
    provides: buildRequiredModelsFromMcp(), QGSD_KEYWORD_MAP, buildQuorumInstructions()
provides:
  - warnMissingMcpServers() function: per-model yellow warning for each absent quorum MCP server
  - warnMissingMcpServers() called on every install run before hook registration (INST-05)
  - --redetect-mcps CLI flag: deletes qgsd.json so fresh MCP detection runs
  - INST-06 reinstall summary: active required_models prefixes printed when qgsd.json exists
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-open MCP validation: warn per model but never abort install"
    - "--redetect-mcps flag pattern: delete-then-regenerate for fresh config detection"
    - "INST-06 reinstall summary: read existing qgsd.json, surface active prefixes to user"

key-files:
  created: []
  modified:
    - bin/install.js

key-decisions:
  - "warnMissingMcpServers() reads QGSD_KEYWORD_MAP (same source as buildRequiredModelsFromMcp) so warning set stays in sync with detection set automatically"
  - "warnMissingMcpServers() placed after buildQuorumInstructions() and before parseConfigDirArg() — at the function-definition layer, not inside any install branch"
  - "INST-06 catch block falls back to original 'already exists — skipping' message for malformed qgsd.json"

patterns-established:
  - "MCP validation on every install: call warnMissingMcpServers() before hook registration, regardless of whether qgsd.json already exists"

requirements-completed: [INST-05, INST-06]

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 3 Plan 02: Installer Enhancements Summary

**Per-model MCP validation warning (INST-05) + reinstall config summary (INST-06) + --redetect-mcps flag added to bin/install.js**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T22:14:19Z
- **Completed:** 2026-02-20T22:15:57Z
- **Tasks:** 4
- **Files modified:** 1

## Accomplishments
- `warnMissingMcpServers()` function added: reads QGSD_KEYWORD_MAP and emits per-model yellow warning for each quorum MCP server not found in ~/.claude.json
- Function called before every hook registration block — runs on both fresh install and reinstall (INST-05)
- `--redetect-mcps` flag parsed from args: when set and qgsd.json exists, deletes it so the existing `if (!fs.existsSync(qgsdConfigPath))` block regenerates it from fresh MCP detection
- On reinstall when qgsd.json exists: active `required_models` prefix map printed as `model → prefix` summary with --redetect-mcps hint (INST-06)

## Task Commits

All four tasks committed atomically in a single commit (plan spec called for one commit):

1. **All tasks (1-4): --redetect-mcps flag, warnMissingMcpServers function, wire call, INST-06 summary** - `f4a8ad6` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `/Users/jonathanborduas/code/QGSD/bin/install.js` - Added hasRedetectMcps flag, warnMissingMcpServers() function, INST-05 wire call before hook registration, --redetect-mcps delete-then-regen logic, INST-06 reinstall config summary

## Decisions Made
- Followed plan as specified — all four tasks were direct additions with no architectural changes needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- INST-05 validation and INST-06 summary active in installer
- --redetect-mcps flag usable for refresh scenarios
- Ready for 03-03: verify checkpoint (build hooks, run installer, verify end-to-end)

---
*Phase: 03-installer-distribution*
*Completed: 2026-02-20*
