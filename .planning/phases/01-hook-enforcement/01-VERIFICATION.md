---
phase: 01-hook-enforcement
verified: 2026-02-20T20:15:00Z
updated: 2026-02-20T00:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification: true
gaps: []
human_verification:
  - test: "Live session: /gsd:plan-phase triggers quorum injection"
    expected: "After running /gsd:plan-phase in a new Claude Code session, Claude should reference needing to call mcp__codex-cli__review, mcp__gemini-cli__gemini, and mcp__opencode__opencode before delivering output"
    why_human: "Hook fires in Claude Code runtime. Can only be verified by starting a new session after settings.json changes — programmatic simulation does not exercise the full UserPromptSubmit event pipeline."
  - test: "Live session: /gsd:execute-phase produces no quorum injection"
    expected: "Running /gsd:execute-phase should not cause Claude to mention quorum requirements — hook must be silent"
    why_human: "Requires a live Claude Code session to confirm the absence of injection rather than its presence."
  - test: "Live session: Stop hook blocks planning response when quorum tool calls are absent"
    expected: "If Claude attempts to deliver a planning response without having called the three quorum MCP tools, the Stop hook should block with a message naming the missing tools"
    why_human: "Requires either disabling MCP servers temporarily or running in a session without them configured. Cannot simulate the full Stop hook event pipeline programmatically."
---

# Phase 01: Hook Enforcement Verification Report

**Phase Goal:** Claude cannot deliver a GSD planning response without evidence of quorum in the transcript — enforced structurally, not behaviorally
**Verified:** 2026-02-20T20:15:00Z
**Re-verified:** 2026-02-20 (gap closure Plan 01-06)
**Status:** passed
**Re-verification:** Yes — STOP-05 gap closed; requirement revised to match implementation

---

## Goal Achievement

### Observable Truths

The following must-haves were derived from the phase goal and PLAN frontmatter across plans 01-01 through 01-05.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stop hook exits 0 immediately when stop_hook_active is true (infinite loop prevention) | VERIFIED | TC1 passes; line 144 in qgsd-stop.js: `if (input.stop_hook_active) { process.exit(0); }` — first conditional after parse |
| 2 | Stop hook exits 0 immediately when hook_event_name is SubagentStop | VERIFIED | TC2 passes; line 149: `if (input.hook_event_name === 'SubagentStop') { process.exit(0); }` — second conditional |
| 3 | Stop hook reads only current-turn JSONL lines (since last user message) for quorum evidence | VERIFIED | TC7 passes (old-turn planning not in scope); getCurrentTurnLines() scans backward to last user message boundary (lines 52-66) |
| 4 | Stop hook blocks with decision:block when a planning command was in scope and quorum tool calls are missing | VERIFIED | TC6 and TC9 pass; stdout JSON contains `decision: "block"` with QUORUM REQUIRED reason |
| 5 | Stop hook passes (exit 0, no output) when quorum evidence for all three models is present in scope | VERIFIED | TC5 passes; all three tool_use blocks found → exit 0, empty stdout |
| 6 | Stop hook passes when no planning command appears in the current-turn scope | VERIFIED | TC4 passes; non-GSD prompt exits 0 silently |
| 7 | Block reason names the exact missing tool calls and provides actionable instructions | VERIFIED | TC6 asserts reason includes `mcp__gemini-cli__` and `mcp__opencode__`; format "QUORUM REQUIRED: Before completing this /gsd:[cmd] response, call [tool1], [tool2] with your current plan. Present their responses, then deliver your final output." (lines 196-199) |
| 8 | Config file at ~/.claude/qgsd.json defines quorum_commands, required_models tool prefixes, fail_mode | VERIFIED | templates/qgsd.json is valid JSON with 6 quorum_commands, required_models for codex/gemini/opencode, fail_mode: "open" |
| 9 | Hooks fall back to hardcoded defaults when qgsd.json is absent or malformed | VERIFIED | TC9 exercises this path explicitly; loadConfig() returns DEFAULT_CONFIG on missing/parse-error (lines 31-40) |
| 10 | Stop hook reads transcript JSONL as authoritative source — no fast-path pre-check (design decision: last_assistant_message substring matching unreliable; JSONL parse synchronous and correct for all transcript sizes) | VERIFIED | Requirement revised by Plan 01-06 gap closure (quorum consensus: Claude + Codex + Gemini). STOP-05 in REQUIREMENTS.md now describes JSONL-only verification. Implementation is correct: JSONL parse always runs, all 9 tests pass. |
| 11 | UserPromptSubmit hook injects quorum instructions on planning commands via hookSpecificOutput.additionalContext | VERIFIED | qgsd-prompt.js line 64: stdout JSON uses `hookSpecificOutput.additionalContext` (not systemMessage) |
| 12 | UserPromptSubmit hook is silent on non-planning commands (execute-phase, bare text) | VERIFIED | Anchored allowlist regex `^\\s*\\/gsd:(cmd1|cmd2...)(\\s|$)` prevents false matches; exit 0 with no stdout for non-matching prompts |
| 13 | Injected context names all three tool calls: mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode | VERIFIED | DEFAULT_QUORUM_INSTRUCTIONS (lines 18-27) explicitly names all three MCP tools |
| 14 | npm run build:hooks copies qgsd-stop.js and qgsd-prompt.js to hooks/dist/ | VERIFIED | scripts/build-hooks.js HOOKS_TO_COPY includes both files (lines 16-17); hooks/dist/ contains qgsd-prompt.js and qgsd-stop.js |
| 15 | Installer registers UserPromptSubmit and Stop hooks in ~/.claude/settings.json | VERIFIED | settings.json has UserPromptSubmit hook (qgsd-prompt) and Stop hook (qgsd-stop); verified via node check against live settings.json |
| 16 | CLAUDE.md R4 explicitly names the structural enforcement connection to hooks | VERIFIED | R4 has structural enforcement note: "Structural enforcement note: /gsd:discuss-phase is in the QGSD hook allowlist. The UserPromptSubmit hook injects quorum instructions..." (line 104) |
| 17 | STATE.md Decisions section records META-01/02/03 as structurally satisfied by hooks | VERIFIED | STATE.md line 61 has the META behavior decision entry referencing META-01/02/03 |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/qgsd-stop.js` | Stop hook — quorum verification gate (min 80 lines) | VERIFIED | 211 lines, shebang present, syntactically valid, stdlib only (fs, path, os) |
| `hooks/qgsd-prompt.js` | UserPromptSubmit hook — quorum injection (min 50 lines) | VERIFIED | 75 lines, shebang present, syntactically valid, stdlib only (fs, path, os) |
| `templates/qgsd.json` | Default config template — must contain quorum_commands | VERIFIED | Valid JSON, quorum_commands: 6 entries, required_models for all three prefixes |
| `hooks/qgsd-stop.test.js` | 9-case TDD test suite | VERIFIED | 9/9 tests pass (TC1 through TC9) |
| `scripts/build-hooks.js` | Extended build script including qgsd-stop.js and qgsd-prompt.js | VERIFIED | HOOKS_TO_COPY contains 'qgsd-prompt.js' and 'qgsd-stop.js' (lines 16-17) |
| `bin/install.js` | Extended installer with UserPromptSubmit + Stop registration + qgsd.json write | VERIFIED | All three install blocks present (lines 1580-1613); uninstall blocks present (lines 959-980) |
| `hooks/dist/qgsd-stop.js` | Built stop hook ready for install | VERIFIED | hooks/dist/qgsd-stop.js exists |
| `hooks/dist/qgsd-prompt.js` | Built prompt hook ready for install | VERIFIED | hooks/dist/qgsd-prompt.js exists |
| `~/.claude/hooks/qgsd-stop.js` | Installed Stop hook | VERIFIED | File exists at path |
| `~/.claude/hooks/qgsd-prompt.js` | Installed UserPromptSubmit hook | VERIFIED | File exists at path |
| `~/.claude/qgsd.json` | Installed default config | VERIFIED | File exists at path |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| hooks/qgsd-stop.js | transcript_path JSONL | fs.readFileSync in main() | VERIFIED | Line 161: `const lines = fs.readFileSync(input.transcript_path, 'utf8')` |
| hooks/qgsd-stop.js | templates/qgsd.json schema | loadConfig() with DEFAULT_CONFIG fallback | VERIFIED | Lines 31-40: loadConfig() reads ~/.claude/qgsd.json, returns DEFAULT_CONFIG on failure |
| hooks/qgsd-stop.js | Claude Code Stop event | JSON stdout decision:block + exit 0 | VERIFIED | Line 201: `process.stdout.write(JSON.stringify({ decision: 'block', reason: blockReason }))` |
| hooks/qgsd-prompt.js | Claude Code UserPromptSubmit event | hookSpecificOutput.additionalContext in stdout JSON | VERIFIED | Lines 64-69: `hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: instructions }` |
| hooks/qgsd-prompt.js | templates/qgsd.json | loadConfig() reading ~/.claude/qgsd.json | VERIFIED | Line 33: `const configPath = path.join(os.homedir(), '.claude', 'qgsd.json')` |
| bin/install.js | ~/.claude/settings.json | readSettings() + writeSettings() with UserPromptSubmit and Stop hook entries | VERIFIED | Lines 1582-1603: UserPromptSubmit and Stop blocks; confirmed in live settings.json |
| bin/install.js | templates/qgsd.json | fs.copyFileSync to ~/.claude/qgsd.json if not present | VERIFIED | Lines 1606-1613: existsSync guard + copyFileSync |
| scripts/build-hooks.js | hooks/dist/ | HOOKS_TO_COPY array + fs.copyFileSync loop | VERIFIED | Both qgsd files in HOOKS_TO_COPY; hooks/dist/ contains both files |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STOP-01 | 01-01 | Stop hook reads transcript JSONL for tool_use entries matching configured quorum model names | SATISFIED | findQuorumEvidence() scans content[] for type:tool_use blocks by prefix (lines 102-123); TC5/TC6/TC9 verify |
| STOP-02 | 01-01 | Stop hook checks stop_hook_active flag first — if true, exits 0 immediately | SATISFIED | Line 144: first conditional; TC1 verifies |
| STOP-03 | 01-01 | Stop hook checks hook_event_name — if SubagentStop, exits 0 immediately | SATISFIED | Line 149: second conditional; TC2 verifies |
| STOP-04 | 01-01 | Stop hook scopes transcript search to current turn only | SATISFIED | getCurrentTurnLines() (lines 52-66); TC7 verifies scope filter |
| STOP-05 | 01-01 / 01-06 | Stop hook reads transcript JSONL as authoritative source — no fast-path pre-check (design decision, gap closure Plan 01-06) | SATISFIED | REQUIREMENTS.md revised to match implementation. JSONL-only verification is correct and all 9 tests pass. Design decision recorded in STATE.md. |
| STOP-06 | 01-01 | Stop hook verifies quorum only when a configured planning command was issued in current turn | SATISFIED | hasQuorumCommand() (lines 69-80); TC4 verifies non-planning pass |
| STOP-07 | 01-01 | Stop hook blocks with decision:block JSON when quorum missing — reason includes exact tool names | SATISFIED | Lines 189-202; TC6 asserts decision:block and tool names in reason |
| STOP-08 | 01-01 | Block reason format: "QUORUM REQUIRED: Before completing this /gsd:[command] response, call [tool1], [tool2] with your current plan. Present their responses, then deliver your final output." | SATISFIED | Lines 196-199 match spec format exactly including "QUORUM REQUIRED:" prefix |
| STOP-09 | 01-01 | Stop hook passes (exits 0, no decision field) when quorum evidence found or no planning command in scope | SATISFIED | TC4, TC5, TC7 all verify silent pass; missingKeys.length === 0 check at line 185 |
| UPS-01 | 01-02 | UserPromptSubmit hook detects GSD planning commands via explicit allowlist regex match | SATISFIED | Anchored regex `^\\s*\\/gsd:(cmd1|...)(\s|$)` at line 57; tested against prompt field |
| UPS-02 | 01-02 | Allowlist contains exactly 6 commands: new-project, plan-phase, new-milestone, discuss-phase, verify-work, research-phase | SATISFIED | DEFAULT_QUORUM_COMMANDS (lines 13-16): 6 entries, verified by count |
| UPS-03 | 01-02 | UserPromptSubmit hook injects quorum instructions via hookSpecificOutput.additionalContext | SATISFIED | Lines 64-69; additionalContext key confirmed, not systemMessage |
| UPS-04 | 01-02 | Injected context names the exact MCP tools to call and instructs Claude to present model responses before delivering final output | SATISFIED | DEFAULT_QUORUM_INSTRUCTIONS (lines 18-27) names mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode explicitly |
| UPS-05 | 01-02 | UserPromptSubmit hook never fires on execute-phase or other non-planning commands | SATISFIED | Anchored regex requires /gsd: prefix + exact allowlist match; execute-phase not in list; exit 0 on no match (line 60) |
| META-01 | 01-03 | GSD planning commands within this repo auto-resolve questions via quorum before escalating to user | SATISFIED | /gsd:discuss-phase is in the hook allowlist; hooks enforce quorum before output delivery; STATE.md records this |
| META-02 | 01-03 | Only questions where quorum fails to reach consensus are presented to the user | SATISFIED | CLAUDE.md R4 decision table defines this behavior; hooks enforce it structurally for discuss-phase |
| META-03 | 01-03 | Auto-resolved questions are presented as a list of assumptions before escalated questions | SATISFIED | CLAUDE.md R4 step 5 and structural enforcement note; STATE.md records META behavior decision |

**REQUIREMENTS.md cross-reference:** All 17 Phase 1 requirement IDs (STOP-01 through STOP-09, UPS-01 through UPS-05, META-01 through META-03) are mapped in REQUIREMENTS.md traceability table to Phase 1. Requirements CONF-01 through CONF-05, MCP-01 through MCP-06, INST-01 through INST-07, and SYNC-01 through SYNC-04 are correctly mapped to Phase 2 and Phase 3 — these are not phase 1 requirements and are not evaluated here. No orphaned requirements found for Phase 1.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| hooks/qgsd-prompt.js | 34, 38 | `return null` | Info | loadConfig() intentionally returns null on missing/malformed file; caller handles null with explicit fallback to defaults at line 51. Not a stub — this is the documented design from plan 01-02 key-decisions. |

No blocker anti-patterns found. The `return null` instances are correct implementation of the loadConfig() design pattern (caller-controlled fallback).

---

### Human Verification Required

#### 1. Quorum Injection on Planning Command

**Test:** Start a new Claude Code session (required after settings.json changes). Type `/gsd:plan-phase 1`.
**Expected:** Claude should reference needing to call mcp__codex-cli__review, mcp__gemini-cli__gemini, and mcp__opencode__opencode before delivering planning output. Ask Claude "What instructions did you receive for this command?" — it should describe the quorum requirement.
**Why human:** Hook fires in Claude Code runtime during UserPromptSubmit event. Cannot simulate the full event pipeline programmatically — hooks must be exercised in an actual Claude Code session.

#### 2. Stop Hook Blocks Missing Quorum

**Test:** In a session where MCP servers are unavailable or not configured, run `/gsd:plan-phase 1`. Allow Claude to begin drafting a response without calling the quorum tools.
**Expected:** The Stop hook should intercept and block the response, outputting a message that includes "QUORUM REQUIRED:" and names the missing tool calls.
**Why human:** Requires either disabling MCP servers or a session without them configured. The Stop hook event fires at end-of-turn, which requires the full Claude Code turn lifecycle to execute.

#### 3. Execute-Phase Not Affected

**Test:** In a new Claude Code session, type `/gsd:execute-phase 1`.
**Expected:** Claude should NOT mention quorum. No quorum injection should appear in Claude's context. Claude should proceed to normal execution behavior.
**Why human:** Requires a live session to confirm absence of injection rather than its presence.

---

### Gaps Summary

No gaps. All 17 must-haves verified.

**STOP-05 — Resolved by Plan 01-06 (gap closure)**

The initial verification found that the STOP-05 requirement description promised a `last_assistant_message` fast-path that was not implemented. Multi-model quorum (Claude + Codex + Gemini; OpenCode unavailable) reached consensus to document the omission rather than implement the fast-path: substring matching is not a reliable signal; JSONL parse is synchronous and correct for all transcript sizes. REQUIREMENTS.md was revised to match the implementation. All 9 tests remain passing. Hook source is unmodified.

---

_Verified: 2026-02-20T20:15:00Z_
_Re-verified: 2026-02-20 after gap closure Plan 01-06_
_Verifier: Claude (gsd-verifier / gsd-executor)_
