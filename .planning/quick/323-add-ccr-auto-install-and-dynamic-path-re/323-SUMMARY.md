---
phase: quick-323
plan: 01
type: execute
completed: 2026-03-18
duration: "~8 minutes"
tasks: 2
files_modified: 2
commits: 1
tests_passed: 100% (lint + hooks-sync verified)
---

# Quick Task 323: Add CCR Auto-Install and Dynamic Path Resolution Summary

**Objective:** Replace hardcoded `/opt/homebrew/bin/ccr` paths with bare `ccr` to enable dynamic path resolution, making the configuration macOS/Linux path-agnostic. Add availability detection with install hint when CCR is missing.

## Completed Tasks

| # | Task | Status | Changes |
|----|------|--------|---------|
| 1 | Replace hardcoded ccr paths in providers.json | ✓ Complete | 6 provider entries (claude-1..6): `"cli": "/opt/homebrew/bin/ccr"` → `"cli": "ccr"` |
| 2 | Add CCR detection and warning in install.js | ✓ Complete | Added `detectCcrCli()` function, CCR to `CLI_INSTALL_HINTS`, warning in non-interactive default Claude path |

## Key Changes

### bin/providers.json
- Replaced all 6 hardcoded CCR paths with bare `"ccr"` name
- Entries modified: claude-1, claude-2, claude-3, claude-4, claude-5, claude-6
- Pattern: `path.basename(p.cli) === 'ccr'` still works with bare name (basename of 'ccr' is 'ccr')

### bin/install.js
- Added CCR to `CLI_INSTALL_HINTS`: `'npm install -g @musistudio/claude-code-router'`
- Added `detectCcrCli()` function (internal only, not exported)
  - Returns `{ found: boolean, resolvedPath: string|null }`
  - Uses `resolveCli('ccr')` for dynamic path lookup
- Added warning in non-interactive default Claude path (line ~3240)
  - Guarded on `selectedProviderSlots.length > 0 && !detectCcrCli().found`
  - Message: `⚠ ccr not found — claude-1..6 slots require it. Install: npm install -g @musistudio/claude-code-router`
  - NOT placed in `promptProviders()` or provider detection loop (CCR slots never selected interactively)

## Architecture

**Dynamic Path Resolution Flow:**
1. `bin/providers.json` defines CCR slots with bare CLI name: `"cli": "ccr"`
2. `bin/call-quorum-slot.cjs` at dispatch time (line ~310):
   - Extracts bare name: `const bareName = provider.cli.split('/').pop()`
   - Calls `resolveCli(bareName)` to find actual path
   - Returns resolved path or bare name as fallback
3. `bin/resolve-cli.cjs` implements priority search:
   - `which ccr` → Homebrew prefixes → npm global bin → system paths → bare fallback

**Why This Works:**
- Previous hardcoded path broke on non-standard macOS installs and all Linux systems
- Bare name + `resolveCli()` makes config portable and distribution-agnostic
- `resolveCli()` is already called at dispatch time, no new performance cost

## Verification

All success criteria met:
- ✓ All 6 CCR provider entries use `"cli": "ccr"` (bare name)
- ✓ `CLI_INSTALL_HINTS` includes `ccr: 'npm install -g @musistudio/claude-code-router'`
- ✓ `detectCcrCli()` function added, called only in non-interactive default path
- ✓ Warning gated on `selectedProviderSlots.length > 0` (no false positives)
- ✓ `detectCcrCli` not exported (install.js-internal only)
- ✓ `classifyProviders()` continues to identify CCR slots via `path.basename(p.cli) === 'ccr'`
- ✓ Lint checks pass (lint-isolation + hooks-sync verified)

## Commit

**Commit:** `5caa148d` — feat(quick-323): Add CCR auto-install detection and dynamic path resolution
- Modified: `bin/providers.json`, `bin/install.js`
- Key files: CCR provider definitions with bare cli values; auto-detection + install hint in install script

## Requirements Met

- **XPLAT-01:** CCR slots now use bare `ccr` for dynamic resolution at dispatch time ✓

## Deviations

None — plan executed exactly as specified.
