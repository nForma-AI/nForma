---
phase: quick-51
plan: 01
subsystem: secrets
tags: [keytar, secrets, mcp, session-start, install]
dependency_graph:
  requires: []
  provides: [keytar-secret-management, session-start-sync]
  affects: [bin/install.js, hooks/qgsd-session-start.js, bin/secrets.cjs, bin/set-secret.cjs]
tech_stack:
  added: [keytar ^7.9.0]
  patterns: [lazy-require native addon, SessionStart hook, JSON patch-write]
key_files:
  created:
    - bin/secrets.cjs
    - bin/set-secret.cjs
    - hooks/qgsd-session-start.js
    - hooks/dist/qgsd-session-start.js
  modified:
    - package.json
    - bin/install.js
decisions:
  - keytar lazy-loaded with graceful fallback so module loads without native addon installed
  - syncToClaudeJson only patches env keys already present in mcpServers — never adds new keys
  - SessionStart hook silently exits 0 on any error — never blocks session start
  - hooks/dist gitignored but force-added to track alongside other dist hooks
metrics:
  duration: 8min
  completed: 2026-02-22
  tasks_completed: 2
  files_changed: 6
---

# Phase Quick-51 Plan 01: Keytar-Based Cross-Platform Secret Management Summary

**One-liner:** OS keychain secret storage via keytar with automatic session-start sync into ~/.claude.json mcpServers env blocks.

## What Was Built

QGSD can now store MCP API keys in the OS keychain (macOS Keychain, GNOME Keyring, Windows Credential Manager) instead of plaintext in `~/.claude.json`. A SessionStart hook syncs keychain secrets into `~/.claude.json` mcpServers env blocks on every Claude Code session start.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create bin/secrets.cjs keytar wrapper and bin/set-secret.cjs CLI | 67e3c5e | bin/secrets.cjs, bin/set-secret.cjs, package.json |
| 2 | Create hooks/qgsd-session-start.js and wire into install.js | b851dc7 | hooks/qgsd-session-start.js, hooks/dist/qgsd-session-start.js, bin/install.js |

## Key Artifacts

**bin/secrets.cjs** — CJS library module (no shebang, require'd by other files):
- `set(service, key, value)` — stores secret in OS keychain
- `get(service, key)` — retrieves secret from keychain
- `delete(service, key)` — removes secret from keychain
- `list(service)` — returns `[{account, password}]` array for all secrets under service
- `syncToClaudeJson(service)` — reads all keychain credentials, patches matching env keys in `~/.claude.json` mcpServers entries
- `SERVICE = 'qgsd'` — constant service name for keychain namespace
- Graceful fallback: lazy-loads keytar via `getKeytar()`, throws clear error message if native addon absent

**bin/set-secret.cjs** — CLI entry point:
- Usage: `node bin/set-secret.cjs <KEY_NAME> <value>`
- Validates args (exits 1 on missing KEY_NAME or value)
- Stores to keychain then syncs to `~/.claude.json`

**hooks/qgsd-session-start.js** + **hooks/dist/qgsd-session-start.js** — SessionStart hook (identical content):
- `findSecrets()` checks `~/.claude/qgsd-bin/secrets.cjs` (installed path) first, then local dev path
- Calls `syncToClaudeJson(SERVICE)` on every session start
- All errors are non-fatal: writes to stderr, never blocks session start
- Missing keytar: logs to stderr, exits 0 cleanly

**bin/install.js** changes:
- Registration: adds `qgsd-session-start.js` as a SessionStart hook entry (after the update-check hook)
- Uninstall: extends SessionStart filter predicate to also remove `qgsd-session-start` entries

## Decisions Made

1. **Lazy keytar loading**: `getKeytar()` wraps `require('keytar')` in try/catch so `bin/secrets.cjs` can be required without the native addon installed. The error message includes the install command and the original error.

2. **Patch-only sync**: `syncToClaudeJson` only overwrites env keys that already exist in `mcpServers[*].env` — it never adds new keys. This preserves the structure of `~/.claude.json` and avoids unexpected mutations.

3. **Silent SessionStart hook**: All errors in the hook (keytar absent, sync failure) are logged to stderr and swallowed — the hook always exits 0. This ensures keychain issues never block Claude Code session startup.

4. **hooks/dist force-add**: The `hooks/dist/` directory is gitignored (build artifacts per project convention) but individual files are tracked via `git add -f` — consistent with all other hooks/dist files in the repository.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

1. Module loads cleanly: `node -e "const s = require('./bin/secrets.cjs'); console.log(Object.keys(s))"` outputs `[ 'set', 'get', 'delete', 'list', 'syncToClaudeJson', 'SERVICE' ]`
2. CLI guards: `node bin/set-secret.cjs` exits 1 with usage message
3. Hook is silent on missing keytar: `node hooks/qgsd-session-start.js` exits 0 (writes graceful error to stderr)
4. Dist copy exists: `ls hooks/dist/qgsd-session-start.js` succeeds
5. install.js registers and unregisters session-start hook: `grep -c 'qgsd-session-start' bin/install.js` = 3
6. package.json: `grep '"keytar"' package.json` shows `"keytar": "^7.9.0"`
7. Correct installed path: `~/.claude/qgsd-bin/secrets.cjs` is the first candidate in `findSecrets()`

## Self-Check: PASSED

- bin/secrets.cjs: FOUND
- bin/set-secret.cjs: FOUND
- hooks/qgsd-session-start.js: FOUND
- hooks/dist/qgsd-session-start.js: FOUND
- Commits 67e3c5e and b851dc7: FOUND in git log
