---
phase: quick-15
plan: 01
subsystem: installer
tags: [rename, namespace, hooks, installer]
dependency_graph:
  requires: []
  provides:
    - hooks/qgsd-statusline.js
    - hooks/qgsd-check-update.js
    - hooks/dist/qgsd-statusline.js
    - hooks/dist/qgsd-check-update.js
  affects:
    - bin/install.js
    - scripts/build-hooks.js
tech_stack:
  added: []
  patterns:
    - git mv for history-preserving renames
    - orphan cleanup list pattern (install.js cleanupOrphanedFiles)
    - dual-name migration detection (cleanupOrphanedHooks statusLine block)
key_files:
  created:
    - hooks/qgsd-statusline.js (renamed from gsd-statusline.js)
    - hooks/qgsd-check-update.js (renamed from gsd-check-update.js)
    - hooks/dist/qgsd-statusline.js (renamed from hooks/dist/gsd-statusline.js)
    - hooks/dist/qgsd-check-update.js (renamed from hooks/dist/gsd-check-update.js)
  modified:
    - bin/install.js
    - scripts/build-hooks.js
decisions:
  - "gsd-check-update.sh kept as-is in gsdHooks — it is a legacy cleanup entry for an even older name predating gsd-check-update.js"
  - "cleanupOrphanedHooks migration block detects both statusline.js AND gsd-statusline.js to handle two generations of old installs simultaneously"
metrics:
  duration: "3 min"
  completed: "2026-02-21"
  tasks: 2
  files: 6
---

# Quick Task 15: Rename GSD Hook Files to QGSD Summary

**One-liner:** Renamed four gsd-* hook files to qgsd-* via git mv and updated all active install/uninstall/build references in install.js and build-hooks.js to eliminate GSD/QGSD namespace collision risk.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Rename hook source and dist files | 5a63cbc | hooks/qgsd-statusline.js, hooks/qgsd-check-update.js, hooks/dist/qgsd-statusline.js, hooks/dist/qgsd-check-update.js |
| 2 | Update all references in install.js, build-hooks.js | 061df09 | bin/install.js, scripts/build-hooks.js |

## What Was Done

### Task 1: File Renames (git mv)

All four hook files renamed with git history preserved:

- `hooks/gsd-statusline.js` → `hooks/qgsd-statusline.js`
- `hooks/gsd-check-update.js` → `hooks/qgsd-check-update.js`
- `hooks/dist/gsd-statusline.js` → `hooks/dist/qgsd-statusline.js`
- `hooks/dist/gsd-check-update.js` → `hooks/dist/qgsd-check-update.js`

Note: hooks/dist/ is gitignored per project design; git included the dist renames in the commit because they were staged via `git mv`.

### Task 2: Reference Updates

**scripts/build-hooks.js:**
- `HOOKS_TO_COPY`: `gsd-check-update.js` and `gsd-statusline.js` renamed to `qgsd-check-update.js` and `qgsd-statusline.js`

**bin/install.js** (8 changes):
1. `MANIFEST_NAME`: `gsd-file-manifest.json` → `qgsd-file-manifest.json`
2. `buildHookCommand` calls in `install()`: both references updated to `qgsd-statusline.js` / `qgsd-check-update.js`
3. `hasGsdUpdateHook` detection: `.includes('qgsd-check-update')`
4. `uninstall()` `gsdHooks` array: `qgsd-statusline.js`, `qgsd-check-update.js` (kept `gsd-check-update.sh` as legacy cleanup)
5. `uninstall()` statusLine detection: `.includes('qgsd-statusline')`
6. `uninstall()` SessionStart filter: `qgsd-check-update` and `qgsd-statusline`
7. `cleanupOrphanedFiles()`: added `hooks/gsd-statusline.js` and `hooks/gsd-check-update.js` as orphan entries (reinstalls will remove old files from existing installs)
8. `cleanupOrphanedHooks()` migration block: now detects both `statusline.js` AND `gsd-statusline.js` and migrates to `qgsd-statusline.js`

## Verification Results

- All four `qgsd-*.js` files exist in hooks/ and hooks/dist/
- All four `gsd-*.js` originals are absent
- `grep` on active code paths: no `gsd-statusline`, `gsd-check-update`, or `gsd-file-manifest` in active (non-migration/non-orphan) code paths
- `npm test`: 141/141 passing, 0 failing

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| hooks/qgsd-statusline.js | FOUND |
| hooks/qgsd-check-update.js | FOUND |
| hooks/dist/qgsd-statusline.js | FOUND |
| hooks/dist/qgsd-check-update.js | FOUND |
| Commit 5a63cbc | FOUND |
| Commit 061df09 | FOUND |
