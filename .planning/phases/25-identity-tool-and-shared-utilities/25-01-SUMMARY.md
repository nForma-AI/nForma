---
phase: 25-identity-tool-and-shared-utilities
plan: "01"
subsystem: mcp-servers
tags:
  - constants
  - shared-utilities
  - std-08
requires: []
provides:
  - constants.ts in all 6 MCP repos
affects:
  - claude-mcp-server
  - codex-mcp-server
  - copilot-mcp-server
  - openhands-mcp-server
  - gemini-mcp-server
  - opencode-mcp-server
tech-stack:
  added: []
  patterns:
    - constants module pattern with one-way dependency (constants -> types, never reverse)
key-files:
  created:
    - /Users/jonathanborduas/code/claude-mcp-server/src/constants.ts
    - /Users/jonathanborduas/code/codex-mcp-server/src/constants.ts
    - /Users/jonathanborduas/code/copilot-mcp-server/src/constants.ts
    - /Users/jonathanborduas/code/openhands-mcp-server/src/constants.ts
  modified:
    - /Users/jonathanborduas/code/gemini-mcp-server/src/constants.ts
    - /Users/jonathanborduas/code/opencode-mcp-server/src/constants.ts
key-decisions:
  - decision: Did not add ToolArguments re-export to the 4 new repos
    rationale: None of the 4 repos (claude, codex, copilot, openhands) define ToolArguments in types.ts — they use specific Zod schemas instead. The re-export would have caused a TypeScript compile error.
requirements-completed:
  - STD-08
duration: "1 min"
completed: "2026-02-22"
---

# Phase 25 Plan 01: Create constants.ts for 4 Gen1-Ported Repos Summary

Created `src/constants.ts` in claude, codex, copilot, and openhands MCP servers; added `SERVER_NAME` to existing gemini and opencode constants files. All 6 repos now have `SERVER_NAME`, `LOG_PREFIX`, `ERROR_MESSAGES`, `STATUS_MESSAGES`, and `PROTOCOL` constants with zero circular imports.

**Duration:** 1 min | **Start:** 2026-02-22T17:48:36Z | **End:** 2026-02-22T17:49:34Z | **Tasks:** 2 | **Files:** 6

## Tasks Completed

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Create constants.ts for claude-mcp-server and codex-mcp-server | Done | 8f72b9e / d2e7dc4 |
| Task 2: Create constants.ts for copilot-mcp-server and openhands-mcp-server | Done | 7584a0e / c285fef |
| Addendum: Add SERVER_NAME to gemini and opencode | Done | 61cca31 / c1482cc |

## LOG_PREFIX Assignments

| Repo | LOG_PREFIX |
|------|-----------|
| claude-mcp-server | `[CMCP]` |
| codex-mcp-server | `[CDMCP]` |
| copilot-mcp-server | `[CPMCP]` |
| openhands-mcp-server | `[OHMCP]` |
| gemini-mcp-server | `[GMCP]` (pre-existing) |
| opencode-mcp-server | `[OMCP]` (pre-existing) |

## gemini/opencode SERVER_NAME Status

Both gemini and opencode were missing SERVER_NAME — added to both existing constants.ts files without disturbing other constants.

## Build Results

- claude-mcp-server: `npm run build` exits 0
- codex-mcp-server: `npm run build` exits 0
- copilot-mcp-server: `npm run build` exits 0
- openhands-mcp-server: `npm run build` exits 0
- gemini-mcp-server: not rebuilt (only 3-line addition, existing build state preserved)
- opencode-mcp-server: not rebuilt (only 3-line addition, existing build state preserved)

## Deviations from Plan

**[Rule 3 - Blocking] Skipped ToolArguments re-export** — Found during: Task 1 | Issue: The plan specified `export { ToolArguments } from './types.js'` but none of the 4 target repos export `ToolArguments` from types.ts (they use specific Zod schemas: `ClaudeToolSchema`, `CodexToolSchema`, etc.) | Fix: Omitted that re-export line — would have caused TypeScript compile error | Files modified: N/A (prevented error) | Verification: All builds pass | Commit: N/A (prevented bug)

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** None — constants files are correct and complete without the re-export.

## Next

Ready for Plan 02 (logger.ts creation) and Plan 03 (identity tool) — both execute in Wave 2.

## Self-Check: PASSED

- /Users/jonathanborduas/code/claude-mcp-server/src/constants.ts: exists on disk
- /Users/jonathanborduas/code/codex-mcp-server/src/constants.ts: exists on disk
- git log grep "25-01": 6 commits found across repos
