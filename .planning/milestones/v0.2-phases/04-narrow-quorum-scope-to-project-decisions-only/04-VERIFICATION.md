---
phase: 04-narrow-quorum-scope-to-project-decisions-only
verified: 2026-02-20T23:13:26Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 4: Narrow Quorum Scope to Project Decisions Only — Verification Report

**Phase Goal:** Stop hook only fires quorum on turns where Claude delivers a project decision (plan, roadmap, research, verification report) — not on intermediate GSD-internal operations (agent spawning, routing, questioning, status messages)
**Verified:** 2026-02-20T23:13:26Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Derived from SCOPE-01 through SCOPE-07 (phase requirements defined in 04-RESEARCH.md; not in REQUIREMENTS.md — confirmed by grep; phase was added post-roadmap with no pre-assigned IDs).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Intermediate GSD-internal operation turns (no artifact commit, no marker) pass without quorum block | VERIFIED | TC14 (agent spawn), TC17 (routing/questioning) both pass; GUARD 5 exits 0 on non-decision turns |
| 2 | Final plan-phase turn with PLAN.md artifact committed triggers quorum enforcement | VERIFIED | TC15 blocks with `decision:block`; `hasArtifactCommit()` finds `gsd-tools.cjs commit` + `-PLAN.md` in same Bash block |
| 3 | Codebase mapping artifact commits do not trigger quorum | VERIFIED | TC16 passes; `codebase/STACK.md` does not match any `ARTIFACT_PATTERNS` entry |
| 4 | Decision marker `<!-- GSD_DECISION -->` in last assistant text block triggers quorum enforcement | VERIFIED | TC19 blocks; `hasDecisionMarker()` reverse-scans last assistant entry for `DECISION_MARKER` constant |
| 5 | discuss-phase final turn with CONTEXT.md commit triggers quorum enforcement | VERIFIED | TC18 blocks; `-CONTEXT.md` pattern in `ARTIFACT_PATTERNS` matches |
| 6 | UserPromptSubmit hook injects decision marker instruction into quorum context | VERIFIED | `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` step 5 in `qgsd-prompt.js` contains exact token `<!-- GSD_DECISION -->` |
| 7 | All 19 test cases pass (TC1-TC13 preserved/updated + TC14-TC19 new) | VERIFIED | `node --test hooks/qgsd-stop.test.js` exits 0: 19 pass, 0 fail |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `hooks/qgsd-stop.js` | `hasArtifactCommit()` function | VERIFIED | Lines 156-174; requires BOTH `gsd-tools.cjs commit` AND `ARTIFACT_PATTERNS` match in same Bash block |
| `hooks/qgsd-stop.js` | `hasDecisionMarker()` function | VERIFIED | Lines 182-198; reverse scan, breaks on first assistant entry found |
| `hooks/qgsd-stop.js` | `ARTIFACT_PATTERNS` constant | VERIFIED | Lines 142-150; 7 patterns: `-PLAN.md`, `-RESEARCH.md`, `-CONTEXT.md`, `-UAT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md` |
| `hooks/qgsd-stop.js` | `DECISION_MARKER` constant at module level | VERIFIED | Line 178: `const DECISION_MARKER = '<!-- GSD_DECISION -->';` |
| `hooks/qgsd-stop.js` | `isDecisionTurn` GUARD 5 wired in `main()` after GUARD 4 | VERIFIED | Lines 251-257; placed immediately after GUARD 4 `hasQuorumCommand` check |
| `hooks/qgsd-stop.test.js` | `bashCommitBlock()` helper | VERIFIED | Lines 81-83 |
| `hooks/qgsd-stop.test.js` | TC14-TC19 new test cases | VERIFIED | Lines 511-657; all 6 covering new signal paths |
| `hooks/qgsd-stop.test.js` | TC6/TC9/TC12 updated (step 1a) | VERIFIED | TC6 line 188, TC9 line 273, TC12 line 425 — all include `bashCommitBlock()` with artifact commit |
| `hooks/qgsd-prompt.js` | `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` step 5 with `<!-- GSD_DECISION -->` | VERIFIED | Line 18; token appears exactly once; scoped to FINAL output only |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `qgsd-stop.js` `main()` | `hasArtifactCommit()` + `hasDecisionMarker()` | `isDecisionTurn` computation at line 254 | WIRED | `const isDecisionTurn = hasArtifactCommit(currentTurnLines) || hasDecisionMarker(currentTurnLines);` — both called |
| `qgsd-stop.js` `hasArtifactCommit()` | `gsd-tools.cjs commit` detection | `cmdStr.includes('gsd-tools.cjs commit')` at line 168 | WIRED | Both conditions (gsd-tools.cjs commit AND artifact pattern) must hold in same Bash block |
| `qgsd-stop.js` `hasArtifactCommit()` | `ARTIFACT_PATTERNS` | `ARTIFACT_PATTERNS.some(p => p.test(cmdStr))` at line 169 | WIRED | Pattern array defined at module level, referenced correctly |
| `qgsd-stop.js` `hasDecisionMarker()` | `DECISION_MARKER` constant | `block.text.includes(DECISION_MARKER)` at line 191 | WIRED | Module-level constant used in both detection and comment |
| `qgsd-prompt.js` | `DECISION_MARKER` token value | Identical string `<!-- GSD_DECISION -->` in step 5 injection | WIRED | Same token value in both files; no separate import (both are standalone scripts) |
| GUARD 5 | GUARD 4 ordering | GUARD 5 block at lines 251-257 follows GUARD 4 block at lines 246-249 | WIRED | Ordering preserved: GUARD 4 (command filter) gates before GUARD 5 (decision turn filter) |

---

### Requirements Coverage

SCOPE-01 through SCOPE-07 are derived requirements defined in `04-RESEARCH.md` under `<phase_requirements>`. They do NOT appear in `.planning/REQUIREMENTS.md` — the research explicitly notes "This phase has no pre-assigned requirement IDs in REQUIREMENTS.md." No ORPHANED requirements exist because the REQUIREMENTS.md traceability table does not map any IDs to Phase 4.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCOPE-01 | 04-01-PLAN.md | Stop hook passes on GSD-internal operation turns | SATISFIED | TC14, TC17 pass; GUARD 5 exits 0 when no artifact commit and no marker present |
| SCOPE-02 | 04-01-PLAN.md | Stop hook enforces quorum when planning artifact committed | SATISFIED | TC15 blocks on PLAN.md commit; TC18 blocks on CONTEXT.md commit; `hasArtifactCommit()` implemented with correct dual-condition check |
| SCOPE-03 | 04-01-PLAN.md | Stop hook enforces quorum when decision marker present | SATISFIED | TC19 blocks on `<!-- GSD_DECISION -->` in last assistant text block; `hasDecisionMarker()` implemented with correct reverse scan |
| SCOPE-04 | 04-02-PLAN.md | UserPromptSubmit hook injects decision marker instruction | SATISFIED | `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` step 5 contains exact token `<!-- GSD_DECISION -->` with FINAL-output-only scoping |
| SCOPE-05 | 04-01-PLAN.md | Artifact patterns must not match codebase mapping artifacts | SATISFIED | TC16 passes; `codebase/STACK.md` does not match any of the 7 `ARTIFACT_PATTERNS` entries |
| SCOPE-06 | 04-01-PLAN.md | All 13 existing test cases continue to pass | SATISFIED | 19/19 tests pass including TC1-TC13; TC6/TC9/TC12 updated with step 1a artifact signals |
| SCOPE-07 | 04-01-PLAN.md | New test cases cover all required scenarios | SATISFIED | TC14 (intermediate pass), TC15 (PLAN.md block), TC16 (codebase pass), TC17 (routing pass), TC18 (CONTEXT.md block), TC19 (marker block) — all present and passing |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `hooks/qgsd-stop.js` | 129, 136 | `return null` | INFO | Intentional: `getAvailableMcpPrefixes()` returns null when `~/.claude.json` is missing or unreadable — callers treat null conservatively. Not a stub. |

No blocking anti-patterns. No TODO/FIXME/placeholder comments. No empty implementations in modified files.

---

### Warnings (Non-Blocking)

**W1: TC5, TC8, TC10, TC11, TC13 now pass vacuously via GUARD 5**

These test cases assert `stdout=""` and `exitCode=0`, which is still correct behavior. However, they no longer exercise their originally-intended code paths:

- TC5 ("all 3 quorum calls present → pass"): now exits at GUARD 5 (no artifact commit, no marker) before reaching `findQuorumEvidence()`
- TC8 ("malformed JSONL skipped gracefully"): same situation — exits at GUARD 5
- TC10 ("quorum calls interleaved with tool_result messages"): same — the getCurrentTurnLines() boundary logic is no longer exercised by this test case in its current form
- TC11 ("unavailable model → fail-open pass"): exits at GUARD 5; the MCP availability check is not reached
- TC13 ("renamed prefix matched correctly"): exits at GUARD 5; the prefix matching logic is not reached

The observable behavior remains correct (all assert pass = stdout empty, exitCode 0). But the tests no longer validate their stated behavioral properties. This is a semantic drift in the test suite — the tests pass vacuously rather than by exercising their intended logic.

**Impact:** Low. The code paths being "skipped" (quorum evidence scanning, MCP availability detection, prefix matching) ARE still exercised by TC6, TC9, TC12, TC15, TC18. The gap is that the "pass when quorum complete" path (TC5) is no longer structurally tested with a decision turn that actually needs quorum.

**W2: ROADMAP.md plan checkboxes show unchecked**

The ROADMAP.md shows `- [ ] 04-01-PLAN.md` and `- [ ] 04-02-PLAN.md` (unchecked) despite the text above saying "2/2 plans complete". STATE.md correctly records Phase 4 as complete. This is a minor documentation inconsistency with no functional impact.

---

### Human Verification Required

None. All goal-relevant behaviors are verifiable via the test suite and code inspection. The decision marker injection (`<!-- GSD_DECISION -->`) is behavioral (relies on Claude including the token in its output), but the structural enforcement path (artifact commit detection) does not depend on it — the marker is a backstop only.

---

### Gaps Summary

No gaps. Phase goal is fully achieved:

- GUARD 5 is implemented in `qgsd-stop.js` with correct two-signal detection
- All 7 `ARTIFACT_PATTERNS` are defined and match the plan specification
- Both `hasArtifactCommit()` and `hasDecisionMarker()` are implemented and wired
- `DECISION_MARKER` constant is defined at module level and used consistently
- `qgsd-prompt.js` injects the decision marker instruction in step 5
- All 19 test cases pass; commits 8f9f699, e3efbb0, 07e78df all verified in git history
- SCOPE-01 through SCOPE-07 all satisfied

The two warnings (W1, W2) are non-blocking: W1 is a test semantic drift that could be addressed in a future maintenance pass; W2 is a documentation state tracking inconsistency with no functional consequence.

---

_Verified: 2026-02-20T23:13:26Z_
_Verifier: Claude (gsd-verifier)_
