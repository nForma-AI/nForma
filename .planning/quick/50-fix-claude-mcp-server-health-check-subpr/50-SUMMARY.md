---
phase: quick-50
plan: "01"
subsystem: claude-mcp-server
tags: [health-check, subprocess, env, mcp, quick-fix]
dependency_graph:
  requires: []
  provides: [health_check-env-passthrough]
  affects: [bin/check-mcp-health.cjs, quorum-pre-flight]
tech_stack:
  added: []
  patterns: [explicit-env-override, subprocess-env-passthrough]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts
decisions:
  - "Pass ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY explicitly via healthEnv object rather than relying on process.env inheritance — guarantees correct provider URL even if MCP stdio transport filters env vars"
  - "Use Record<string, string | undefined> type for healthEnv — matches executeCommand signature ProcessEnv type"
metrics:
  duration: "5min"
  completed: "2026-02-22"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-50: Fix claude-mcp-server health_check subprocess env passthrough — Summary

**One-liner:** Explicit ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY env injection into health_check subprocess via healthEnv object, preventing api.anthropic.com fallback when MCP stdio runtime strips process.env.

## What Was Built

The `health_check` tool in `claude-mcp-server/src/tools/simple-tools.ts` was calling `executeCommand()` with `undefined` as the env override, relying entirely on `process.env` inheritance. Claude Code's MCP stdio transport may not guarantee that custom env vars (set in `~/.claude.json` `mcpServers` env blocks) are present in the spawned process's `process.env` at call time. This caused `health_check` to time out at 10s because the subprocess attempted to reach `api.anthropic.com` rather than the configured provider URL.

The fix passes a `healthEnv` object containing `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` as an explicit `envOverride` arg. `executeCommand()` already merges this via `{ ...process.env, ...envOverride }`, so all other env vars are preserved — the explicit keys simply win over any filtered-out values.

The test assertion for tool count was stale at 6 (healthCheckTool was added to the registry but the test was never updated). Updated to 7 and added `expect(toolNames).toContain(TOOLS.HEALTH_CHECK)`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pass explicit env override in health_check subprocess spawn | 6672106 | src/tools/simple-tools.ts |
| 2 | Update stale tool count assertion 6->7 and add HEALTH_CHECK check | 65b540d | src/__tests__/index.test.ts |

## Verification Results

1. `grep -n "ANTHROPIC_BASE_URL" simple-tools.ts` — hit at lines 161 and 166 inside `healthCheckTool.execute()`
2. `grep "toHaveLength(7)" index.test.ts` — match confirmed
3. `grep "HEALTH_CHECK" index.test.ts` — match confirmed
4. `npm run build` — exits 0, zero TypeScript errors
5. `npm test` — 62 tests passed, 9 suites PASS

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Explicit env injection over process.env reliance**: Rather than relying on MCP runtime env inheritance, the fix creates a dedicated `healthEnv` object with the two critical vars. This is the minimal, targeted change that guarantees correct behavior regardless of runtime env filtering.

2. **Record<string, string | undefined> type**: Matches the `ProcessEnv` type expected by `executeCommand()` — both keys are typed as `string | undefined` since they may not be set.

## Self-Check: PASSED

- `/Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts` — FOUND (healthEnv + ANTHROPIC_BASE_URL present)
- `/Users/jonathanborduas/code/claude-mcp-server/src/__tests__/index.test.ts` — FOUND (toHaveLength(7) + HEALTH_CHECK present)
- Task 1 commit 6672106 — FOUND
- Task 2 commit 65b540d — FOUND
- All 62 tests PASS
