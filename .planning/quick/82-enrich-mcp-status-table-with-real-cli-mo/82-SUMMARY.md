---
phase: quick-82
plan: 01
subsystem: mcp-status
tags: [mcp, providers, unified-mcp-server, health_check, model-detection]

requires:
  - phase: quick-81
    provides: mcp-status sub-agent refactor that added the Task() sub-agent pattern
  - phase: quick-70
    provides: unified-mcp-server.mjs and providers.json initial build

provides:
  - Static model, display_provider, health_check_args fields in providers.json for all 6 subprocess providers
  - Dynamic model detection via model_detect (codex-1/2 reads ~/.codex/config.toml)
  - health_check tool on subprocess providers in unified-mcp-server.mjs
  - runSubprocessHealthCheck() function using --version for latency measurement
  - display_provider field exposed in identity response from buildIdentityResult
  - Claude orchestrator row at top of mcp-status table with model from ~/.claude/settings.json
  - Real latency for CLI agents (codex-1, gemini-1, opencode-1, copilot-1) from health_check
  - Correct provider display names via identity.display_provider preference

affects: [mcp-status, unified-mcp-server, providers, quorum-team-composition]

tech-stack:
  added: []
  patterns:
    - "model_detect pattern: subprocess providers declare file + regex pattern for dynamic model name resolution"
    - "health_check_args pattern: subprocess providers declare lightweight check args (--version) for latency measurement"
    - "display_provider field: static provider display name in providers.json, propagated through identity tool response"
    - "claudeModel detection: read ~/.claude/settings.json model field, map to full model ID with sonnet default"

key-files:
  created: []
  modified:
    - bin/providers.json
    - bin/unified-mcp-server.mjs
    - commands/qgsd/mcp-status.md

key-decisions:
  - "health_check_args uses ['--version'] for all CLI subprocess providers — fast, no LLM call, universal support"
  - "model_detect uses file+pattern approach (reads ~/.codex/config.toml) for codex only — gemini/opencode/copilot use static fallback"
  - "display_provider added as static field in providers.json for subprocess providers only — HTTP providers use URL_MAP lookup already in mcp-status.md"
  - "claudeModel defaults to claude-sonnet-4-6 when settings.json absent or unreadable"
  - "CLI agent health: null hc degrades gracefully to 'available' (health_check failure is non-fatal)"

patterns-established:
  - "providers.json is the canonical source for all provider metadata including model names, display_provider, and health check configuration"
  - "identity tool always returns display_provider field (null for HTTP providers, string for subprocess providers)"

requirements-completed: [Q82-01]

duration: 8min
completed: 2026-02-23
---

# Quick Task 82: Enrich MCP Status Table Summary

**Enriched mcp-status table with claude orchestrator row, real CLI model names (gpt-5.3-codex/gemini-2.5-pro/xai/grok-3/gpt-4.1), live latency from health_check --version, and correct provider display names via display_provider field**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-23T17:57:00Z
- **Completed:** 2026-02-23T18:05:08Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `model`, `model_detect`, `health_check_args`, and `display_provider` fields to all 6 subprocess providers in `providers.json`; codex-1/2 include dynamic detection from `~/.codex/config.toml`
- Updated `unified-mcp-server.mjs`: `buildIdentityResult` reads model_detect config and returns `display_provider`; `buildSlotTools` adds `health_check` tool for subprocess providers; new `runSubprocessHealthCheck()` function measures --version latency
- Updated `mcp-status.md`: 4 new CLI `health_check` tools in allowed-tools, `claudeModel` read in Step 1 Bash, health_check calls for all 4 CLI agents in Step 3 sub-agent, CLI latency populated from hc in Step 4, `identity.display_provider` preference in Step 5 provider inference, and claude orchestrator row at top of example table

## Task Commits

Each task was committed atomically in the final docs commit per quick-task protocol.

1. **Task 1: Add model metadata to providers.json** - providers.json updated
2. **Task 2: Add subprocess health_check + model detection to unified-mcp-server.mjs** - unified-mcp-server.mjs updated
3. **Task 3: Update mcp-status.md with claude row, CLI latency, and real provider names** - commands/qgsd/mcp-status.md updated

## Files Created/Modified

- `/Users/jonathanborduas/code/QGSD/bin/providers.json` - Added model, model_detect, health_check_args, display_provider to all 6 subprocess providers
- `/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs` - Added os import, model_detect resolution in buildIdentityResult, health_check tool in buildSlotTools, runSubprocessHealthCheck function, health_check dispatch in handleSlotToolCall
- `/Users/jonathanborduas/code/QGSD/commands/qgsd/mcp-status.md` - Added 4 CLI health_check tools in allowed-tools, claudeModel in Step 1, health_check calls in Step 3, CLI latency in Step 4, display_provider preference in Step 5, claude orchestrator row

## Decisions Made

- `health_check_args` uses `["--version"]` for all CLI subprocess providers — fast, no LLM call, universally supported
- `model_detect` only on codex-1/2 via `~/.codex/config.toml` — gemini/opencode/copilot use static model fallback in providers.json
- `display_provider` is a static field in providers.json for subprocess providers only; HTTP providers retain URL_MAP lookup
- `claudeModel` defaults to `claude-sonnet-4-6` when settings.json is absent or unreadable
- CLI agent `health_check` failure (null hc) degrades gracefully to `available` status rather than `error`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Self-Check

### Files exist
- `bin/providers.json` — present with all 6 subprocess provider model fields
- `bin/unified-mcp-server.mjs` — present, imports cleanly (verified with node -e import())
- `commands/qgsd/mcp-status.md` — present with 19 matches on key new terms

### Verification results
- providers.json: all 6 subprocess providers have model, health_check_args, display_provider; codex-1/2 have model_detect
- unified-mcp-server.mjs: imports cleanly, no syntax errors
- mcp-status.md: 19 matches on claudeModel|health_check_args|orchestrator|display_provider

## Self-Check: PASSED

## Next Phase Readiness

- mcp-status command will now show 11 rows (1 orchestrator + 4 CLI + 6 HTTP) when run
- CLI agents show real model names and live latency
- No follow-up work needed

---
*Phase: quick-82*
*Completed: 2026-02-23*
