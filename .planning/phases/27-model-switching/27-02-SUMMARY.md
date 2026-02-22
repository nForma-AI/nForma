---
plan: 27-02
phase: 27-model-switching
status: complete
completed: 2026-02-22
requirements:
  - MGR-01
---

# Summary: Create /qgsd:mcp-set-model slash command

## What Was Built

Created `commands/qgsd/mcp-set-model.md` — a 6-step slash command for setting quorum agent model preferences:

1. **Step 1** — Parse `$ARGUMENTS` into `$AGENT` and `$MODEL` tokens; prints usage on missing args
2. **Step 2** — Validates `$AGENT` against hardcoded 10-agent list before any identity call (prevents hang on typos)
3. **Step 3** — Calls `mcp__<$AGENT>__identity` sequentially (per R3.2); handles timeout with unvalidated fallback
4. **Step 4** — Validates `$MODEL` against `available_models` from identity response; prints full list on failure
5. **Step 5** — Inline `node -e` script reads `~/.claude/qgsd.json`, captures old model, writes new preference, emits JSON
6. **Step 6** — Prints confirmation: agent, old model, new model, persistence note

The command is installed globally to `~/.claude/commands/qgsd/mcp-set-model.md`.

## Key Files

- `commands/qgsd/mcp-set-model.md` — source slash command
- `~/.claude/commands/qgsd/mcp-set-model.md` — installed copy (byte-for-byte identical)

## Verification

- 6 process steps present: PASS
- All 10 agents in allowed-tools (identity tool per agent): PASS (10 mcp__*__identity lines)
- diff source vs installed: clean (files identical)
- model_preferences write pattern present: PASS
- mcp-set-model NOT in quorum_commands (R2.1): PASS

## Self-Check: PASSED
