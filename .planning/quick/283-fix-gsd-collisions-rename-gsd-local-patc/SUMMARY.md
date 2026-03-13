---
phase: quick-283
plan: 283
subsystem: hooks/installer
tags: [rebrand, rename, hooks, install]
dependency_graph:
  requires: []
  provides: [nf-context-monitor-hook, nf-local-patches-dir]
  affects: [hooks/config-loader.js, bin/install.js, commands/nf/reapply-patches.md]
tech_stack:
  added: []
  patterns: [OLD_HOOK_MAP migration cleanup]
key_files:
  created:
    - hooks/nf-context-monitor.js
    - hooks/nf-context-monitor.test.js
  modified:
    - hooks/config-loader.js
    - bin/install.js
    - commands/nf/reapply-patches.md
decisions:
  - "Added gsd-context-monitor to OLD_HOOK_MAP PostToolUse array for migration cleanup of existing installs"
metrics:
  duration: ~3min
  completed: 2026-03-12
---

# Quick 283: Fix GSD Collisions -- Rename gsd-local-patches and gsd-context-monitor

Completed rebrand of last two GSD-prefixed identifiers (gsd-context-monitor hook, gsd-local-patches directory constant) to nf- prefix with OLD_HOOK_MAP migration entry for existing installs.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Rename gsd-context-monitor files and update internal references | 26901d26 | hooks/nf-context-monitor.js, hooks/nf-context-monitor.test.js, hooks/config-loader.js |
| 2 | Update install.js references, add migration entry, rename patches constant | 7f03a5af | bin/install.js, commands/nf/reapply-patches.md |
| 3 | Sync dist and run installer | (no-op, verified) | hooks/dist/* synced, installer propagated |

## What Changed

1. **Hook file rename**: `hooks/gsd-context-monitor.js` -> `hooks/nf-context-monitor.js` (and corresponding test file)
2. **Internal string references**: All `gsd-context-monitor` strings in hook source/test files updated to `nf-context-monitor`
3. **config-loader.js**: HOOK_PROFILE_MAP (standard, strict) and DEFAULT_HOOK_PRIORITIES updated from `gsd-context-monitor` to `nf-context-monitor`
4. **install.js hook wiring**: Lines 34, 1354, 2236, 2240 updated to reference `nf-context-monitor`
5. **OLD_HOOK_MAP migration**: Added `'gsd-context-monitor'` to PostToolUse cleanup array alongside existing `'qgsd-context-monitor'`
6. **PATCHES_DIR_NAME**: Changed from `'gsd-local-patches'` to `'nf-local-patches'` in install.js
7. **reapply-patches.md**: All 5 `gsd-local-patches` references replaced with `nf-local-patches`

## Verification Results

- Zero `gsd-context-monitor` references in hooks/, commands/, or bin/install.js (except 1 in OLD_HOOK_MAP migration array -- correct)
- Zero `gsd-local-patches` references in bin/install.js or commands/nf/reapply-patches.md
- `node --test hooks/nf-context-monitor.test.js`: all pass (0 fail)
- `node --test hooks/config-loader.test.js`: all pass (0 fail)
- `node bin/install.js --claude --global`: exit 0
- `~/.claude/settings.json`: contains `nf-context-monitor`, no `gsd-context-monitor`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Source files already partially renamed**
- **Found during:** Task 1
- **Issue:** `hooks/gsd-context-monitor.js` and `hooks/gsd-context-monitor.test.js` were already renamed to `nf-context-monitor.*` on disk (likely from a prior partial attempt), but string content inside still referenced `gsd-context-monitor`. The `hooks/dist/gsd-context-monitor.test.js` was still the old name.
- **Fix:** Used `mv` for remaining dist test file rename, then updated all internal string references across all files.
- **Files modified:** hooks/dist/nf-context-monitor.test.js (rename), all listed files (content update)

**2. [Rule 3 - Blocking] Dist files gitignored, Task 3 no-op commit**
- **Found during:** Task 3
- **Issue:** `hooks/dist/` is in .gitignore, so dist file sync produced no committable changes. Task 3 commit was a no-op.
- **Fix:** Dist files synced on disk and installer ran successfully; no git commit needed for this task.
