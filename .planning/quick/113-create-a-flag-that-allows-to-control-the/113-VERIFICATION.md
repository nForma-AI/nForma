---
phase: quick-113
verified: 2026-02-27T00:45:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Quick Task 113: --n N quorum size flag Verification Report

**Task Goal:** Create a flag that allows controlling the number of max members in the quorum, such as `--n 3` or `--n 1` (where it would be only Claude then, no need of quorum).
**Verified:** 2026-02-27T00:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `/qgsd:plan-phase --n 3` caps quorum at 3 external slot-workers | VERIFIED | Smoke test output: `QUORUM SIZE OVERRIDE (--n 3): Cap at 3 total participants — Claude + 2 external slots`; step list contains exactly 2 slots (codex-1, gemini-1) |
| 2 | Running `/qgsd:quick --n 1` runs self-quorum only (Claude alone), skipping all external slot dispatches | VERIFIED | Smoke test output: `QGSD_SOLO_MODE` + `SOLO MODE ACTIVE (--n 1): Self-quorum only. Skip ALL external slot-worker Task dispatches.`; no Task() step lines in output |
| 3 | The stop hook does not block when `--n 1` is detected in the command | VERIFIED | `qgsd-stop.js` lines 456-470: `soloMode = quorumSizeOverride === 1`; GUARD 6 calls `process.exit(0)` before any agent-pool evaluation; conformance event logged with `outcome: APPROVE` |
| 4 | The stop hook enforces a ceiling of N-1 external models when `--n N` (N>1) is detected | VERIFIED | `qgsd-stop.js` lines 486-490: `maxSize = quorumSizeOverride - 1` when `quorumSizeOverride > 1`; comment: `--n N means N-1 external models required` |
| 5 | Commands without `--n N` behave identically to today (maxSize from qgsd.json) | VERIFIED | Smoke test with no flag returns standard full-slot `QUORUM REQUIRED` text with config-driven maxSize (3) and all 11 slots enumerated; no override text injected |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/qgsd-prompt.js` | `parseQuorumSizeFlag` + maxSize override injection | VERIFIED | Function at line 108; called at line 172; solo mode branch at line 182; externalSlotCap + cappedSlots cap at line 210-211 |
| `hooks/qgsd-stop.js` | `parseQuorumSizeFlag` + solo bypass (GUARD 6) + N-1 ceiling | VERIFIED | Function at line 366; `extractPromptText` at line 375; GUARD 6 at lines 458-470; maxSize override at lines 486-490 |
| `hooks/dist/qgsd-prompt.js` | Synced dist copy for installer | VERIFIED | `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` produces no output |
| `hooks/dist/qgsd-stop.js` | Synced dist copy for installer | VERIFIED | `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` produces no output |

All four artifacts: exist, substantive, wired.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks/qgsd-prompt.js` | quorum instructions injected into Claude context | `additionalContext` field containing `SOLO MODE` or `QUORUM SIZE OVERRIDE` | WIRED | Smoke tests confirm `additionalContext` populated correctly for both `--n 1` and `--n 3` |
| `hooks/qgsd-stop.js` | quorum enforcement ceiling | `parseQuorumSizeFlag` on transcript prompt text | WIRED | `extractPromptText(currentTurnLines)` called at line 454, result passed to `parseQuorumSizeFlag`, `soloMode` and `maxSize` derived; GUARD 6 fires before pool evaluation |

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments. No empty or stub implementations. All functions contain full logic.

---

### Installed Hooks

| File | Size | Modified | Matches Dist |
|------|------|----------|--------------|
| `~/.claude/hooks/qgsd-prompt.js` | 15,103 bytes | 2026-02-27 00:20 | YES |
| `~/.claude/hooks/qgsd-stop.js` | 22,728 bytes | 2026-02-27 00:20 | YES |

---

### Commits Verified

| Commit | Message |
|--------|---------|
| `f2ec34c` | feat(quick-113): add parseQuorumSizeFlag and --n N override to qgsd-prompt.js |
| `00920b5` | feat(quick-113): add solo mode bypass and N-1 ceiling to qgsd-stop.js, sync dist |

Both commits confirmed present in `git log`.

---

### Smoke Test Results

**Test 1: `--n 1` solo mode**
Input: `{"prompt":"/qgsd:quick --n 1","cwd":"/tmp","session_id":"x"}`
Result: `additionalContext` starts with `<!-- QGSD_SOLO_MODE -->`, contains `SOLO MODE ACTIVE (--n 1)`, no Task() step lines. PASS.

**Test 2: `--n 3` size cap**
Input: `{"prompt":"/qgsd:plan-phase --n 3","cwd":"/tmp","session_id":"x"}`
Result: `additionalContext` contains `QUORUM SIZE OVERRIDE (--n 3): Cap at 3 total participants — Claude + 2 external slots` and exactly 2 Task() lines (codex-1, gemini-1). PASS.

**Test 3: No flag (baseline)**
Input: `{"prompt":"/qgsd:quick","cwd":"/tmp","session_id":"x"}`
Result: Standard `QUORUM REQUIRED` text with hard ceiling from config, all 11 active slots listed, no override text. PASS.

---

### Human Verification Required

None. All goal-relevant behavior is verifiable via code inspection and hook smoke tests.

---

## Summary

The task goal is fully achieved. The `--n N` flag is implemented end-to-end:

- `--n 1` triggers solo mode in the prompt hook (injects `QGSD_SOLO_MODE` marker, no slot steps) and bypasses external model enforcement in the stop hook (GUARD 6, exits 0 immediately after `isDecisionTurn` check).
- `--n N` (N > 1) caps the prompt hook's step list to N-1 external slots with an override note, and overrides `maxSize` in the stop hook to `N-1`.
- No `--n` flag leaves both hooks completely unchanged from pre-task behavior.
- Source, dist, and installed copies are all identical.
- Both hooks pass syntax validation.

---

_Verified: 2026-02-27T00:45:00Z_
_Verifier: Claude (qgsd-verifier)_
