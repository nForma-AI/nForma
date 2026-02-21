---
phase: 02-config-mcp-detection
plan: 02
subsystem: hooks
tags: [nodejs, tdd, stop-hook, fail-open, mcp-detection]

requires:
  - phase: 02-config-mcp-detection
    plan: 01
    provides: hooks/config-loader.js (shared loadConfig, DEFAULT_CONFIG)

provides:
  - hooks/qgsd-stop.js — migrated to shared config-loader, with fail-open unavailability detection
  - hooks/qgsd-stop.test.js — 3 new TDD tests (TC11-TC13) for fail-open behavior; 13/13 pass

affects: [02-04]

tech-stack:
  added: []
  patterns:
    - Fail-open unavailability detection (check ~/.claude.json mcpServers before blocking)
    - QGSD_CLAUDE_JSON env override for deterministic testing without touching real ~/.claude.json
    - Separate unavailableKeys tracking (skip) from missingKeys tracking (block)

key-files:
  created: []
  modified:
    - hooks/qgsd-stop.js
    - hooks/qgsd-stop.test.js

key-decisions:
  - "getAvailableMcpPrefixes() reads ~/.claude.json at hook runtime — not cached in qgsd.json — so real-time server list is always used for unavailability check"
  - "null return from getAvailableMcpPrefixes() → conservative: treat all models as potentially available → block on missing evidence (existing behavior preserved)"
  - "QGSD_CLAUDE_JSON env var for test injection: avoids mutating real ~/.claude.json in tests"
  - "Unavailability note in block reason when some models skipped (informational for user)"
  - "Unavailability note on stderr when all models pass/skip (no block issued)"
  - "KNOWN LIMITATION: only reads ~/.claude.json (user-scoped MCPs); project-scoped .mcp.json not checked — documented in getAvailableMcpPrefixes() comment"

patterns-established:
  - "Pattern: null = unknown → conservative (block); non-null array without prefix → unavailable (pass)"
  - "Pattern: runHookWithEnv() helper in tests passes extra env vars via spawnSync env option"

requirements-completed: [CONF-04, MCP-06]

duration: 10min
completed: 2026-02-20
---

# Phase 02 Plan 02: Stop Hook Migration Summary

**Migrated `qgsd-stop.js` to shared config-loader and added fail-open unavailability detection via `getAvailableMcpPrefixes()` — all 13 TDD tests pass (TC1-TC10 regression + TC11-TC13 new).**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-02-20
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

### Task 1: TDD — Stop hook fail-open unavailability detection (RED → GREEN → REFACTOR)

**RED phase:** Added TC11, TC12, TC13 to `qgsd-stop.test.js`:
- TC11: model prefix not in empty mcpServers → unavailable → pass (exit 0, empty stdout)
- TC12: codex in mcpServers but not called → block; gemini not in mcpServers → skip
- TC13: renamed prefix ("mcp__my-custom-codex__") in mcpServers and called → pass (MCP-06 regression)

Added `runHookWithEnv()` helper to pass `QGSD_CLAUDE_JSON` and `HOME` env vars for deterministic testing.

TC11 and TC13 failed (hook had no unavailability detection); TC12 coincidentally passed (hook blocked for the right result but wrong reason). RED confirmed.

**GREEN phase:** Changed `qgsd-stop.js`:
1. Removed inline `DEFAULT_CONFIG` object and `loadConfig()` function
2. Added `const { loadConfig, DEFAULT_CONFIG } = require('./config-loader')`
3. Added `getAvailableMcpPrefixes()` — reads `process.env.QGSD_CLAUDE_JSON || ~/.claude.json`, returns array of `"mcp__" + serverName + "__"` prefixes, or null on missing/malformed file
4. Updated `missingKeys` filter: checks `availablePrefixes` — if non-null and model prefix not found → push to `unavailableKeys`, skip from `missingKeys`
5. Updated pass path: if `unavailableKeys.length > 0`, emit stderr INFO note before `process.exit(0)`
6. Updated block path: if `unavailableKeys.length > 0`, append note to `blockReason`

All 13 tests pass.

**REFACTOR phase:** Verified no stdout output in `getAvailableMcpPrefixes()` or unavailability code paths. Only `process.stderr.write()` used for warnings/notes.

## Self-Check: PASSED

All verification checks pass:
- `node --test hooks/qgsd-stop.test.js` → 13/13 pass
- `grep "require('./config-loader')" hooks/qgsd-stop.js` → match
- `grep "function loadConfig\|const DEFAULT_CONFIG" hooks/qgsd-stop.js` → no match (inline removed)
- `grep "getAvailableMcpPrefixes" hooks/qgsd-stop.js` → 2 matches (definition + call)
- `node --test hooks/config-loader.test.js` → 10/10 still pass
