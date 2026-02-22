---
plan: 33-01
phase: 33-api-key-management
status: complete
completed: 2026-02-22
requirements:
  - KEY-01
  - KEY-02
  - KEY-03
  - KEY-04
---

# 33-01 Summary — Full API Key Management Flow

## What Was Built

Replaced the Phase 33 stub in `commands/qgsd/mcp-setup.md` Agent Sub-Menu Option 1 with a complete, secure API key management flow covering KEY-01 through KEY-04.

### Implementation

The Option 1 flow implements a 5-step sequence:

- **Step A** — Key status check: inline node script reads keytar via `bin/secrets.cjs get()` and checks the `~/.claude.json` env block as fallback. Returns `{ hasKey, method }` to drive the UI messaging.
- **Step B** — Status-aware prompt: displays "(key stored)" hint when keytar has a value, "stored in env block" hint for env_block method, or "no key" message for first-time setup.
- **Step C** — Key collection: two-step AskUserQuestion (first to acknowledge security posture, second to paste the actual key).
- **Step D** — Keytar store: `bin/secrets.cjs set()` invoked with key passed via env var only (never interpolated into script body). Keytar-unavailable fallback: AskUserQuestion confirmation + audit log to `~/.claude/debug/mcp-setup-audit.log`.
- **Step E** — Confirm + apply: shows pending summary, user confirms; then backup `~/.claude.json`, patch `ANTHROPIC_API_KEY` in agent's env block via inline node (env var only), `syncToClaudeJson` to propagate all keytar secrets, then `/qgsd:mcp-restart {agent-name}`.

Sub-menu option label updated from "1 — Set / update API key (Phase 33)" to "1 — Set / update API key". `success_criteria` footer updated to reflect implemented state.

### Files Modified

- `commands/qgsd/mcp-setup.md` — Option 1 fully implemented (+178 lines, stub removed)
- `~/.claude/commands/qgsd/mcp-setup.md` — installed copy synced (byte-identical)

## Verification Results

| Check | Result |
|-------|--------|
| `grep "Phase 33" mcp-setup.md` | 0 matches (stub removed) |
| `grep -c "key stored" mcp-setup.md` | 6 (>= 1 required) |
| `grep -c "syncToClaudeJson" mcp-setup.md` | 7 (>= 2 required) |
| `grep -c "mcp-restart" mcp-setup.md` | 9 (>= 3 required) |
| `grep -c "ANTHROPIC_API_KEY" mcp-setup.md` | 10 (>= 3 required) |
| `wc -l mcp-setup.md` | 721 (>= 600 required) |
| `diff source installed` | identical |

## Self-Check: PASSED

All tasks complete. KEY-01..KEY-04 implemented. No stub remnant. Source and installed copies are identical.
