---
phase: quick-15
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/gsd-statusline.js
  - hooks/gsd-check-update.js
  - hooks/dist/gsd-statusline.js
  - hooks/dist/gsd-check-update.js
  - scripts/build-hooks.js
  - bin/install.js
autonomous: true
requirements: []
must_haves:
  truths:
    - "No file named gsd-statusline.js, gsd-check-update.js, or gsd-file-manifest.json exists in hooks/ or hooks/dist/"
    - "install.js references qgsd-statusline.js and qgsd-check-update.js everywhere it previously said gsd-statusline.js and gsd-check-update.js"
    - "MANIFEST_NAME constant equals qgsd-file-manifest.json"
    - "build-hooks.js lists qgsd-check-update.js and qgsd-statusline.js (not the gsd-* names)"
    - "cleanupOrphanedFiles adds gsd-statusline.js and gsd-check-update.js as entries to remove on reinstall"
    - "npm test passes (141/141)"
  artifacts:
    - path: "hooks/qgsd-statusline.js"
      provides: "Renamed statusline hook source"
    - path: "hooks/qgsd-check-update.js"
      provides: "Renamed update check hook source"
    - path: "hooks/dist/qgsd-statusline.js"
      provides: "Renamed statusline hook dist"
    - path: "hooks/dist/qgsd-check-update.js"
      provides: "Renamed update check hook dist"
  key_links:
    - from: "scripts/build-hooks.js"
      to: "hooks/qgsd-statusline.js, hooks/qgsd-check-update.js"
      via: "HOOKS_TO_COPY array entries"
      pattern: "qgsd-check-update\\.js.*qgsd-statusline\\.js"
    - from: "bin/install.js"
      to: "hooks/qgsd-statusline.js, hooks/qgsd-check-update.js"
      via: "buildHookCommand() calls and gsdHooks list"
      pattern: "buildHookCommand.*qgsd-statusline|qgsd-check-update"
---

<objective>
Rename three shared GSD-named files to QGSD-prefixed names to eliminate the
GSD/QGSD collision risk: gsd-statusline.js, gsd-check-update.js, and
gsd-file-manifest.json all still carry the upstream GSD brand and could collide
with a parallel GSD install.

Purpose: Eliminate namespace collision between QGSD-installed hooks/manifest and
any coexisting upstream GSD install. QGSD owns all files it writes; its files
must carry the qgsd- prefix consistently.

Output:
- hooks/qgsd-statusline.js + hooks/dist/qgsd-statusline.js (renamed from gsd-*)
- hooks/qgsd-check-update.js + hooks/dist/qgsd-check-update.js (renamed from gsd-*)
- bin/install.js updated: all gsd-statusline / gsd-check-update / gsd-file-manifest references updated
- scripts/build-hooks.js updated: HOOKS_TO_COPY uses new names
- Orphan cleanup: gsd-statusline.js and gsd-check-update.js added to cleanupOrphanedFiles
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename hook source and dist files</name>
  <files>
    hooks/qgsd-statusline.js
    hooks/qgsd-check-update.js
    hooks/dist/qgsd-statusline.js
    hooks/dist/qgsd-check-update.js
  </files>
  <action>
    Git-rename all four files so history is preserved:

    ```
    git mv hooks/gsd-statusline.js hooks/qgsd-statusline.js
    git mv hooks/gsd-check-update.js hooks/qgsd-check-update.js
    git mv hooks/dist/gsd-statusline.js hooks/dist/qgsd-statusline.js
    git mv hooks/dist/gsd-check-update.js hooks/dist/qgsd-check-update.js
    ```

    No content changes needed inside the files — the rename is purely cosmetic.
  </action>
  <verify>
    ```
    ls hooks/qgsd-statusline.js hooks/qgsd-check-update.js
    ls hooks/dist/qgsd-statusline.js hooks/dist/qgsd-check-update.js
    ls hooks/gsd-statusline.js 2>/dev/null && echo "FAIL: old file still exists" || echo "OK: old source gone"
    ls hooks/dist/gsd-statusline.js 2>/dev/null && echo "FAIL: old dist file still exists" || echo "OK: old dist gone"
    ```
  </verify>
  <done>
    All four qgsd-*.js files exist; all four gsd-* originals are absent.
    `git status` shows four renames (R hooks/gsd-* → hooks/qgsd-*).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update all references in install.js, build-hooks.js</name>
  <files>
    bin/install.js
    scripts/build-hooks.js
  </files>
  <action>
    **scripts/build-hooks.js** — update HOOKS_TO_COPY (lines 14-15):
    - `'gsd-check-update.js'` → `'qgsd-check-update.js'`
    - `'gsd-statusline.js'` → `'qgsd-statusline.js'`

    **bin/install.js** — apply all changes below in a single file write:

    1. **MANIFEST_NAME constant** (line ~1364):
       - `'gsd-file-manifest.json'` → `'qgsd-file-manifest.json'`

    2. **buildHookCommand calls in install()** (lines ~1677-1681):
       - `buildHookCommand(targetDir, 'gsd-statusline.js')` → `buildHookCommand(targetDir, 'qgsd-statusline.js')`
       - `'node ' + dirName + '/hooks/gsd-statusline.js'` → `'node ' + dirName + '/hooks/qgsd-statusline.js'`
       - `buildHookCommand(targetDir, 'gsd-check-update.js')` → `buildHookCommand(targetDir, 'qgsd-check-update.js')`
       - `'node ' + dirName + '/hooks/gsd-check-update.js'` → `'node ' + dirName + '/hooks/qgsd-check-update.js'`

    3. **hasGsdUpdateHook detection** (line ~1704):
       - `.includes('gsd-check-update')` → `.includes('qgsd-check-update')`

    4. **uninstall() gsdHooks array** (line ~1019):
       - `['gsd-statusline.js', 'gsd-check-update.js', 'gsd-check-update.sh']`
         → `['qgsd-statusline.js', 'qgsd-check-update.js', 'gsd-check-update.sh']`
       (Keep `gsd-check-update.sh` — it is a legacy cleanup entry for an even older name.)

    5. **uninstall() statusLine detection** (line ~1058):
       - `.includes('gsd-statusline')` → `.includes('qgsd-statusline')`

    6. **uninstall() SessionStart filter** (line ~1071):
       - `.includes('gsd-check-update') || h.command.includes('gsd-statusline')`
         → `.includes('qgsd-check-update') || h.command.includes('qgsd-statusline')`

    7. **cleanupOrphanedFiles()** — add the old gsd-* names as orphaned entries so
       reinstalls clean them up from existing installations:
       ```js
       const orphanedFiles = [
         'hooks/gsd-notify.sh',        // Removed in v1.6.x
         'hooks/statusline.js',         // Renamed to gsd-statusline.js in v1.9.0
         'hooks/gsd-statusline.js',     // Renamed to qgsd-statusline.js in v0.2
         'hooks/gsd-check-update.js',   // Renamed to qgsd-check-update.js in v0.2
       ];
       ```

    8. **cleanupOrphanedHooks()** — the orphanedHookPatterns list at line ~858 references
       `'hooks/statusline.js'` for migration. Verify the existing `statusLine` migration
       block (lines ~899-905) that renames `statusline.js` → `gsd-statusline.js` is updated
       to instead rename `statusline.js` OR `gsd-statusline.js` → `qgsd-statusline.js`.
       Replace the condition/replacement block to handle both the very old and the old name:
       ```js
       // Fix #330 + qgsd migration: update statusLine if it points to old statusline path
       if (settings.statusLine && settings.statusLine.command) {
         const cmd = settings.statusLine.command;
         if ((cmd.includes('statusline.js') || cmd.includes('gsd-statusline.js')) &&
             !cmd.includes('qgsd-statusline.js')) {
           settings.statusLine.command = cmd
             .replace(/\bgsd-statusline\.js\b/, 'qgsd-statusline.js')
             .replace(/\bstatusline\.js\b/, 'qgsd-statusline.js');
           console.log(`  ${green}✓${reset} Updated statusline path → qgsd-statusline.js`);
         }
       }
       ```
  </action>
  <verify>
    ```bash
    # No gsd-statusline or gsd-check-update references remain in active code paths
    grep -n "gsd-statusline\|gsd-check-update\|gsd-file-manifest" bin/install.js | grep -v "Renamed\|orphaned\|old\|legacy\|Migration\|pre-v"
    # Expect: only lines inside orphanedFiles/orphanedHookPatterns (cleanup entries) — no active path references
    grep -n "qgsd-statusline\|qgsd-check-update\|qgsd-file-manifest" bin/install.js | head -20
    # Expect: multiple hits for all three names in active code

    grep "qgsd-check-update\|qgsd-statusline" scripts/build-hooks.js
    # Expect: both appear in HOOKS_TO_COPY

    npm test
    # Expect: 141 passing, 0 failing
    ```
  </verify>
  <done>
    - `grep -n "gsd-file-manifest" bin/install.js` returns zero results (constant renamed).
    - `MANIFEST_NAME` equals `'qgsd-file-manifest.json'`.
    - All buildHookCommand calls reference qgsd-* names.
    - cleanupOrphanedFiles includes gsd-statusline.js and gsd-check-update.js.
    - npm test: 141/141 passing.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. `ls hooks/qgsd-statusline.js hooks/qgsd-check-update.js hooks/dist/qgsd-statusline.js hooks/dist/qgsd-check-update.js` — all four exist.
2. `ls hooks/gsd-statusline.js hooks/gsd-check-update.js 2>/dev/null` — both absent.
3. `grep "gsd-file-manifest\|gsd-statusline\|gsd-check-update" bin/install.js | grep -v "orphan\|Renamed\|Migration\|pre-v\|legacy"` — empty output.
4. `npm test` — 141/141 passing.
</verification>

<success_criteria>
- Four source/dist hook files renamed from gsd-* to qgsd-* (git mv, history preserved).
- MANIFEST_NAME = 'qgsd-file-manifest.json' in install.js.
- All active install/uninstall code paths reference qgsd-statusline.js and qgsd-check-update.js.
- Old gsd-statusline.js and gsd-check-update.js added as orphan cleanup entries in cleanupOrphanedFiles().
- cleanupOrphanedHooks() statusLine migration handles both statusline.js → and gsd-statusline.js → qgsd-statusline.js.
- build-hooks.js HOOKS_TO_COPY uses qgsd-* names.
- npm test: 141/141 passing.
</success_criteria>

<output>
After completion, create `.planning/quick/15-rename-shared-gsd-files-to-qgsd-to-elimi/15-SUMMARY.md`
</output>
