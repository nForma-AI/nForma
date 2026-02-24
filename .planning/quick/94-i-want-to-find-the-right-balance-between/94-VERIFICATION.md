---
phase: quick-94
verified: 2026-02-24T10:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run addAgent() flow end-to-end, enter an API key, then open ~/.claude.json and confirm ANTHROPIC_API_KEY is absent from the new agent's env block"
    expected: "The env block for the new agent has no ANTHROPIC_API_KEY field; key is stored only in the OS keychain"
    why_human: "Cannot read ~/.claude.json at test time without a live keytar-capable environment; programmatic check would require running an interactive prompt"
  - test: "Set PROVIDER_SLOT=claude-1, run unified-mcp-server.mjs, observe stderr for keytar bootstrap log"
    expected: "Either 'Loaded API key for slot claude-1 from keychain' or 'keytar unavailable' — server does not crash"
    why_human: "Requires a running process with a live keychain to fully validate the one-prompt-per-process guarantee"
---

# Phase quick-94: Keytar API Key Security Verification Report

**Phase Goal:** Find the right balance between user convenience and security — move API keys from plaintext ~/.claude.json env blocks to OS keychain (keytar), with one keychain unlock per MCP server process lifetime and graceful fallback.

**Verified:** 2026-02-24T10:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | API keys are NOT written as plaintext in ~/.claude.json env blocks | VERIFIED | `addAgent()` line 372–378: calls `secretsLib.set()` only; `editAgent()` apply block lines 755 and 751: `delete newEnv.ANTHROPIC_API_KEY` before writing |
| 2 | unified-mcp-server reads each slot's API key from keytar at startup — one OS prompt per server process, never repeated | VERIFIED | `async function main()` lines 692–705: checks `SLOT && !process.env.ANTHROPIC_API_KEY`, calls `keytar.getPassword('qgsd', keytarAccount)` once at startup, sets `process.env.ANTHROPIC_API_KEY` in-process for reuse |
| 3 | manage-agents editAgent() key display, probe, and hasKey checks use keytar index or live keytar read — not env.ANTHROPIC_API_KEY | VERIFIED | `keytarKey` loaded at line 481 via `secretsLib.get()`; `displayKey = keytarKey || env.ANTHROPIC_API_KEY || null` line 484; used in display (line 498), field chooser (line 540), hasKey (line 625), probe (line 671) |
| 4 | addAgent() saves key to keytar only — does not write plaintext key to ~/.claude.json | VERIFIED | Lines 372–378: `if (answers.apiKey.trim() && secretsLib) { await secretsLib.set(...) }` — plaintext env write only in the `else if` (keytar unavailable) fallback branch |
| 5 | Removing a key in manage-agents removes it from both keytar and the ~/.claude.json env block (no stale plaintext) | VERIFIED | editAgent() `__REMOVE__` branch lines 750–752: `delete newEnv.ANTHROPIC_API_KEY` + `secretsLib.delete('qgsd', keytarAccount).catch(() => {})` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/unified-mcp-server.mjs` | MCP server with keytar-based API key loading at process startup | VERIFIED | 729-line file; `async function main()` at line 687 wraps readline setup; keytar bootstrap at lines 692–705; commits 4f91391 confirmed |
| `bin/manage-agents.cjs` | Agent manager that stores keys only in keytar, not ~/.claude.json | VERIFIED | 1325-line file; addAgent() secretsLib at line 304–305; editAgent() keytarKey/displayKey at lines 477–484; apply block at lines 749–763; commits dc5ba85 confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bin/manage-agents.cjs addAgent()` | `secrets.cjs set()` | `secretsLib.set('qgsd', keytarAccount, ...)` | WIRED | Line 374: `await secretsLib.set('qgsd', keytarAccount, answers.apiKey.trim())` — exact pattern from plan matched |
| `bin/unified-mcp-server.mjs startup` | keytar | `keytar.getPassword` at process start | WIRED | Line 695–696: `const { default: keytar } = await import('keytar'); const secret = await keytar.getPassword('qgsd', keytarAccount)` — runs inside `main()` before readline starts |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-94 | 94-PLAN.md | API keys stored in OS keychain only, not plaintext in ~/.claude.json | SATISFIED | Both files modified; keytar bootstrap in server; addAgent/editAgent use secretsLib.set(); delete plaintext on set/remove |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bin/manage-agents.cjs` | 929 | `removeAgent()` selector uses `secretsLib.hasKey(account)` for display but `removeAgent()` body (lines 833–837) does NOT call `secretsLib.delete()` when an agent is fully removed | Warning | Stale keytar entries persist after `removeAgent()` — keys accumulate in keychain but are unreachable; not a security risk but creates keychain clutter |
| `bin/manage-agents.cjs` | 566 | `fetchProviderModels()` at line 566 still passes `env.ANTHROPIC_API_KEY` to the model fetch — this reads the legacy env key, not keytar | Info | Model list fetch during editAgent() "change model" flow may fail to authenticate if key is keytar-only; does not expose a plaintext key |

### Human Verification Required

#### 1. addAgent() plaintext-free write

**Test:** Run `node bin/manage-agents.cjs`, choose "Add agent", enter a slot name and an API key, exit, then run `cat ~/.claude.json | python3 -m json.tool | grep -A5 "<slotname>"` to inspect the env block.
**Expected:** The env block contains no `ANTHROPIC_API_KEY` field. Key is stored only in the OS keychain.
**Why human:** Requires an interactive terminal and a live keytar-capable macOS environment; cannot be verified programmatically in this context.

#### 2. unified-mcp-server one-prompt-per-process guarantee

**Test:** Run `PROVIDER_SLOT=claude-1 node bin/unified-mcp-server.mjs` in a terminal and observe stderr.
**Expected:** Exactly one of: `[unified-mcp-server] Loaded API key for slot claude-1 from keychain` or `[unified-mcp-server] keytar unavailable for slot claude-1: ...` — then `[unified-mcp-server] started [slot: claude-1]`. No crash. No repeated keychain prompts during tool calls.
**Why human:** Requires a running process and a keychain entry; the no-repeated-prompts guarantee is behavioral and cannot be verified statically.

### Gaps Summary

No blocking gaps. All five observable truths are verified against actual code. Both commits (4f91391, dc5ba85) exist and match the declared file changes.

Two non-blocking observations:

1. `removeAgent()` does not call `secretsLib.delete()` when an agent entry is removed from ~/.claude.json — keytar entries for removed agents persist. The plan mentioned fixing `removeAgent()` display (using `secretsLib.hasKey()`), which was done (line 929). The actual key deletion on full agent removal was not in the plan's explicit task steps and is not one of the five must-have truths. This is a known incomplete edge: stale keychain entries accumulate but cause no security or functional harm.

2. `fetchProviderModels()` (called during model selection in `editAgent()`) still reads `env.ANTHROPIC_API_KEY` instead of keytar. This means the model list fetch for the "change model" flow may fail to authenticate if the key has been migrated to keytar-only. Not a security issue; does not write plaintext.

Both observations are candidates for a follow-up quick task.

---

_Verified: 2026-02-24T10:15:00Z_
_Verifier: Claude (qgsd-verifier)_
