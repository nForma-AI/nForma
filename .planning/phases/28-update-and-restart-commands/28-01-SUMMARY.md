---
phase: 28-update-and-restart-commands
plan: 01
status: complete
completed: 2026-02-22
---

# Plan 28-01 Summary: /qgsd:mcp-update Slash Command

## What Was Built

Created `commands/qgsd/mcp-update.md` — the `/qgsd:mcp-update` slash command that detects each quorum agent's install method from `~/.claude.json` and runs the correct update command without killing the running process.

## Key Files

### Created
- `commands/qgsd/mcp-update.md` — slash command source with 6 steps
- `~/.claude/commands/qgsd/mcp-update.md` — installed copy (byte-for-byte identical)

## Implementation Decisions

- **Install method from ~/.claude.json** — reads `mcpServers[agent].command` field; `npx` → `npm install -g <package>`; `node` → `git pull + npm run build` in repo dir
- **Package name** — `args[args.length - 1]` (last arg, skipping flags like `-y`)
- **Repo dir** — `path.dirname(path.dirname(args[0]))` strips `/dist/index.js`
- **Deduplication** — `seenKeys` Set tracks unique `npm:<pkg>` and `local:<dir>` keys; duplicates marked `deduplicated: true` and skipped with SKIPPED label
- **Never kills running process** — update flow: update source → suggest `/qgsd:mcp-restart <agent>` to reload
- **Agent validation before ~/.claude.json read** — 10-agent hardcoded list prevents crash on unknown agents
- **R2.1 compliance** — mcp-update NOT in quorum_commands

## Verification

```
6 steps present: ✓
seenKeys deduplication: ✓
mcp-update not in hooks: ✓ (R2.1 OK)
installed copy matches source: ✓ (diff clean)
```

## Self-Check: PASSED

All must_haves from plan frontmatter satisfied.
