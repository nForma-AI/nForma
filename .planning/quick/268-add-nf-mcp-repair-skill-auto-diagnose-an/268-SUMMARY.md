# Quick Task 268 Summary

## Task
Add /nf:mcp-repair skill - auto-diagnose and fix quorum slot connectivity (Option B: auto-repair with guardrails)

## What was done
Created `commands/nf/mcp-repair.md` — a new skill command that automates the quorum slot diagnosis-repair-verify cycle.

### Key features
1. **7-step process**: diagnose → classify → display → auto-repair → guide → verify → summarize
2. **Dynamic slot discovery**: reads `bin/providers.json` instead of hardcoding slot count
3. **Three-tier binary resolution**: providers.json `cli` field → `which` fallback → missing
4. **Safe auto-repair**: pkill uses exact process path from `~/.claude.json` (same proven pattern as mcp-restart.md)
5. **Actionable manual guidance**: specific install/auth commands per CLI tool
6. **Before/after health summary**: shows repair impact metrics
7. **Task() sub-agent pattern**: keeps raw MCP tool output out of main conversation

### Classification categories
| Category | Auto-fixable? | Action |
|---|---|---|
| healthy | — | No action |
| mcp-down | YES | pkill + reconnect |
| cli-missing | NO | Install command |
| auth-expired | NO | Auth command |
| quota-exceeded | NO | Wait ~30min |
| timeout | NO | /nf:mcp-restart |
| unknown | NO | Raw error shown |

## Files changed
- `commands/nf/mcp-repair.md` (created, 327 lines)

## Quorum review
- R3.6: 1 improvement iteration applied (simplified timeout, 3-tier binary check, exact pkill path)
- Consensus: APPROVE (Claude + claude-3 APPROVE, claude-1 BLOCK → improvements incorporated)
