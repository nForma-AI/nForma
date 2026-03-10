---
phase: quick-268
verified: 2026-03-10T23:50:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 268: /nf:mcp-repair Skill Verification Report

**Task Goal:** Add /nf:mcp-repair skill — auto-diagnose and fix quorum slot connectivity (Option B: auto-repair with guardrails)

**Verified:** 2026-03-10T23:50:00Z
**Status:** PASSED
**Score:** 4/4 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `/nf:mcp-repair` reads `bin/providers.json` and diagnoses all configured quorum slots | ✓ VERIFIED | Implementation in Step 1: reads provider list dynamically; Step 3 displays diagnosis table with slot count from providers.json |
| 2 | Auto-fixable issues (MCP servers down) are repaired automatically via pkill + reconnect | ✓ VERIFIED | Step 4 implements auto-repair for `mcp-down` classification: kills process using exact path from `~/.claude.json`, waits 3s for auto-restart, verifies with identity tool |
| 3 | Non-auto-fixable issues (auth expired, quota, missing binary) produce actionable user guidance | ✓ VERIFIED | Step 5 provides specific guidance per issue type: cli-missing (install commands), auth-expired (auth commands), quota-exceeded (wait time), timeout (restart command), unknown (raw error) |
| 4 | Before/after health summary shows what changed after repairs | ✓ VERIFIED | Step 7 renders before/after comparison with health metrics (M/N before, P/N after) and repair breakdown showing state transitions |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `commands/nf/mcp-repair.md` | Skill command file, min 150 lines | ✓ VERIFIED | File exists, 327 lines; frontmatter with name/description/allowed-tools correct; all 7 process steps documented; success_criteria section present |

### Key Link Verification

| From | To | Via | Pattern | Status | Details |
|------|----|----|---------|--------|---------|
| mcp-repair.md | bin/providers.json | Read tool (Step 1) | Node.js reads `bin/providers.json` dynamically to discover slot list | ✓ WIRED | 7 references to `providers.json`; dynamic slot count used throughout |
| mcp-repair.md | mcp-status.md | Task() sub-agent pattern (identity + health_check tools) | Same MCP tool calling pattern as mcp-status.md Step 3 | ✓ WIRED | Task() sub-agent defined with all 20 identity/health_check tool calls; mirrors mcp-status.md structure |
| mcp-repair.md | mcp-restart.md | pkill restart pattern (Step 4) | Reuses exact process path lookup and pkill logic from mcp-restart.md | ✓ WIRED | 8 references to `pkill`; reads `~/.claude.json` for process path using same logic as mcp-restart.md; safe narrow pattern (not broad `pkill -f "claude"`) |
| mcp-repair.md | ~/.claude.json | Config read (Step 4) | Node.js `os.homedir()` + path resolution | ✓ WIRED | Step 4 includes inline Node.js script to read ~/.claude.json mcpServers entry and extract process command/args; deduplication logic for shared unified-mcp-server.mjs |

### Classification Categories Verification

All 7 failure categories from plan are implemented:

| Category | Implementation | Guidance |
|----------|-----------------|----------|
| `healthy` | No action needed branch in Step 3/diagnosis | — |
| `mcp-down` | Step 4 auto-repair for claude-1..6 slots where identity fails | pkill + reconnect |
| `cli-missing` | Step 5 guidance from BINARY_STATUS check (Step 2 three-tier resolution) | Tool-specific install commands (npm install, go install, gh extension) |
| `auth-expired` | Step 5 guidance for 401/403 errors in health_check results | Tool-specific auth commands (codex auth login, gemini auth login, etc.) |
| `quota-exceeded` | Step 5 guidance for 402/429 errors in health_check results | Wait ~30min message + --force-quorum option |
| `timeout` | Step 5 guidance for null/timeout results | Suggest `/nf:mcp-restart <slot>` |
| `unknown` | Step 5 fallback for other errors | Raw error message displayed |

### Formal Specification Compliance

**Quorum Invariant Status:** ✓ VERIFIED
Reference: `.planning/formal/spec/quorum/invariants.md` — EventualConsensus property

The implementation explicitly declares in the objective section:
- "This command is read-only except for the pkill restart action on MCP servers"
- "It does NOT invoke quorum and is NOT in quorum_commands"
- Success criteria: "No quorum invariants violated (observational + restart only)"

**Analysis:**
- The command performs observation only (MCP tool calls) except for subprocess management
- The `pkill` action only affects claude-mcp server processes (subprocess servers), not the quorum orchestration layer
- Does not modify voting, consensus, or dispatch logic of the formal quorum model
- Does not appear in `quorum_commands` — standalone diagnostic tool
- Complies with EventualConsensus fairness assumption: weak fairness on Decide/Deliberate/StartQuorum/AnyCollectVotes actions is not affected by this tool

### Implementation Quality Checks

| Check | Status | Finding |
|-------|--------|---------|
| File structure | ✓ PASS | Frontmatter (name, description, allowed-tools) correct; process section with 7 numbered steps |
| Tool coverage | ✓ PASS | Includes Read, Bash, Task allowed-tools; 21 identity + 20 health_check MCP tools (covers 4 CLI slots + 6 Claude MCP slots, with codex-2/gemini-2 references noted) |
| Sequential execution pattern | ✓ PASS | Step intro warns against parallel Bash calls; all steps are sequential |
| State management | ✓ PASS | $BEFORE_STATE captured in Step 1 (Step 2 classification); $AFTER_STATE captured in Step 6 (if repairs attempted) |
| Dynamic slot discovery | ✓ PASS | Node.js script in Step 1 reads `providers.json` and filters to exclude "unified-1"; slot count not hardcoded |
| Three-tier binary resolution | ✓ PASS | Step 2 checks: 1) `providers.json` cli field existence, 2) `which` fallback, 3) missing classification |
| Process path safety | ✓ PASS | Step 4 uses exact path from ~/.claude.json (no broad patterns like `pkill -f "claude"`); deduplication for shared processes |
| Manual guidance completeness | ✓ PASS | Step 5 provides tool-specific commands for all non-fixable categories |
| Before/after summary | ✓ PASS | Step 7 shows M/N before vs P/N after metrics; lists repaired slots with state transitions |
| Anti-patterns | ✓ PASS | No TODO, FIXME, placeholder, or stub code found |

### Verification Gap Analysis

**No gaps found.** All must-haves verified:
1. ✓ Dynamic slot diagnosis from `bin/providers.json`
2. ✓ Auto-repair for downed MCP servers (pkill + reconnect)
3. ✓ Actionable guidance for non-fixable issues
4. ✓ Before/after health summary

All required patterns and wiring present and correct.

---

## Summary

Quick task 268 successfully implements the `/nf:mcp-repair` skill command with full auto-diagnosis and auto-repair capability for quorum slot failures. The command:

- **Diagnoses** all configured slots via MCP identity + health_check tools
- **Classifies** failures into 7 categories (healthy, mcp-down, cli-missing, auth-expired, quota-exceeded, timeout, unknown)
- **Auto-repairs** downed MCP servers using safe pkill pattern with exact process paths
- **Guides users** on manual fixes with tool-specific install and auth commands
- **Verifies** repairs before/after to show impact
- **Reports** health metrics (before/after counts)

The implementation follows established patterns from mcp-status.md and mcp-restart.md, uses Task() sub-agent pattern for clean output, and respects quorum invariants by being observational (except for safe process restart).

No quorum invariants are violated. Task is autonomous and ready for production use.

---

_Verified: 2026-03-10T23:50:00Z_
_Verifier: Claude Code (nf-verifier)_
