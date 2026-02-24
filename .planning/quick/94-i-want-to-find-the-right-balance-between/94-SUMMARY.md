---
phase: quick-94
plan: "01"
subsystem: security
tags: [keytar, api-keys, mcp-server, manage-agents, secrets]
dependency_graph:
  requires: [bin/secrets.cjs]
  provides: [keytar-based API key storage for MCP slots]
  affects: [bin/unified-mcp-server.mjs, bin/manage-agents.cjs]
tech_stack:
  added: []
  patterns: [keytar-bootstrap-at-startup, keytar-only-storage, graceful-degradation]
key_files:
  created: []
  modified:
    - bin/unified-mcp-server.mjs
    - bin/manage-agents.cjs
decisions:
  - "Keys stored in keytar only when keytar available; fallback to env block for systems without keytar (graceful degradation)"
  - "unified-mcp-server loads API key once at startup via async main(), caching in process.env for process lifetime — no repeated OS prompts"
  - "displayKey pattern: prefer keytar value, fallback to env.ANTHROPIC_API_KEY for legacy compatibility"
  - "delete newEnv.ANTHROPIC_API_KEY on key set/remove ensures no plaintext lingers when keytar is available"
metrics:
  duration: "5m"
  completed: "2026-02-24"
  tasks: 2
  files: 2
---

# Phase quick-94 Plan 01: Keytar-Only API Key Storage Summary

API keys moved from plaintext ~/.claude.json env blocks to OS keychain (keytar), with one keychain unlock per MCP server process lifetime and graceful fallback for systems without keytar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Make unified-mcp-server read API key from keytar at startup | 4f91391 | bin/unified-mcp-server.mjs |
| 2 | Strip plaintext keys from manage-agents — keytar-only storage | dc5ba85 | bin/manage-agents.cjs |

## What Was Built

### Task 1: unified-mcp-server keytar bootstrap

Added an `async function main()` wrapper around the existing stdin readline setup. Inside `main()`, before the readline starts:

- When `PROVIDER_SLOT` is set and `ANTHROPIC_API_KEY` is not already in `process.env`, the server attempts to load the key from keytar using account name `ANTHROPIC_API_KEY_<SLOT_UPPER>` (e.g., `ANTHROPIC_API_KEY_CLAUDE_1`)
- On success: sets `process.env.ANTHROPIC_API_KEY` and logs confirmation to stderr
- On failure (keytar unavailable, no entry): logs a warning to stderr and continues — server is not crashed
- Fallback chain: env var already set → keytar → continue without key

The readline handler and startup log are now inside `main()` to ensure they run after the async keytar bootstrap completes.

### Task 2: manage-agents keytar-only storage

Three targeted change areas:

**addAgent():**
- Added `secretsLib` loading at top of function
- Key entry: saves to keytar only (`secretsLib.set()`), not to `env.ANTHROPIC_API_KEY`
- Graceful degradation: if secretsLib unavailable, writes to env block (legacy path preserved)

**editAgent():**
- Added `keytarAccount` and `keytarKey` derivation right after building `const env`
- `displayKey = keytarKey || env.ANTHROPIC_API_KEY || null` used throughout for display and checks
- Summary card "Key" row uses `maskKey(displayKey)` — works for both keytar and legacy keys
- Field chooser shows keytar key status with `maskKey(displayKey)`
- `hasKey` uses `displayKey || secretsLib.hasKey(keytarAccount)` — no keychain prompt
- API key action prompt message uses `maskKey(displayKey)`
- Pre-flight probe uses `keytarKey || env.ANTHROPIC_API_KEY || updates.apiKey`
- Apply block: `delete newEnv.ANTHROPIC_API_KEY` on both set and remove; stores in keytar; fallback to env if keytar unavailable

**checkAgentHealth():**
- Loads `secretsLib` at top
- `hasKey` in agent selector uses `secretsLib.hasKey(account)` (index-only, no OS prompt)
- Health probe reads API key from keytar first (`secretsLib.get()`), falls back to env

## Verification Results

1. `node bin/unified-mcp-server.mjs` (via stdin) — starts correctly: `[unified-mcp-server] started [all-providers]`
2. `PROVIDER_SLOT=claude-1 node bin/unified-mcp-server.mjs` — logs `Loaded API key for slot claude-1 from keychain`, starts cleanly
3. `node -e "require('./bin/manage-agents.cjs')"` — no syntax errors
4. `secrets.cjs get('qgsd','ANTHROPIC_API_KEY_CLAUDE_1')` returns true (key in keytar)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one minor addition:

**Extra: checkAgentHealth() probe uses keytar key**

The plan mentioned updating `checkAgentHealth()` display only. I also updated the actual HTTP probe call in that function to use the keytar key (falling back to env). This ensures the health probe sends the correct auth header when the key is stored only in keytar, which is required for the probe to succeed.

## Self-Check: PASSED

Files modified exist:
- bin/unified-mcp-server.mjs: FOUND
- bin/manage-agents.cjs: FOUND

Commits exist:
- 4f91391: FOUND (feat: load API key from keytar at unified-mcp-server startup)
- dc5ba85: FOUND (feat: store API keys in keytar only, strip from ~/.claude.json env blocks)
