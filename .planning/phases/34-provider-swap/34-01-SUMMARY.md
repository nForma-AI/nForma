---
plan: 34-01
phase: 34-provider-swap
status: complete
completed: 2026-02-22
requirements:
  - PROV-01
  - PROV-02
  - PROV-03
---

# 34-01 Summary — Full Provider Swap Flow

## What Was Built

Replaced the Phase 34 stub in `commands/qgsd/mcp-setup.md` Agent Sub-Menu Option 2 with a complete, functional provider swap flow covering PROV-01 through PROV-03.

### Implementation

The Option 2 flow implements a 4-step sequence:

- **Step A** — Current provider display: inline node script reads `ANTHROPIC_BASE_URL` from `~/.claude.json` for the selected agent and maps it to a friendly name (AkashML / Together.xyz / Fireworks / raw URL).
- **Step B** — Provider selection: AskUserQuestion with 4 numbered curated options + Skip. Curated options show the canonical URL inline so user knows exactly what they're selecting.
- **Step C** — URL resolution: curated selections fill `NEW_URL` and `NEW_PROVIDER_NAME` automatically. "Custom URL" option opens a second AskUserQuestion for free-text entry (with Cancel path back to sub-menu).
- **Step D** — Confirm + apply: shows pending summary with new provider name and URL, user confirms, then: backup `~/.claude.json`, patch `ANTHROPIC_BASE_URL` via inline node with `NEW_URL` passed exclusively as env var, invoke `/qgsd:mcp-restart {agent-name}` sequentially.

Sub-menu option label updated from "2 — Swap provider (Phase 34)" to "2 — Swap provider". `success_criteria` footer updated to reflect implemented state.

### Files Modified

- `commands/qgsd/mcp-setup.md` — Option 2 fully implemented (+117 lines, stub removed)
- `~/.claude/commands/qgsd/mcp-setup.md` — installed copy synced (byte-identical)

## Verification Results

| Check | Result |
|-------|--------|
| `grep "Phase 34" mcp-setup.md` | 0 matches (stub removed) |
| `grep -c "AkashML" mcp-setup.md` | 8 (>= 2 required) |
| `grep -c "ANTHROPIC_BASE_URL" mcp-setup.md` | 7 (>= 3 required) |
| `grep -c "mcp-restart" mcp-setup.md` | 11 (>= 4 required) |
| `grep -c "Custom URL" mcp-setup.md` | 3 (>= 1 required) |
| `diff source installed` | identical |

## Self-Check: PASSED

All tasks complete. PROV-01..PROV-03 implemented. No stub remnant. Source and installed copies are identical.
