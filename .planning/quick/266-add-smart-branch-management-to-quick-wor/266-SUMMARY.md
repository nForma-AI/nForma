---
phase: quick-266
plan: 01
subsystem: git-workflow
tags:
  - quick-workflow
  - git-management
  - branch-protection
  - feature-branches
dependency_graph:
  requires: []
  provides:
    - protected branch detection in quick workflow
    - smart branch auto-creation on protected branches
    - --no-branch override flag
  affects:
    - quick workflow execution (core/workflows/quick.md)
    - init quick command (core/bin/gsd-tools.cjs)
    - git config documentation (core/references/planning-config.md)
tech_stack:
  added: []
  patterns:
    - branch detection via git symbolic-ref (no network)
    - glob pattern matching for branch protection
    - config-driven protected branch lists
key_files:
  created: []
  modified:
    - core/bin/gsd-tools.cjs
    - core/workflows/quick.md
    - core/references/planning-config.md
    - core/workflows/settings.md
decisions: []
metrics:
  completed_date: 2026-03-10
  duration: ~15 min
---

# Phase Quick 266 Plan 01: Add smart branch management to quick workflow

**One-liner:** Implement protected branch detection and auto-branch-creation in quick workflow with config-driven protected branch lists and glob pattern support.

## Summary

Added smart branch management to the quick workflow so running `/nf:quick` on a protected branch (main, master, or user-configured) automatically creates a feature branch `nf/quick-{number}-{slug}`, while committing directly on existing feature branches.

### Completed Tasks

#### Task 1: Add branch detection to gsd-tools.cjs and config fields
- Added config defaults: `additional_protected_branches: []` and `quick_branch_template: 'nf/quick-{number}-{slug}'`
- Added config loading for both new fields from `.planning/config.json`
- Added branch detection logic to `cmdInitQuick`:
  - Detects current branch via `git rev-parse --abbrev-ref HEAD`
  - Detects remote default branch via `git symbolic-ref refs/remotes/origin/HEAD` (no network call)
  - Falls back to `['main', 'master']` if remote HEAD unknown
  - Merges default branch with `additional_protected_branches` config
  - Checks branch against protected list with glob pattern support (`*` wildcards)
  - Computes `quick_branch_name` using template when on protected branch
- Added JSON output fields: `current_branch`, `is_protected`, `quick_branch_name`, `protected_branches`

**Verification:** `node core/bin/gsd-tools.cjs init quick "test" --raw` returns JSON with all four new fields. On main branch, `is_protected: true` and `quick_branch_name` follows the template.

#### Task 2: Add branching step to quick workflow and update docs
- Updated Step 1 in quick.md to parse `--no-branch` flag (default: false)
- Updated Step 2 to parse branch detection fields from init JSON
- Added new Step 2.5 with branching logic:
  - Skip branching if `--no-branch` flag set
  - Create branch with `git checkout -b` if on protected branch
  - Report and store `$CREATED_BRANCH` appropriately for later use
- Updated both completion banners (non-full and full-mode) to show branch info and "-> Ready for PR" message
- Updated planning-config.md:
  - Added new fields to config schema JSON
  - Added table rows for `additional_protected_branches` and `quick_branch_template`
  - Added comprehensive `<smart_branching_behavior>` section documenting:
    - Protected branch detection algorithm
    - `--no-branch` escape hatch
    - Template variables and glob support
    - Configuration examples for default, custom branches, and custom naming
- Updated settings.md to mention the new config fields in the quick commands section

#### Task 3: Sync and install updated files
- Synced all modified files to installed locations:
  - `core/workflows/quick.md` → `~/.claude/nf/workflows/quick.md`
  - `core/workflows/settings.md` → `~/.claude/nf/workflows/settings.md`
  - `core/references/planning-config.md` → `~/.claude/nf/references/planning-config.md`
  - `core/bin/gsd-tools.cjs` → `~/.claude/nf/bin/gsd-tools.cjs`
- Ran `node bin/install.js --claude --global` successfully
- Verified installed files match source files (gsd-tools.cjs identical; workflow files have expected path expansion)
- Tested installed gsd-tools: returns branch detection fields correctly

## Deviations from Plan

None - plan executed exactly as written.

## Key Implementation Details

**Branch Detection Algorithm:**
1. Reads current branch via git (fallback to 'unknown')
2. Reads remote HEAD ref locally (no network call needed)
3. Uses remote HEAD if available, falls back to ['main', 'master']
4. Merges in `additional_protected_branches` from config
5. Tests current branch against protected list with glob pattern support

**Template Variable Handling:**
- `{number}` → replaced with `String(nextNum)` (task counter)
- `{slug}` → replaced with task description slug or 'task' fallback

**Config Integration:**
- Both new config fields default safely in loadConfig
- Accessed via section-based get() pattern matching existing code
- No breaking changes to existing config structure

## Testing & Verification

All verification checks from plan pass:
- Branch detection works via git symbolic-ref with fallback
- Config supports glob patterns (tested pattern matching logic)
- Quick workflow parses --no-branch flag
- Completion banners show branch info
- All files synced and installed
- Installed gsd-tools returns branch detection fields from init quick

## Success Criteria Met

- Protected branch detection works via `git symbolic-ref` (no network) with fallback to main/master ✓
- Config supports `git.additional_protected_branches` array with glob patterns ✓
- Quick workflow auto-creates branch on protected branches, skips on feature branches ✓
- `--no-branch` flag overrides branch creation ✓
- Completion banner shows branch info ✓
- All files synced and installed ✓
