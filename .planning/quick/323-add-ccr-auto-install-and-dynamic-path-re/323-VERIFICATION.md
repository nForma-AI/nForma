---
phase: quick-323
plan: 01
verified: 2026-03-18T18:29:00Z
status: passed
score: 4/4 must-haves verified
formal_check:
  passed: 0
  failed: 0
  skipped: 0
  note: "No TLA+ model for installer module — formal check skipped per invariants.md"
---

# Quick Task 323: Add CCR Auto-Install and Dynamic Path Resolution Verification Report

**Task Goal:** Add CCR auto-install and dynamic path resolution: detect if `ccr` binary is available, offer `npm install -g @musistudio/claude-code-router` if missing when CCR slots are selected, and replace hardcoded `/opt/homebrew/bin/ccr` paths in providers.json with dynamic resolution via resolveCli.

**Verified:** 2026-03-18T18:29:00Z
**Status:** PASSED
**Score:** 4/4 must-haves verified

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CCR slots (claude-1..6) in providers.json use bare 'ccr' as cli value, not a hardcoded Homebrew path | ✓ VERIFIED | All 6 CCR providers tested: `cli === 'ccr'` for claude-1, claude-2, claude-3, claude-4, claude-5, claude-6. Verified via `node` evaluation and direct JSON inspection |
| 2 | When ccr is not installed and a CCR slot is selected, install.js warns with the npm install command | ✓ VERIFIED | Warning code exists at lines 3237-3244: checks `detectCcrCli().found`, outputs hint from `CLI_INSTALL_HINTS['ccr']` with message `⚠ ccr not found — claude-1..6 slots require it. Install: npm install -g @musistudio/claude-code-router` |
| 3 | resolveCli('ccr') is called at dispatch time for CCR providers, resolving the actual path dynamically | ✓ VERIFIED | call-quorum-slot.cjs line ~310: extracts bare name via `provider.cli.split('/').pop()`, calls `resolveCli(bareName)` for dynamic resolution. Bare names work correctly because resolveCli handles bare input |
| 4 | CCR hint appears in CLI_INSTALL_HINTS so the promptProviders display is consistent with other providers | ✓ VERIFIED | CLI_INSTALL_HINTS at line 18-24 includes `ccr: 'npm install -g @musistudio/claude-code-router'`. promptProviders() uses hint at line 2881 for non-found external providers display |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/providers.json` | CCR provider definitions with bare cli values | ✓ VERIFIED | All 6 CCR providers (claude-1..6) have `"cli": "ccr"` (bare name). Commit 5caa148d confirms replacement of 6 hardcoded paths. JSON is syntactically valid. |
| `bin/install.js` | CCR detection + install hint | ✓ VERIFIED | `CLI_INSTALL_HINTS.ccr` defined at line 23. `detectCcrCli()` function at lines 298-303. Warning at lines 3238-3243. Module exports do not include `detectCcrCli` (internal-only). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bin/install.js classifyProviders()` | `providers.json ccr slots` | `path.basename(p.cli) === 'ccr'` | ✓ WIRED | Tested: classifyProviders identifies all 6 CCR slots correctly from bare 'ccr' name. `path.basename('ccr')` returns 'ccr', so pattern matches perfectly. |
| `bin/call-quorum-slot.cjs runSubprocess()` | `resolveCli('ccr')` | `provider.cli.split('/').pop() -> bareName -> resolveCli(bareName)` | ✓ WIRED | call-quorum-slot.cjs line 309-310: extracts bareName from provider.cli, passes to resolveCli(). Dynamic resolution chain complete. |
| `bin/install.js detectCcrCli()` | `CLI_INSTALL_HINTS['ccr']` | Called at line 3239, hint used at line 3241 | ✓ WIRED | Function returns status, hint is accessed and output correctly in warning message. No orphaned producer. |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| XPLAT-01 | CCR slots use bare cli value enabling dynamic path resolution | ✓ SATISFIED | bare 'ccr' in providers.json + resolveCli() at dispatch time makes config path-agnostic (macOS/Linux compatible). Fixes hardcoded `/opt/homebrew/bin/ccr` issue. |

### Anti-Patterns Found

**None detected.** All code is substantive:
- `detectCcrCli()` function performs real work (calls resolveCli, compares result)
- CLI_INSTALL_HINTS entry provides actionable command
- Warning is properly guarded and only appears when needed
- No TODO/FIXME comments, console.log-only stubs, or empty handlers

### Formal Verification

**Status: TOOLING ABSENT (SKIP)**

Formal check result reports `passed: 0, failed: 0, skipped: 0` because no TLA+ model exists for the installer module. Per `.planning/formal/spec/installer/invariants.md`, the installer formal spec only covers `OverridesPreserved` (a liveness fairness property). This quick task modifies provider definitions and add detection logic — neither of which relate to project overrides preservation.

**No formal scope matched for this task.** This is a tooling gap, not a failure. The code changes are substantive and all manual verification checks pass.

### Execution Summary

**Changes Made:**
- Commit 5caa148d: `feat(quick-323): Add CCR auto-install detection and dynamic path resolution`
  - Modified: `bin/providers.json` (6 entries: replaced `"cli": "/opt/homebrew/bin/ccr"` with `"cli": "ccr"`)
  - Modified: `bin/install.js` (added detectCcrCli function, CLI_INSTALL_HINTS entry, warning logic)

**Plan Compliance:** 100% — all 2 tasks completed exactly as specified.
- Task 1: ✓ All 6 hardcoded paths replaced with bare 'ccr'
- Task 2: ✓ CLI_INSTALL_HINTS entry added, detectCcrCli() function added, warning placed correctly in non-interactive default Claude path

**Success Criteria:** All 5 met
1. ✓ All 6 CCR provider entries in providers.json use `"cli": "ccr"` (bare name)
2. ✓ install.js `CLI_INSTALL_HINTS` includes `ccr: 'npm install -g @musistudio/claude-code-router'`
3. ✓ `detectCcrCli()` function added, called only in the non-interactive default Claude path immediately after CCR slot selection, gated on `selectedProviderSlots.length > 0` — NOT in promptProviders() or provider detection loop
4. ✓ classifyProviders() correctly identifies CCR slots via `path.basename(p.cli) === 'ccr'`
5. ✓ No tests broken (lint-isolation + hooks-sync verified in SUMMARY)

---

**Verified:** 2026-03-18T18:29:00Z
**Verifier:** Claude Code (nf-verifier)
**Verification Method:** Goal-backward: verified observable truths, artifact existence/substantiveness/wiring, key links, and formal invariant scope
