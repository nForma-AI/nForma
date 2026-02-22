---
phase: 25-identity-tool-and-shared-utilities
plan: "03"
subsystem: mcp-servers
tags:
  - identity-tool
  - std-04
  - mcp-status-prerequisite
requires:
  - 25-01 (constants.ts with SERVER_NAME)
provides:
  - identity tool in all 6 MCP repos with correct 5-field schema
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
    - identity tool pattern returning {name, version, model, available_models, install_method}
    - loadPackageVersion() + detectInstallMethod() helper pattern
key-files:
  created: []
  modified:
    - /Users/jonathanborduas/code/claude-mcp-server/src/types.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts
    - /Users/jonathanborduas/code/claude-mcp-server/src/tools/index.ts
    - /Users/jonathanborduas/code/codex-mcp-server/src/tools/simple-tools.ts
    - /Users/jonathanborduas/code/copilot-mcp-server/src/types.ts
    - /Users/jonathanborduas/code/copilot-mcp-server/src/tools/simple-tools.ts
    - /Users/jonathanborduas/code/openhands-mcp-server/src/types.ts
    - /Users/jonathanborduas/code/openhands-mcp-server/src/tools/simple-tools.ts
    - /Users/jonathanborduas/code/openhands-mcp-server/src/tools/index.ts
    - /Users/jonathanborduas/code/gemini-mcp-server/src/tools/simple-tools.ts
    - /Users/jonathanborduas/code/gemini-mcp-server/src/tools/index.ts
    - /Users/jonathanborduas/code/opencode-mcp-server/src/tools/simple-tools.ts
key-decisions:
  - decision: gemini identityTool was defined but not registered — registered it now
    rationale: The pre-existing gemini simple-tools.ts had an identityTool export but index.ts did not import or push it. Test count went from 9 to 10. The tool was functionless without registration.
  - decision: AVAILABLE_OPENCODE_MODELS defined inline in simple-tools.ts (not types.ts)
    rationale: opencode types.ts uses a different interface pattern (no MODELS/TOOLS consts) — defining the array inline avoids importing a constant that doesn't fit the pattern.
  - decision: openhands model set to 'not-configured', available_models to []
    rationale: openhands-mcp-server is a stub framework with no real LLM configured. Returning truthful stub values is better than fabricating model names.
requirements-completed:
  - STD-04
duration: "5 min"
completed: "2026-02-22"
---

# Phase 25 Plan 03: Identity Tool in All 6 Repos Summary

Added or updated the identity tool in all 6 MCP repos to return the exact 5-field schema: `{name, version, model, available_models, install_method}`. Two repos (claude, openhands) had identity created from scratch with TOOLS.IDENTITY added to types.ts; four repos (codex, copilot, gemini, opencode) had identity updated from wrong field names and hardcoded versions. All 6 repos build and test cleanly.

**Duration:** 5 min | **Start:** 2026-02-22T17:52:44Z | **End:** 2026-02-22T17:58:32Z | **Tasks:** 2 | **Files:** 13 modified

## Tasks Completed

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Add identity tool to claude-mcp-server and openhands-mcp-server | Done | 8e1905f / 8438692 |
| Task 2: Update identity tool schema in codex, copilot, gemini, opencode | Done | 131a376 / e36d7b5 / 234e542 / 2b17e35 |

## Per-Repo Identity Tool Status

| Repo | Status | Changes |
|------|--------|---------|
| claude-mcp-server | Created | TOOLS.IDENTITY in types.ts, identityTool in simple-tools.ts, registered in index.ts |
| openhands-mcp-server | Created | TOOLS.IDENTITY in types.ts, identityTool (stub), registered in index.ts |
| codex-mcp-server | Updated | Wrong fields replaced, detectInstallMethod() added, AVAILABLE_CODEX_MODELS imported |
| copilot-mcp-server | Updated | Wrong fields replaced, AVAILABLE_COPILOT_MODELS added to types.ts |
| gemini-mcp-server | Updated + Registered | Wrong fields replaced, loadPackageVersion()/detectInstallMethod() added, registered in index.ts |
| opencode-mcp-server | Updated | Wrong fields replaced, loadPackageVersion()/detectInstallMethod()/AVAILABLE_OPENCODE_MODELS added |

## available_models Per Repo

| Repo | available_models |
|------|-----------------|
| claude-mcp-server | AVAILABLE_CLAUDE_MODELS (3 models) |
| codex-mcp-server | AVAILABLE_CODEX_MODELS (9 models) |
| copilot-mcp-server | AVAILABLE_COPILOT_MODELS: gpt-4.1, gpt-4o, claude-3.5-sonnet, o3-mini |
| openhands-mcp-server | [] (stub server) |
| gemini-mcp-server | [MODELS.PRO, MODELS.FLASH, MODELS.FLASH_LITE] |
| opencode-mcp-server | AVAILABLE_OPENCODE_MODELS: opencode-managed, anthropic/claude-sonnet-4-5, openai/gpt-4o |

## Model Env Var Per Repo

| Repo | Env Var | Default |
|------|---------|---------|
| claude-mcp-server | CLAUDE_DEFAULT_MODEL | claude-sonnet-4-6 |
| codex-mcp-server | CODEX_DEFAULT_MODEL | gpt-5.3-codex |
| copilot-mcp-server | COPILOT_DEFAULT_MODEL | gpt-4.1 |
| openhands-mcp-server | N/A | not-configured |
| gemini-mcp-server | GEMINI_DEFAULT_MODEL | gemini-3-pro-preview |
| opencode-mcp-server | OPENCODE_DEFAULT_MODEL | opencode-managed |

## Test Results

| Repo | Tests |
|------|-------|
| claude-mcp-server | 62 passed |
| codex-mcp-server | 77 passed |
| copilot-mcp-server | 58 passed |
| openhands-mcp-server | 13 passed |
| gemini-mcp-server | 44 passed |
| opencode-mcp-server | 63 passed |

## Deviations from Plan

**[Rule 1 - Bug] Test count assertions updated in 4 repos** — Found during: Task 1 and Task 2 | Issue: Hardcoded `toHaveLength()` assertions in test suites for tool registry counts | Fix: Updated counts to reflect new identity tool registration: claude 5→6, openhands 3→4, gemini 9→10, opencode 4→5 | Commits: included in feature commits

**[Rule 2 - Missing Critical] gemini identityTool was unregistered** — Found during: Task 2 | Issue: gemini simple-tools.ts had an identityTool export but index.ts did not import or push it | Fix: Added `identityTool` to index.ts import and toolRegistry.push() | Impact: Tool was previously uncallable from MCP clients

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical). **Impact:** Test suite maintained, gemini identity now callable.

## Smoke Test (codex)

```
name: codex-mcp-server
version: 1.4.0
model: gpt-5.3-codex
available_models: [9 models]
install_method: unknown
```
All 5 fields non-null. Schema correct.

## Next

Phase 25 complete — all 3 plans executed. Ready for verify-phase.

## Self-Check: PASSED

- /Users/jonathanborduas/code/claude-mcp-server/src/tools/simple-tools.ts: exists with identityTool
- /Users/jonathanborduas/code/codex-mcp-server/src/tools/simple-tools.ts: exists with identityTool updated
- git log grep "25-03": 6 commits found across repos
