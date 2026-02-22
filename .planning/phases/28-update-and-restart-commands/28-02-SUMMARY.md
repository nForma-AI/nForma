---
phase: 28-update-and-restart-commands
plan: 02
status: complete
completed: 2026-02-22
---

# Plan 28-02 Summary: /qgsd:mcp-restart Slash Command

## What Was Built

Created `commands/qgsd/mcp-restart.md` — the `/qgsd:mcp-restart` slash command that reads `~/.claude.json` to identify the running MCP server process, kills it via `pkill -f`, waits 2 seconds for Claude Code to auto-reconnect, then calls the agent's identity tool to confirm reconnection.

## Key Files

### Created
- `commands/qgsd/mcp-restart.md` — slash command source with 6 steps
- `~/.claude/commands/qgsd/mcp-restart.md` — installed copy (byte-for-byte identical)

## Implementation Decisions

- **Process identification from ~/.claude.json** — reads `mcpServers[agent].command` and `args[0]` to get process path or package name; avoids fragile ps/grep parsing
- **local node**: `pkill -f <args[0]>` kills by exact argv path
- **npx**: `pkill -f "npm exec <pkg>"` kills parent first (0.5s), then `pkill -f "<pkg>"` kills node child; prevents stale respawn (Pitfall 4)
- **Claude Code auto-restart**: no `claude mcp restart` command exists; process kill + auto-reconnect is the only mechanism
- **2-second wait** before identity verification — gives Claude Code time to spawn the new process
- **Identity verification sequential** — one call per restart, not sibling (R3.2 compliant)
- **Graceful fallback** — if identity still unavailable, prints mcp-status suggestion rather than erroring
- **10 identity tools in allowed-tools** — one per agent
- **R2.1 compliance** — mcp-restart NOT in quorum_commands

## Verification

```
6 steps present: ✓
identity tools in allowed-tools: 10 ✓
pkill patterns present: ✓ (local + npx parent + npx child)
mcp-restart not in hooks: ✓ (R2.1 OK)
installed copy matches source: ✓ (diff clean)
```

## Self-Check: PASSED

All must_haves from plan frontmatter satisfied.
