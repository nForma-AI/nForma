---
phase: quick-279
plan: 01
type: execute
date_completed: 2026-03-12
duration_minutes: 15
tasks_completed: 1
commit_hash: aa3b3a3b
status: VERIFIED
---

# Quick Task 279 Summary: Wire Dual-Subscription Slots

## One-liner
Auto-sync provider slots from providers.json to ~/.claude.json MCP entries and quorum_active, enabling codex-2 and gemini-2 subscription slots in quorum orchestration.

## Task Completion

### Task 1: Add ensureMcpSlotsFromProviders to installer and wire into install flow

**Status:** COMPLETE

**Implementation:**
- Added `ensureMcpSlotsFromProviders()` function (81 lines) to bin/install.js after buildActiveSlots()
- Reads providers.json and syncs all 12 provider slots to ~/.claude.json mcpServers
- Creates entries only for missing slots (preserves pre-existing entries unchanged)
- MCP entry structure:
  ```json
  {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/unified-mcp-server.mjs"],
    "env": { "PROVIDER_SLOT": "<provider-name>" }
  }
  ```
- Wired into install() flow at line 2323, BEFORE buildActiveSlots() call (MULTI-03 dependency)
- Fail-open error handling with differentiated logging (file read, parse, write errors)
- Hard fail only on missing unified-mcp-server.mjs (non-functional slots)

**Files Modified:**
- `/Users/jonathanborduas/code/QGSD/bin/install.js` — 92 insertions

**Verification Results:**

✓ First run: Added MCP entries for codex-2 and gemini-2
```
  ✓ Added MCP entry for codex-2
  ✓ Added MCP entry for gemini-2
  ✓ Synced 2 provider slot(s) to ~/.claude.json
  ✓ Added new slot to quorum_active: codex-2
  ✓ Added new slot to quorum_active: gemini-2
```

✓ MCP entries in ~/.claude.json:
- codex-2: FOUND with correct PROVIDER_SLOT env var and unified-mcp-server.mjs path
- gemini-2: FOUND with correct PROVIDER_SLOT env var and unified-mcp-server.mjs path

✓ quorum_active in ~/.claude/nf.json:
- codex-2: included
- gemini-2: included

✓ Pre-existing entries preserved:
- All 11 existing slots (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6, unified-1) remain unchanged
- No modifications to existing MCP configurations

✓ Idempotency verified:
- BEFORE count: 13 MCP entries
- Second install run: All entries skipped (no additions, no duplicates)
- AFTER count: 13 MCP entries (unchanged)
- All slots report "already exists (skipped)" on second run

✓ All 12 providers from providers.json now have MCP entries:
- codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1
- claude-1, claude-2, claude-3, claude-4, claude-5, claude-6

## Deviations from Plan
None — plan executed exactly as written.

## Technical Notes

**MULTI-03 Orchestration Dependency:**
The `ensureMcpSlotsFromProviders()` call must execute before `buildActiveSlots()` to ensure:
1. All provider slots have MCP entries in ~/.claude.json
2. buildActiveSlots() discovers all slots by reading mcpServers keys
3. quorum_active is populated with complete slot list

**Fail-Open Philosophy:**
- File read errors (providers.json, ~/.claude.json): WARN + continue
- JSON parse errors: WARN + suggest manual edit
- File write errors: WARN + suggest backup
- Missing unified-mcp-server.mjs: ERROR (hard fail — slots would be non-functional)

**Idempotency Pattern:**
Uses `hasOwnProperty()` check to skip existing entries, preventing duplicates and preserving user customizations (e.g., custom env vars on pre-existing slots).

## Success Criteria

All met:
- ✓ codex-2 and gemini-2 MCP entries exist in ~/.claude.json with type:stdio, command:node, unified-mcp-server.mjs path, and correct PROVIDER_SLOT
- ✓ quorum_active in ~/.claude/nf.json includes codex-2 and gemini-2
- ✓ All 11 pre-existing MCP entries preserved unchanged
- ✓ Installer is idempotent — re-running does not duplicate or modify entries
- ✓ Code loads without syntax errors

## Files Created/Modified

**Modified:**
- `/Users/jonathanborduas/code/QGSD/bin/install.js`

**No formal artifacts:** task marked `formal_artifacts: none`
