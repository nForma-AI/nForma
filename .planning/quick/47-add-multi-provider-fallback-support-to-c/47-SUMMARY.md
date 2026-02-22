---
phase: quick-47
plan: 01
subsystem: claude-mcp-server
tags: [fallback, multi-provider, resilience, mcp-tool]
dependency_graph:
  requires: []
  provides: [fallbackProviders parameter, ProviderSchema, attemptCall helper]
  affects: [ClaudeToolHandler.execute, ClaudeToolSchema, claude tool inputSchema]
tech_stack:
  added: []
  patterns: [sequential retry loop, provider override patching]
key_files:
  created: []
  modified:
    - /Users/jonathanborduas/code/claude-mcp-server/src/types.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
    - /Users/jonathanborduas/code/claude-mcp-server/README.md
decisions:
  - Fallback attempts always use non-streaming executeCommand path to avoid partial-progress confusion on retried calls
  - usedFallbackIndex is 0-indexed into fallbackProviders array (primary = undefined)
  - JSON.parse failure on non-empty stdout triggers retry just like a thrown error
metrics:
  duration: 2min
  completed: 2026-02-22
  tasks_completed: 3
  files_modified: 4
---

# Phase quick-47 Plan 01: Add Multi-Provider Fallback Support Summary

**One-liner:** Sequential provider fallback retry with ProviderSchema + attemptCall helper; primary-only path unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ProviderSchema and fallbackProviders to types.ts | 934ee35 | src/types.ts |
| 2 | Implement attemptCall helper and fallback retry loop in handlers.ts | a6ded2b | src/tools/handlers.ts |
| 3 | Update definitions.ts and README.md | 5d30af5 | src/tools/definitions.ts, README.md |

## What Was Built

Added a `fallbackProviders` parameter to the `claude` MCP tool enabling automatic sequential retry through alternate providers when the primary call fails.

**Key components:**

- `ProviderSchema` (types.ts): Zod schema with optional `routerBaseUrl` and `model` fields; exported as `ProviderEntry` type
- `ClaudeToolSchema.fallbackProviders` (types.ts): `z.array(ProviderSchema).max(5).optional()`
- `attemptCall()` private method (handlers.ts): executes `executeCommand` + JSON.parse, throws on either failure so the caller's retry loop can catch and continue
- Retry loop in `ClaudeToolHandler.execute()` (handlers.ts): builds `attempts` array (primary + fallbacks), patches `--model` arg per attempt, uses streaming only for primary, catches errors and continues until success or exhaustion
- `usedFallbackIndex` in response metadata when a fallback was used
- `ToolExecutionError` listing all attempt errors when all attempts fail
- `fallbackProviders` JSON schema property in definitions.ts (MCP tool discovery)
- Parameter table row + usage example in README.md

## Success Criteria Verification

- ProviderSchema exported from types.ts with routerBaseUrl and model optional fields: YES
- ClaudeToolSchema includes fallbackProviders: z.array(ProviderSchema).max(5).optional(): YES
- ClaudeToolHandler.execute() retries sequentially on thrown error or JSON.parse failure: YES
- Primary-only calls (no fallbackProviders) have identical behaviour: YES (fallbacks array empty, loop runs once)
- On fallback success: usedFallbackIndex appears in response metadata: YES
- On all-fail: ToolExecutionError message lists all attempt error strings: YES
- definitions.ts and README.md document the new parameter: YES
- tsc --noEmit exits 0: YES
- npm run build: YES

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: /Users/jonathanborduas/code/claude-mcp-server/src/types.ts (contains ProviderSchema, fallbackProviders)
- FOUND: /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts (contains attemptCall, fallbackProviders)
- FOUND: /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts (contains fallbackProviders)
- FOUND: /Users/jonathanborduas/code/claude-mcp-server/README.md (contains fallbackProviders row + example)

Commits verified:
- 934ee35 feat(quick-47): task 1
- a6ded2b feat(quick-47): task 2
- 5d30af5 feat(quick-47): task 3
