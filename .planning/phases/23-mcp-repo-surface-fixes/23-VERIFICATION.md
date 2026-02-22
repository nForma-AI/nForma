---
phase: 23-mcp-repo-surface-fixes
status: passed
verified: 2026-02-22
verifier: claude-sonnet-4-6
---

# Phase 23 Verification: MCP Repo Surface Fixes

## Goal

All 6 MCP server repos have correct identity metadata, licenses, package.json configuration, Makefile, CHANGELOG/CLAUDE.md, and consistent npm scoping — the openhands rename is corrected and every repo reads its version dynamically.

## Must-Haves Verification

### SC1: openhands identity — PASSED

`grep -rn "codex-mcp-server|CodexMcpServer" openhands/src/` → ZERO results.

Verified in:
- `src/server.ts`: `export class OpenHandsMcpServer` (was CodexMcpServer)
- `src/index.ts`: imports OpenHandsMcpServer, server name 'openhands-mcp-server', dynamic version
- `src/__tests__/index.test.ts`: all 3 CodexMcpServer refs renamed to OpenHandsMcpServer
- `package.json`: name, bin key, description, repo/bugs/homepage all say openhands-mcp-server
- `package-lock.json`: root name is openhands-mcp-server

### SC2: Dynamic version in all Gen1 repos — PASSED

`grep -rn "'0.0.6'" claude/codex/copilot/openhands src/` → ZERO results.

All 4 Gen1 repos have `createRequire + pkg.version` pattern in `src/index.ts`. Also fixed in `src/tools/handlers.ts` for codex and copilot (IdentityToolHandler had hardcoded version).

### SC3: OSI MIT LICENSE in all 6 repos — PASSED

All 6 repos: `grep -c "Permission is hereby granted" LICENSE` → 1. No "Non-Commercial" text in any file.

### SC4: npm metadata in all 6 repos — PASSED

All 6 repos: `engines: {node: ">=18.0.0"}`, `publishConfig: {access: "public"}`, `scripts.prepublishOnly: "npm run build"` — verified via python3 JSON parse → `True True True` for all 6.

### SC5: Makefiles, CHANGELOG.md, CLAUDE.md, unscoped npm — PASSED

- All 6 repos: Makefile has `.PHONY: lint format test build clean dev` (6 targets)
- All 6 repos: CHANGELOG.md present (4 created, 2 pre-existing)
- All 6 repos: CLAUDE.md present (3 created, 3 pre-existing)
- All 6 repos: unscoped npm name (no @tuannvm/ prefix) — gemini unscoped from @tuannvm/gemini-mcp-server

## Requirements Traceability

| Requirement | Status | Evidence |
|-------------|--------|---------|
| STD-01 | CLOSED | Zero CodexMcpServer refs in openhands src/ |
| STD-03 | CLOSED | Zero hardcoded '0.0.6' in all Gen1 src/ |
| STD-05 | CLOSED | All 6 repos have standard OSI MIT LICENSE |
| STD-06 | CLOSED | All 6 repos have engines/publishConfig/prepublishOnly |
| STD-07 | CLOSED | All 4 Gen1 repos have 6-target Makefile |
| STD-09 | CLOSED | All 6 repos have CHANGELOG.md + CLAUDE.md |
| STD-10 | CLOSED | All 6 repos uniformly unscoped |

## Tests

- `npm test` in openhands-mcp-server: 13 tests PASSED
- `npm run build` in claude/codex/copilot-mcp-server: all exit 0
- `make lint` in claude-mcp-server: exits 0

## Verdict: PASSED
