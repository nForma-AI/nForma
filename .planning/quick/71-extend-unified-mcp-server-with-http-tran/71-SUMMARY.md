---
phase: quick-71
plan: 01
subsystem: unified-mcp-server, quorum-orchestrator
tags: [mcp, http-transport, providers, quorum, roster]
dependency_graph:
  requires: [quick-70]
  provides: [unified-mcp-server-http, providers-roster, quorum-unified-tool-names]
  affects: [qgsd-quorum-orchestrator, agents]
tech_stack:
  added: []
  patterns: [node-https-builtin, openai-chat-completions-api, json-roster-config]
key_files:
  created: []
  modified:
    - bin/providers.json
    - bin/unified-mcp-server.mjs
    - agents/qgsd-quorum-orchestrator.md
decisions:
  - "providers.json as single source of truth for all 12 providers (6 CLI + 6 HTTP)"
  - "HTTP transport uses Node.js built-in https/http modules — zero new npm dependencies"
  - "HTTP provider availability checked at call time via timeout guard, not pre-flight health_check"
  - "All quorum tool calls unified under mcp__unified-1__<slotName> — single MCP server entry point"
  - "Scoreboard: CLI slots use --model <family>, HTTP slots use --slot + --model-id"
metrics:
  duration: "8 min"
  completed: "2026-02-23"
  tasks: 3
  files: 3
---

# Phase quick-71 Plan 01: Extend unified-mcp-server with HTTP transport and roster support Summary

HTTP transport and 12-provider roster added to unified-mcp-server, consolidating all quorum
providers (6 subprocess CLI + 6 HTTP) into a single MCP server and updating the quorum
orchestrator to call `mcp__unified-1__<slotName>` for all providers.

## What Was Built

### Task 1: providers.json roster expansion
- Renamed 4 anonymous CLI entries (codex, gemini, opencode, copilot) to indexed slot names
- Added codex-2 and gemini-2 for 2-slot CLI roster depth
- Added explicit `"type": "subprocess"` to all CLI entries for field consistency
- Added 6 HTTP providers: deepseek-1 (AkashML), minimax-1 (AkashML), qwen-1 (Together.xyz),
  kimi-1 (Fireworks), llama4-1 (Together.xyz), glm-1 (Fireworks)
- Commit: `70764c4`

### Task 2: unified-mcp-server.mjs HTTP transport
- Added `import https from 'https'; import http from 'http';` (Node.js built-ins)
- Added `runHttpProvider()` function: POST to `/chat/completions`, Bearer auth via env var,
  timeout guard with `req.destroy()`, JSON parse with error wrapping
- Updated `tools/call` dispatch: `provider.type === 'http'` branches to `runHttpProvider`,
  otherwise falls through to existing `runProvider` (subprocess path unchanged)
- `tools/list` now returns all 12 tools (server verified via stdin JSON-RPC)
- Commit: `6eb7939`

### Task 3: quorum orchestrator unified tool names + install sync
- Step 2 identity capture: replaced `mcp__codex-cli-1__identity` etc. with
  `mcp__unified-1__codex-1` (prompt "identity") for all 4 CLI slots
- Removed claude-mcp-server health_check pre-flight loop; HTTP providers now participate
  with availability checked at call time via the existing timeout guard
- Mode A query models: full unified-1 call order (6 CLI slots + 6 HTTP slots)
- Mode B dispatch workers: all 12 Task calls updated to `mcp__unified-1__<slotName>`
- Scoreboard sections (Consensus + Escalate): updated to CLI `--model <family>` vs
  HTTP `--slot <slotName> --model-id <fullModelId>` pattern
- Install sync ran; `~/.claude/agents/qgsd-quorum-orchestrator.md` updated
- ~/.claude.json claude-1 through claude-6 entries preserved (fallback untouched)
- Commit: `f1c05ac`

## Verification Results

```
providers.json: 12 total (CLI: codex-1,2, gemini-1,2, opencode-1, copilot-1 | HTTP: deepseek-1, minimax-1, qwen-1, kimi-1, llama4-1, glm-1)
tools/list response: 12 tools
mcp__unified-1__ occurrences in orchestrator: 31
Old per-agent tool names remaining: 0
claude-1 through claude-6 in ~/.claude.json: preserved
Install sync: succeeded (only diff is ~ → absolute path expansion by installer)
```

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `bin/providers.json` — 12 providers, verified with `node -e`
- [x] `bin/unified-mcp-server.mjs` — `runHttpProvider` present, tools/list returns 12
- [x] `agents/qgsd-quorum-orchestrator.md` — 31 `mcp__unified-1__` occurrences, 0 old names
- [x] `~/.claude/agents/qgsd-quorum-orchestrator.md` — updated by install sync
- [x] Commits: `70764c4`, `6eb7939`, `f1c05ac` — all verified in git log

## Self-Check: PASSED
