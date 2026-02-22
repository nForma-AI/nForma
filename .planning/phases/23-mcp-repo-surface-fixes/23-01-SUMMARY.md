---
plan: 23-01
phase: 23-mcp-repo-surface-fixes
status: complete
completed: 2026-02-22
requirements_closed:
  - STD-01
  - STD-03
---

# Plan 23-01 Summary: openhands identity rename + Gen1 dynamic version

## What Was Built

Closed STD-01 (openhands identity) and STD-03 (dynamic version across all 4 Gen1 repos).

## Key Changes

### STD-01: openhands-mcp-server identity rename
- `src/server.ts`: `export class CodexMcpServer` → `export class OpenHandsMcpServer`
- `src/index.ts`: Full replacement — imports `OpenHandsMcpServer`, server name `openhands-mcp-server`, dynamic version via `createRequire + pkg.version`
- `src/__tests__/index.test.ts`: All 3 `CodexMcpServer` references replaced with `OpenHandsMcpServer`
- `package.json`: name, bin key, description, repository/bugs/homepage URLs all say `openhands-mcp-server`; added `engines` (node>=18), `publishConfig` (access: public), `prepublishOnly` script; license MIT, author tuannvm
- `package-lock.json`: Regenerated via `npm install`

### STD-03: Dynamic version in all 4 Gen1 repos
- `claude-mcp-server/src/index.ts`: added `createRequire + pkg.version`
- `codex-mcp-server/src/index.ts`: added `createRequire + pkg.version`
- `codex-mcp-server/src/tools/handlers.ts`: IdentityToolHandler now uses `pkg.version`
- `copilot-mcp-server/src/index.ts`: added `createRequire + pkg.version`
- `copilot-mcp-server/src/tools/handlers.ts`: IdentityToolHandler now uses `pkg.version`

## Self-Check

### Verification Results
1. `grep -rn "CodexMcpServer" openhands/src/` → ZERO results
2. `grep '"name"' openhands/package.json` → `"openhands-mcp-server"`
3. `grep -rn "'0.0.6'" all-4-gen1/src/` → ZERO results
4. `npm test` in openhands: 13 tests passed
5. `npm run build` in claude/codex/copilot: all exit 0

### Status: PASSED

## Key Files Created/Modified
- `/Users/jonathanborduas/code/openhands-mcp-server/src/server.ts` (renamed class)
- `/Users/jonathanborduas/code/openhands-mcp-server/src/index.ts` (full replacement)
- `/Users/jonathanborduas/code/openhands-mcp-server/src/__tests__/index.test.ts` (3 refs renamed)
- `/Users/jonathanborduas/code/openhands-mcp-server/package.json` (identity + metadata)
- `/Users/jonathanborduas/code/claude-mcp-server/src/index.ts` (dynamic version)
- `/Users/jonathanborduas/code/codex-mcp-server/src/index.ts` (dynamic version)
- `/Users/jonathanborduas/code/codex-mcp-server/src/tools/handlers.ts` (dynamic version)
- `/Users/jonathanborduas/code/copilot-mcp-server/src/index.ts` (dynamic version)
- `/Users/jonathanborduas/code/copilot-mcp-server/src/tools/handlers.ts` (dynamic version)

## Deviations
- Also updated `handlers.ts` in codex and copilot IdentityToolHandler which had hardcoded `'0.0.6'` — these were caught by the plan's verification check which scans all of `src/`, not just `index.ts`. Fixed proactively.
