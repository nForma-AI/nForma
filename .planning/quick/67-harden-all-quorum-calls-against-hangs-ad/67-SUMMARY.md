---
phase: quick-67
plan: "01"
subsystem: quorum-orchestrator
tags: [quorum, timeout, hang-prevention, mcp, reliability]
dependency_graph:
  requires: []
  provides: [per-model-timeout-guard]
  affects: [agents/qgsd-quorum-orchestrator.md, ~/.claude.json]
tech_stack:
  added: []
  patterns: [per-model-timeout-guard, UNAVAIL-skip]
key_files:
  created: []
  modified:
    - agents/qgsd-quorum-orchestrator.md
    - ~/.claude.json (CLAUDE_MCP_TIMEOUT_MS for all claude-* entries)
decisions:
  - "30s per-model timeout chosen to match health_check timeout and surface hangs quickly while allowing real inference to complete"
  - "CLAUDE_MCP_TIMEOUT_MS reduced from 120s to 30s — provider endpoint probes don't detect model-level inference queue stalls"
metrics:
  duration: "~5 min"
  completed: "2026-02-23"
  tasks: 2
  files: 2
---

# Quick Task 67: Harden All Quorum Calls Against Hangs — Add Per-Model Timeout Wrapper Summary

**One-liner:** Reduced CLAUDE_MCP_TIMEOUT_MS from 120s to 30s in ~/.claude.json and added explicit 30-second per-model timeout guard instructions to all four quorum call sites in the orchestrator agent definition.

## What Was Done

### Task 1 — Reduce CLAUDE_MCP_TIMEOUT_MS to 30s in ~/.claude.json

Updated all 6 claude-mcp-server entries (`claude-deepseek`, `claude-minimax`, `claude-qwen-coder`, `claude-kimi`, `claude-llama4`, `claude-glm`) in `~/.claude.json` from:
```
"CLAUDE_MCP_TIMEOUT_MS": "120000"
```
to:
```
"CLAUDE_MCP_TIMEOUT_MS": "30000"
```

`CLAUDE_MCP_HEALTH_TIMEOUT_MS` was left at 30000 (already correct). Native CLI agent entries were not touched.

**Rationale:** claude-mcp-server's `executeCommand()` reads `CLAUDE_MCP_TIMEOUT_MS` from `process.env` at startup. 120s allowed hung inference calls to freeze the quorum orchestrator for 2 minutes per model. 30s is long enough for real inference while short enough to surface hangs promptly.

### Task 2 — Add per-model timeout guard to quorum orchestrator + install sync

Added 4 explicit timeout guard blocks to `agents/qgsd-quorum-orchestrator.md`:

1. **Step 2 (Team identity capture):** Timeout guard before `health_check` call — marks server UNAVAIL immediately on hang or error.

2. **Mode A (Query models loop):** Per-model timeout before slot iteration — marks slot UNAVAIL on hang, logs `[<slotName>] TIMEOUT — marked UNAVAIL`, continues with remaining models.

3. **Mode A (Deliberation rounds):** 30 seconds timeout guard statement — hung models marked UNAVAIL for remainder of quorum run.

4. **Mode B (Dispatch quorum workers):** Per-worker timeout — Task worker or underlying MCP call exceeding 30s → UNAVAIL verdict, continue with remaining workers.

Ran install sync (`node bin/install.js --claude --global`) to propagate changes to `~/.claude/agents/qgsd-quorum-orchestrator.md`. Diff confirmed only the expected `~/.claude/qgsd.json` → absolute path substitution, all timeout guards present in both copies.

## Verification Results

| Check | Result |
|-------|--------|
| claude-* entries with CLAUDE_MCP_TIMEOUT_MS=30000 | 6/6 |
| "30 seconds" occurrences in source orchestrator | 4 |
| "30 seconds" occurrences in installed orchestrator | 4 |
| TIMEOUT — marked UNAVAIL lines in source | 2 |
| diff source vs installed | only path substitution |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `agents/qgsd-quorum-orchestrator.md` modified and committed (fccf683)
- [x] `~/.claude/agents/qgsd-quorum-orchestrator.md` updated via install sync
- [x] `~/.claude.json` all 6 claude-* entries have CLAUDE_MCP_TIMEOUT_MS=30000
- [x] 4 "30 seconds" occurrences verified in both source and installed copies
