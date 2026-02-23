---
phase: quick-70
plan: 01
subsystem: mcp-infrastructure
tags: [mcp, subprocess, cli-providers, json-rpc, stdio]
dependency_graph:
  requires: []
  provides: [unified-mcp-server, providers-json-config]
  affects: [~/.claude.json, quorum-calls]
tech_stack:
  added: []
  patterns: [raw-json-rpc-stdio, subprocess-spawn, config-driven-tools]
key_files:
  created:
    - bin/unified-mcp-server.mjs
    - bin/providers.json
  modified:
    - ~/.claude.json (added unified-1 entry)
decisions:
  - "Raw JSON-RPC stdio chosen over SDK dependency — avoids adding @modelcontextprotocol/sdk to QGSD package.json; pure Node.js builtins only"
  - "Config-driven design: new CLI provider = new entry in providers.json, zero code change"
  - "Existing codex-1/gemini-1/opencode-1/copilot-1 entries preserved in ~/.claude.json as fallback"
  - "{prompt} literal string in args_template is the substitution sentinel — simple and explicit"
metrics:
  duration: "~5 min"
  completed: "2026-02-23"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase quick-70 Plan 01: Unified MCP Server Summary

Single `bin/unified-mcp-server.mjs` wrapping Codex, Gemini, OpenCode, and Copilot CLIs as MCP tools via raw JSON-RPC stdio — no SDK dependency, driven by `bin/providers.json`.

## What Was Built

### bin/providers.json

JSON config defining 4 CLI providers. Each entry has:
- `name` — MCP tool name (becomes `mcp__unified-1__<name>` in Claude Code)
- `description` — tool description shown to Claude
- `cli` — absolute path to CLI binary (e.g., `/opt/homebrew/bin/codex`)
- `args_template` — array of CLI args with `{prompt}` as a literal placeholder
- `timeout_ms` — per-provider subprocess timeout (300s default)
- `env` — extra env vars merged onto process.env at spawn time

CLI arg shapes verified from each CLI's `--help`:
- codex: `codex exec <PROMPT>` (positional after subcommand)
- gemini: `gemini -p "<prompt>"` (headless flag)
- opencode: `opencode run <message>` (run subcommand, positional)
- copilot: `copilot -p "<prompt>" --yolo` (non-interactive + skip-permissions)

### bin/unified-mcp-server.mjs (210 lines)

ES module MCP stdio server — no external npm dependencies, pure Node.js builtins:

- **Config load**: reads `providers.json` at startup (path from `UNIFIED_PROVIDERS_CONFIG` env or sibling file path `__dirname/providers.json`)
- **MCP protocol**: handles `initialize`, `tools/list`, `tools/call`, ignores `notifications/initialized`
- **Tool registration**: one MCP tool per provider entry, with `prompt` (required) + `timeout_ms` (optional) input schema
- **Subprocess execution**: `child_process.spawn` per `tools/call`, `{prompt}` placeholder substituted in `args_template`, stdin closed immediately (non-interactive), stdout buffered up to 10MB, SIGTERM+SIGKILL timeout
- **Error handling**: spawn errors returned as tool result text, not thrown; exit code non-zero appended to output

### ~/.claude.json update

Added `unified-1` MCP server entry:

```json
"unified-1": {
  "type": "stdio",
  "command": "node",
  "args": ["/Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs"],
  "env": {}
}
```

Existing `codex-1`, `gemini-1`, `opencode-1`, `copilot-1` entries were preserved as fallback.

## Verification Results

All checks passed:

1. `providers.json` parses, returns 4 names: `['codex', 'gemini', 'opencode', 'copilot']`
2. MCP tools/list smoke test returns `['codex', 'gemini', 'opencode', 'copilot']`
3. `unified-1` entry present in `~/.claude.json` with correct args path
4. All 4 original entries (`codex-1`, `gemini-1`, `opencode-1`, `copilot-1`) still present

## Wiring Instructions

The `unified-1` entry has already been added to `~/.claude.json`. After restarting Claude Code, the following tools will be available:

| MCP Tool Name | Provider | CLI Command |
|---|---|---|
| `mcp__unified-1__codex` | Codex | `codex exec <prompt>` |
| `mcp__unified-1__gemini` | Gemini | `gemini -p <prompt>` |
| `mcp__unified-1__opencode` | OpenCode | `opencode run <prompt>` |
| `mcp__unified-1__copilot` | Copilot | `copilot -p <prompt> --yolo` |

### To remove the old separate entries (after confirming unified works)

Once you've verified a real quorum call through `unified-1`, you can remove the old entries from `~/.claude.json`:

```bash
node -e "
const fs = require('fs'), os = require('os');
const path = os.homedir() + '/.claude.json';
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
['codex-1', 'gemini-1', 'opencode-1', 'copilot-1'].forEach(k => delete d.mcpServers[k]);
fs.writeFileSync(path, JSON.stringify(d, null, 2) + '\n');
console.log('Removed old entries');
"
```

### To add a new CLI provider

Edit `bin/providers.json` and add a new entry to the `providers` array. Restart Claude Code. No code change needed.

Example (adding a hypothetical `aider` provider):
```json
{
  "name": "aider",
  "description": "Run Aider coding assistant non-interactively",
  "cli": "/opt/homebrew/bin/aider",
  "args_template": ["--message", "{prompt}", "--no-auto-commit", "--yes"],
  "prompt_key": "{prompt}",
  "timeout_ms": 300000,
  "env": {}
}
```

## Commits

| Task | Commit | Description |
|---|---|---|
| Task 1: providers.json | e1eb75c | feat(quick-70): add providers.json config for 4 CLI providers |
| Task 2: unified-mcp-server.mjs | 141fe97 | feat(quick-70): add unified-mcp-server.mjs — config-driven MCP stdio server |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
