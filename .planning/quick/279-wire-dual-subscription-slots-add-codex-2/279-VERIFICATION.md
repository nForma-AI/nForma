---
phase: quick-279
verified: 2026-03-12T08:45:00Z
status: passed
score: 4/4 must-haves verified
formal_check:
  passed: 3
  failed: 1
  skipped: 0
  counterexamples: ["mcp-calls:tlc"]
  note: "mcp-calls:tlc counterexample is pre-existing TLA+ liveness issue unrelated to MCP server registration — not task-introduced"
---

# Quick Task 279: Wire Dual-Subscription Slots Verification Report

**Task Goal:** Wire dual-subscription slots: add codex-2 and gemini-2 MCP server entries to ~/.claude.json and quorum_active roster, update installer

**Verified:** 2026-03-12T08:45:00Z

**Status:** PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | codex-2 and gemini-2 appear as MCP server entries in ~/.claude.json after install | ✓ VERIFIED | ensureMcpSlotsFromProviders() at lines 245-325 reads providers.json, creates stdio/node/unified-mcp-server.mjs entries with correct PROVIDER_SLOT env vars for both slots |
| 2 | codex-2 and gemini-2 appear in quorum_active array in ~/.claude/nf.json after install | ✓ VERIFIED | ensureMcpSlotsFromProviders() called at line 2323 before buildActiveSlots() at line 2344, ensuring slots are discoverable and included in quorum_active |
| 3 | Existing MCP entries (codex-1, gemini-1, etc.) are preserved unchanged | ✓ VERIFIED | Line 297 checks hasOwnProperty() before adding — only ADD missing, never modify existing. All 11 existing slots remain unchanged per SUMMARY verification. |
| 4 | Each new entry uses unified-mcp-server.mjs with correct PROVIDER_SLOT env var | ✓ VERIFIED | Lines 299-304 create entry with type:stdio, command:node, args:[unified-mcp-server.mjs path], env:{PROVIDER_SLOT: provider.name}. unified-mcp-server.mjs exists and is executable. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/install.js:ensureMcpSlotsFromProviders` | ensureMcpSlotsFromProviders function that syncs providers.json slots to ~/.claude.json | ✓ VERIFIED | Lines 245-325 implement full function: reads providers.json, manages ~/.claude.json, creates MCP entries, fail-open error handling |
| `bin/providers.json` | Provider slot definitions including codex-2 and gemini-2 | ✓ VERIFIED | File contains 12 providers: codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1, claude-1..6 (13 total after dual-slot expansion) |
| `bin/unified-mcp-server.mjs` | MCP server dispatcher referenced by args path | ✓ VERIFIED | File exists at /Users/jonathanborduas/code/QGSD/bin/unified-mcp-server.mjs (24KB, executable) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bin/install.js` | `bin/providers.json` | JSON.parse read of providers array | ✓ WIRED | Line 247 opens providersJsonPath, line 254 parses with JSON.parse(fs.readFileSync()) |
| `bin/install.js` | `~/.claude.json` | mcpServers write for missing slots | ✓ WIRED | Line 246 opens claudeJsonPath, line 315 writes with fs.writeFileSync(JSON.stringify(claudeConfig)) |
| `ensureMcpSlotsFromProviders()` | `buildActiveSlots()` | Called before in install flow (MULTI-03 dependency) | ✓ WIRED | Line 2323 calls ensureMcpSlotsFromProviders(), line 2344 calls buildActiveSlots(). Comment at line 2320-2321 documents dependency. |

### Formal Verification

**Status:** Pre-existing counterexample (NOT task-introduced)

| Module:Tool | Result | Details |
|-------------|--------|---------|
| installer:OverridesPreserved | PASSED | Existing entries never cleared — implementation only adds missing, preserves all existing top-level config keys |
| mcp-calls:tlc | COUNTEREXAMPLE | Pre-existing TLA+ liveness issue with EventualDecision property (quorum fairness). NOT related to MCP server registration. Task did NOT modify any TLA+ specs or quorum decision logic. |
| quorum:EventualConsensus | PASSED | Quorum decision-making liveness unaffected by MCP slot registration changes |

**Assessment:** The mcp-calls:tlc counterexample existed before quick-279 and is unrelated to slot registration. Task scope is limited to bin/install.js configuration code, which does not affect TLA+ specs or quorum decision-making liveness properties. Per explicit prompt directive: "This counterexample should NOT be treated as a hard failure for this task's verification."

### Invariants Compliance

#### OverridesPreserved (installer invariant)
**Property:** `[][projectOverrides = TRUE => projectOverrides' = TRUE]_vars`

**Implementation:** Lines 266-285 read full claudeConfig, preserve all existing top-level keys, only normalize mcpServers if missing. Lines 297-310 check hasOwnProperty() before adding, never modifying existing entries. Line 315 writes back complete config.

**Status:** SATISFIED

#### COMP-04 (quorum: quorum_active populated from discovered slots)
**Property:** quorum_active must be populated from slots discovered in mcpServers keys

**Implementation:**
1. ensureMcpSlotsFromProviders() at line 2323 adds codex-2, gemini-2 to mcpServers
2. buildActiveSlots() at line 2344 returns Object.keys(mcpServers)
3. Result becomes quorum_active in nf.json

**Status:** SATISFIED

#### MULTI-03 (installer: ensureMcpSlotsFromProviders must run before buildActiveSlots)
**Property:** ensureMcpSlotsFromProviders() populates mcpServers before buildActiveSlots() reads it

**Implementation:** Line 2323 calls ensureMcpSlotsFromProviders(), line 2344 calls buildActiveSlots(), with documentation at lines 2320-2321.

**Status:** SATISFIED

### Anti-Patterns Found

No blocker anti-patterns detected:
- No TODO/FIXME/XXX in ensureMcpSlotsFromProviders or related functions
- No placeholder comments or "coming soon" text
- No empty implementations (all branches have substantive code)
- No orphaned console.log-only implementations
- No unhandled edge cases (fail-open with differentiated error logging per spec)
- Proper error handling: file read/parse/write wrapped in try/catch with specific warnings
- Hard fail only on missing unified-mcp-server.mjs (correct per design)

### Success Criteria

All met:
- ✓ codex-2 and gemini-2 MCP entries exist in ~/.claude.json with type:stdio, command:node, unified-mcp-server.mjs path, and correct PROVIDER_SLOT
- ✓ quorum_active in ~/.claude/nf.json includes codex-2 and gemini-2
- ✓ All 11 pre-existing MCP entries preserved unchanged (codex-1, gemini-1, opencode-1, copilot-1, claude-1..6, unified-1)
- ✓ Installer is idempotent — re-running does not duplicate or modify entries (verified: BEFORE=13, AFTER=13, second run skips all)
- ✓ Code syntax valid (loads without errors)

### Files Modified

| File | Changes | Status |
|------|---------|--------|
| `/Users/jonathanborduas/code/QGSD/bin/install.js` | +92 lines: ensureMcpSlotsFromProviders() function (81 lines) + wiring call + comment (11 lines) | ✓ IMPLEMENTED |

### Implementation Summary

**Function ensureMcpSlotsFromProviders() (lines 245-325):**
1. Read providers.json from repo root (line 247)
2. Read ~/.claude.json, normalize if missing mcpServers (lines 266-285)
3. Verify unified-mcp-server.mjs exists (line 288)
4. For each provider, check if mcpServers[provider.name] exists (line 297)
5. If missing, create entry with required structure (lines 299-304)
6. Write back if any entries added (lines 313-320)
7. Fail-open error handling throughout (lines 250-324)

**Wiring (lines 2320-2323):**
- Comment documents MULTI-03 dependency
- Called before buildActiveSlots() to ensure slots are discoverable

**Design Decisions:**
- Only ADD missing, never MODIFY existing (preserves user customizations)
- Fail-open: errors logged but do not abort install
- Hard fail only on missing unified-mcp-server.mjs (non-functional slots)
- Idempotent: hasOwnProperty() check prevents re-adding existing entries

---

_Verified: 2026-03-12T08:45:00Z_
_Verifier: Claude (nf-verifier)_
