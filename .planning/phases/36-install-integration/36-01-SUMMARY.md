---
plan: 36-01
phase: 36-install-integration
status: complete
completed: 2026-02-22
requirements:
  - INST-01
---

# Phase 36 — Plan 01 Summary

## Plan: 36-01 Install Integration (INST-01)

**Status:** Complete
**Date:** 2026-02-22
**Commit:** 3d73404

## What was done

Added INST-01 nudge to `bin/install.js`:

### hasClaudeMcpAgents() helper (added after warnMissingMcpServers())

Reads `~/.claude.json` mcpServers and returns `true` if any entry matches:
- Known template names: `claude-deepseek`, `claude-minimax`, `claude-qwen-coder`, `claude-llama4`, `claude-kimi`
- OR: `args` array contains a path with the substring `claude-mcp-server`

Fail-open: any read/parse errors return `false` (never blocks installation).

### finishInstall() nudge

When `runtime === 'claude'` and `!hasClaudeMcpAgents()`:
```
  ⚠ No quorum agents configured.
    Run /qgsd:mcp-setup in Claude Code to set up your agents.
```

Nudge is omitted when agents are already configured or runtime is Gemini/OpenCode.

## Verification Results

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| hasClaudeMcpAgents + nudge text count | >= 3 | 3 | PASS |
| claude-mcp-server detection patterns | >= 3 | 3 | PASS |
| Phase 36 in operational code | 0 | 0 | PASS |
| runtime === 'claude' guard present | >= 1 | 1 (line 1929) | PASS |
| node --check bin/install.js | exits 0 | SYNTAX_OK | PASS |
| Self-test: no agents case | false | false | PASS |
| Self-test: by name (claude-deepseek) | true | true | PASS |
| Self-test: by path (claude-mcp-server) | true | true | PASS |
| Self-test: missing file | false | false | PASS |
| Self-test: empty JSON | false | false | PASS |

## Self-Check: PASSED

INST-01 fully implemented. Nudge fires only when no claude-mcp-server agents detected and runtime is Claude Code.
