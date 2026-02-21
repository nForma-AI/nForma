---
phase: 08-installer-integration
plan: "01"
subsystem: installer
tags: [nodejs, circuit-breaker, hooks, settings-json, installer, cli-flags]

# Dependency graph
requires:
  - phase: 07-enforcement-config-integration
    provides: qgsd-circuit-breaker.js hook built and tested; hooks/dist up to date
  - phase: 03-installer-distribution
    provides: bin/install.js with idempotent hook registration pattern (readSettings/writeSettings/buildHookCommand)
provides:
  - PreToolUse circuit breaker hook registered idempotently in ~/.claude/settings.json on Claude Code install
  - circuit_breaker config block (oscillation_depth:3, commit_window:6) written to qgsd.json on fresh install
  - Idempotent circuit_breaker backfill in reinstall path (existing user values never overwritten)
  - --reset-breaker CLI flag that clears project-relative circuit-breaker-state.json and exits before install
  - templates/qgsd.json updated with circuit_breaker block for manual install reference
affects: [users running npx qgsd@latest, projects using circuit breaker, docs referencing install output]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PreToolUse hook registration with timeout:10 inside !isOpencode guard
    - Top-level CLI flag handler that exits before main routing block (--reset-breaker pattern)
    - Idempotent key-presence check for reinstall config backfill (never deep merge or overwrite)

key-files:
  created: []
  modified:
    - bin/install.js
    - templates/qgsd.json

key-decisions:
  - "--reset-breaker uses process.cwd() (not targetDir/global dir) for state file path — state is project-relative per RECV-01"
  - "PreToolUse registration inside !isOpencode guard — circuit breaker is Claude Code-only in v0.2"
  - "timeout:10 for PreToolUse hook (lighter than Stop hook timeout:30 — git spawnSync calls have internal 5s timeouts)"
  - "Reinstall backfill checks only top-level circuit_breaker key presence — never inspects or modifies sub-keys if parent exists"
  - "templates/qgsd.json updated for documentation completeness; installer still builds qgsdConfig in-memory (template not read at runtime)"

patterns-established:
  - "Pattern: All new CLI exit-early flags are parsed alongside other args at top of file, handler placed before main routing block"
  - "Pattern: Reinstall idempotency for config keys — check presence, add if missing, never overwrite existing"

requirements-completed: [INST-08, INST-09, INST-10, RECV-01]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 8 Plan 01: Installer Integration Summary

**PreToolUse circuit breaker hook auto-registered in settings.json, circuit_breaker config block written on fresh install, idempotent backfill on reinstall, and --reset-breaker CLI flag for deadlock recovery**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T08:55:51Z
- **Completed:** 2026-02-21T08:57:46Z
- **Tasks:** 3 (2 auto + 1 checkpoint:verify)
- **Files modified:** 2

## Accomplishments
- Four surgical changes to bin/install.js: RECV-01 --reset-breaker handler, INST-08 PreToolUse registration, INST-09 new-install circuit_breaker config, INST-10 reinstall backfill
- All 6 end-to-end verification checks passed (--reset-breaker both file-absent and file-present cases, PreToolUse registration, circuit_breaker values, reinstall guard, npm test 138/138)
- templates/qgsd.json updated with circuit_breaker documentation block; hooks/dist rebuilt with qgsd-circuit-breaker.js present

## Task Commits

Each task was committed atomically:

1. **Tasks 1 + 2: Extend bin/install.js + update templates/qgsd.json** - `29d4b2e` (feat)
2. **Task 3: checkpoint:verify — all 6 checks passed** - automated; no separate commit

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `bin/install.js` - Four surgical changes: hasResetBreaker arg + handler, PreToolUse hook registration, circuit_breaker in qgsdConfig, reinstall backfill
- `templates/qgsd.json` - Added circuit_breaker block with oscillation_depth:3 and commit_window:6

## Decisions Made
- `--reset-breaker` uses `process.cwd()` not `targetDir` — state file is project-relative, not global install dir
- PreToolUse registration placed inside `if (!isOpencode)` guard — circuit breaker is Claude Code-only in v0.2
- `timeout: 10` for PreToolUse (vs Stop hook's `timeout: 30`) — circuit breaker is lighter, git spawnSync has internal 5s timeouts
- Reinstall backfill only checks `!existingConfig.circuit_breaker` at top level — user-modified values are never touched

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 complete — v0.2 Anti-Oscillation Pattern fully implemented (Phases 6-8)
- v0.2 milestone: Circuit breaker hook built (Phase 6), config integration + enforcement tested (Phase 7), installer integration complete (Phase 8)
- Running `npx qgsd@latest` now auto-registers the circuit breaker PreToolUse hook and writes the circuit_breaker config block

---
*Phase: 08-installer-integration*
*Completed: 2026-02-21*
