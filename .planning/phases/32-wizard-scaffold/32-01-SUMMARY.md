---
plan: 32-01
phase: 32-wizard-scaffold
status: complete
completed: 2026-02-22
duration: ~4 min
tasks_completed: 2
tasks_total: 2
commits:
  - 7fdb4b8
requirements:
  - WIZ-01
  - WIZ-02
---

# Summary: Phase 32-01 — Command Scaffold + First-Run Path

## What Was Built

Created `commands/qgsd/mcp-setup.md` — the full `/qgsd:mcp-setup` slash command implementing:

1. **First-run detection**: inline node script reads `~/.claude.json`, filters to entries with command+args set, routes on `isFirstRun` boolean
2. **First-run onboarding flow**: QGSD welcome banner, 5 agent templates (deepseek/minimax/qwen-coder/llama4/kimi with provider/model details), AskUserQuestion-based selection
3. **Key collection**: keytar storage via `bin/secrets.cjs`, keytar-unavailable fallback with explicit confirmation, audit log to `~/.claude/debug/mcp-setup-audit.log`
4. **Batch write**: accumulates all changes in memory, creates timestamped backup before write, writes with 2-space indent, syncs keytar secrets via `syncToClaudeJson`
5. **Sequential restart**: invokes `/qgsd:mcp-restart` per agent, handles restart failure gracefully (leaves config written, shows manual retry)
6. **Re-run agent menu scaffold**: numbered roster with model/provider/key-status columns, agent sub-menu (set key / swap provider / remove) with Phase 33/34/35 stubs
7. **Confirm+apply+restart flow**: reusable pattern for future sub-actions

Installed to `~/.claude/commands/qgsd/mcp-setup.md` — SYNC OK (diff clean).

## Key Files

- **created**: `commands/qgsd/mcp-setup.md` (551 lines)
- **created**: `~/.claude/commands/qgsd/mcp-setup.md` (installed copy, identical)

## Self-Check

- [x] commands/qgsd/mcp-setup.md exists with `name: qgsd:mcp-setup` frontmatter
- [x] `~/.claude/commands/qgsd/mcp-setup.md` identical to source (SYNC OK)
- [x] First-run detection present (8 occurrences of `isFirstRun`/`first-run`)
- [x] Keytar fallback present with `Keychain Unavailable` confirmation prompt
- [x] 551 lines (well above 80 line minimum)
- [x] Re-run Agent Menu placeholder section present for Plan 02
- [x] `## Agent Sub-Menu` section present with three action stubs

## Requirements Addressed

- WIZ-01: `/qgsd:mcp-setup` command file exists and is installed
- WIZ-02: First-run linear onboarding flow (banner → templates → key collection → apply → restart → summary)
