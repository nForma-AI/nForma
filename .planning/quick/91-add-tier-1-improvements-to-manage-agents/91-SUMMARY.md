---
phase: quick-91
plan: 01
subsystem: manage-agents
tags: [cli, ux, health-check, provider-probe, mcp-logs, performance]
dependency_graph:
  requires: [bin/manage-agents.cjs, bin/review-mcp-logs.cjs, bin/check-provider-health.cjs]
  provides: [probeProviderUrl, checkAgentHealth, provider-preflight-add, provider-preflight-edit, perf-row-in-edit]
  affects: [bin/manage-agents.cjs]
tech_stack:
  added: [spawnSync/child_process]
  patterns: [HTTP probe with timeout, spawnSync for subprocess JSON, inquirer confirm guard]
key_files:
  modified: [bin/manage-agents.cjs]
decisions:
  - probeProviderUrl uses same healthy-status set as check-provider-health.cjs (200/401/403/404/422)
  - spawnSync with 5s timeout for review-mcp-logs.cjs --json; silently omit Perf row on error or zero calls
  - checkAgentHealth uses probeProviderUrl not check-mcp-health.cjs (avoids 12s+ claude -p call)
  - Pre-flight runs after URL is typed but before writeClaudeJson — abort is clean (no partial write)
metrics:
  duration: ~12min
  completed: 2026-02-23
  tasks_completed: 3
  files_modified: 1
---

# Phase quick-91 Plan 01: Tier 1 Improvements to manage-agents.cjs Summary

Provider pre-flight check on Add/Edit, "Check agent health" menu option (6), and observed performance intel row in Edit summary card — all surfacing live provider and historical MCP log data at decision points.

## What Was Built

### Task 1: probeProviderUrl + provider pre-flight in Add and Edit

Added `probeProviderUrl(baseUrl, apiKey)` function after `fetchProviderModels`:
- Makes GET request to `${baseUrl}/models` with 7-second timeout
- Returns `{ healthy, latencyMs, statusCode, error }`
- Counts HTTP 200/401/403/404/422 as healthy (same logic as check-provider-health.cjs)
- Uses Node.js `https`/`http` directly (no new deps)

In `addAgent()`: after building the env object but before `writeClaudeJson`, if `baseUrl` is non-empty:
- Prints `Probing provider X...` inline
- Green `✓ Provider UP (Xms)` for healthy
- Yellow `⚠ Provider DOWN or unreachable` + `Save anyway? (y/N)` confirm for unhealthy
- N answer returns without writing to disk

In `editAgent()`: same pattern in the `// ── Base URL` block, after collecting baseUrl from prompt, if non-empty and not `'__REMOVE__'`.

### Task 2: checkAgentHealth() and menu option 6

Added `async function checkAgentHealth()`:
- Reads `~/.claude.json`, shows agent selector (same padded format as editAgent)
- If agent has `ANTHROPIC_BASE_URL`: runs `probeProviderUrl`, prints one-row result card (Agent/Status/URL/Model)
- If no `ANTHROPIC_BASE_URL`: prints `<slot> is a subprocess provider — no HTTP endpoint to probe.`

Updated `mainMenu()`:
- Added `{ name: '6. Check agent health', value: 'health' }` between reorder and Separator
- Added `else if (action === 'health') await checkAgentHealth();` dispatch

### Task 3: Performance intel row in Edit summary card

Added `const { spawnSync } = require('child_process');` at top of file.

In `editAgent()`, after all summary card rows and before the closing `└` border line:
- Runs `spawnSync('node', [reviewLogsPath, '--json', '--tool', slotName], { timeout: 5000 })`
- Parses `logData.serverStats[slotName]`
- If `totalCalls > 0`: builds `perfRow = "p95: Xs  max: Xs  failures: N/M  suggested timeout: Nms"`
  - Suggested timeout = `max(15000, ceil(p95Ms * 1.5 / 5000) * 5000)`
- Prints `row('Perf   ', perfRow)` if available
- Always prints `└─────┘` closing border (both branches included)
- Entire block wrapped in try/catch — silently omitted on error or no data

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `bin/manage-agents.cjs` modified and committed (fc58045)
- [x] `probeProviderUrl` function present
- [x] `checkAgentHealth` function present
- [x] Menu option `{ name: '6. Check agent health', value: 'health' }` present
- [x] `spawnSync` import present
- [x] Performance intel block present in editAgent summary card
- [x] Syntax check passes (`node --check`)

## Self-Check: PASSED
