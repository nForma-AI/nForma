---
phase: quick-93
plan: 01
subsystem: subprocess-provider-management
tags: [cli-discovery, manage-agents, providers, subprocess]
key-files:
  created:
    - bin/resolve-cli.cjs
  modified:
    - bin/manage-agents.cjs
decisions:
  - "resolveCli uses priority-ordered search (which > Homebrew > npm global > system paths > bare fallback) — stops at first hit"
  - "manage-agents.cjs addSubprocessProvider/editSubprocessProvider write resolved path to providers.json at config time, not at spawn time"
  - "Bare name detection uses absence of '/' as the signal — no path separator = bare name = resolve attempt"
metrics:
  duration: "~8 min"
  completed: "2026-02-24"
  tasks: 2
  files: 2
---

# Quick Task 93: Add CLI auto-discovery for subprocess providers

## One-liner

Priority-ordered CLI resolution (which, Homebrew, npm global, system paths, bare fallback) integrated into manage-agents.cjs add/edit flows so providers.json always stores correct absolute paths regardless of install location.

## What Was Built

### bin/resolve-cli.cjs (NEW)

CommonJS module exporting `resolveCli(name)` — a synchronous, never-throwing function that resolves a bare CLI name to its full executable path.

Resolution order (stops at first hit):
1. `which <name>` via spawnSync — uses system PATH
2. Homebrew prefixes: `/opt/homebrew/bin`, `/usr/local/bin`
3. npm global bin: `npm root -g` + `../bin/<name>`
4. System paths: `/usr/bin`
5. Fallback: returns bare `name` unchanged

Also includes a standalone CLI interface: `node bin/resolve-cli.cjs <name>` prints the resolved path.

### bin/manage-agents.cjs (MODIFIED)

Added the following to support subprocess provider management in `providers.json`:

- `const { resolveCli } = require('./resolve-cli.cjs')` import at top
- `PROVIDERS_JSON_PATH` / `PROVIDERS_JSON_TMP` constants
- `readProvidersJson()` / `writeProvidersJson()` helpers (atomic write via .tmp + rename)
- `addSubprocessProvider()` — interactive prompt for name/cli/description/mainTool/model/args_template/timeout/quorum_timeout; auto-resolves bare CLI names and displays resolved path before saving
- `editSubprocessProvider()` — lists providers with `type === 'subprocess'`, shows summary card, allows editing cli/model/description/args_template/timeout_ms/quorum_timeout_ms; auto-resolves bare CLI names on cli field changes
- Menu option `7. Add subprocess provider` (value: `add-sub`)
- Menu option `8. Edit subprocess provider` (value: `edit-sub`)
- Dispatch wiring in `mainMenu()`

All existing `addAgent()` / `editAgent()` MCP slot logic is unchanged.

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `bin/resolve-cli.cjs` | Created | CLI path resolution utility, 101 lines |
| `bin/manage-agents.cjs` | Modified | +304 lines: resolveCli import, 2 new functions, menu options 7/8 |

## Verification Results

```
node bin/resolve-cli.cjs codex
# /opt/homebrew/bin/codex

node bin/resolve-cli.cjs gemini
# /opt/homebrew/bin/gemini

node -e "const { resolveCli } = require('./bin/resolve-cli.cjs'); console.log(resolveCli('opencode')); console.log(resolveCli('no-such-cli'));"
# /opt/homebrew/bin/opencode
# no-such-cli

node -e "require('./bin/manage-agents.cjs'); console.log('load OK');"
# load OK
```

All success criteria met:
- `bin/resolve-cli.cjs` exists, exports `resolveCli(name)`, returns full paths for installed CLIs and bare name fallback for unknown ones
- `bin/manage-agents.cjs` loads cleanly, all prior exports intact (`readClaudeJson`, `writeClaudeJson`, `getGlobalMcpServers`, `mainMenu`)
- `resolveCli` import does not crash the module
- Menu options 7 and 8 present in choices array
- `addSubprocessProvider` and `editSubprocessProvider` functions defined
- `providers.json` NOT touched by this task — only modified when user explicitly adds/edits via menu

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 225643d | feat(quick-93): create bin/resolve-cli.cjs |
| Task 2 | eac362a | feat(quick-93): integrate resolveCli into manage-agents.cjs subprocess provider flows |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `bin/resolve-cli.cjs` exists and exports `resolveCli`
- `bin/manage-agents.cjs` loads cleanly with new functions and menu options
- Commits 225643d and eac362a verified in git log
